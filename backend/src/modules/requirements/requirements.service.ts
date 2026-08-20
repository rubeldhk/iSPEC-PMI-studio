/**
 * T066 — the requirement register: create, edit, list, filter (FR-004, FR-005,
 * FR-007, FR-008, FR-009).
 *
 * Framework-free (PC-1). Wired in `requirements.module.ts`.
 *
 * Edit is where FR-009 happens: the PRIOR state is appended to the history
 * (T067) before the record moves, in that order, so a failure between the two
 * leaves surplus history rather than a lost prior state. Retirement lives in
 * its own service (T068); the hash seam to EPIC-008 in `requirement-hash.ts`
 * (T069).
 */
import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '../../core/errors.js';
import { assertSameWorkspace, type RefusalRecord } from '../../core/workspace.guard.js';
import { requirementContentHash } from './requirement-hash.js';
import type { RequirementVersionRecord, RequirementVersionService } from './requirement-version.service.js';
import {
  validateCreate,
  validateEdit,
  validateListFilters,
  type CreateRequirementInput,
  type EditRequirementInput,
  type ListFilters,
  type RequirementPriority,
  type RequirementStatus,
  type RequirementType,
  type ValidatedListQuery,
} from './requirement.validation.js';

export interface RequirementRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  reference: string;
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
  status: RequirementStatus;
  contentHash: string;
  retiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActingContext {
  workspaceId: string;
  userId: string;
}

/**
 * The persistence port. No delete exists (FR-006): requirements retire, and
 * their history is append-only through the version service's own port.
 */
export interface RequirementStore {
  /**
   * Unscoped BY DESIGN — tenancy on id-fetches is enforced by
   * `assertSameWorkspace` in the services (EPIC-004 convergence F2), which is
   * what lets a refusal be recorded rather than collapsing into "no row".
   */
  findById(id: string): Promise<RequirementRecord | null>;
  findByReference(
    workspaceId: string,
    projectId: string,
    reference: string,
  ): Promise<RequirementRecord | null>;
  list(workspaceId: string, projectId: string, query: ValidatedListQuery): Promise<RequirementRecord[]>;
  countForProject(workspaceId: string, projectId: string): Promise<number>;
  create(data: Omit<RequirementRecord, 'createdAt' | 'updatedAt'>): Promise<RequirementRecord>;
  update(
    workspaceId: string,
    id: string,
    data: Partial<
      Pick<RequirementRecord, 'description' | 'type' | 'priority' | 'status' | 'retiredAt' | 'contentHash'>
    >,
  ): Promise<RequirementRecord>;
}

const OPAQUE = 'Not found.';

export interface RequirementsServiceOptions {
  /** Refusal hook (FR-033): wired to the audit service at the composition root. */
  onRefused?: (record: RefusalRecord) => void;
}

export class RequirementsService {
  private readonly onRefused: ((record: RefusalRecord) => void) | undefined;

  constructor(
    private readonly store: RequirementStore,
    private readonly history: RequirementVersionService,
    options: RequirementsServiceOptions = {},
  ) {
    this.onRefused = options.onRefused;
  }

  async create(
    ctx: ActingContext,
    projectId: string,
    input: CreateRequirementInput,
  ): Promise<RequirementRecord> {
    validateCreate(input);

    let reference = input.reference?.trim();
    if (reference) {
      if ((await this.store.findByReference(ctx.workspaceId, projectId, reference)) !== null) {
        throw new ConflictError(`Reference "${reference}" is already used in this project.`);
      }
    } else {
      reference = await this.nextReference(ctx.workspaceId, projectId);
    }

    const description = input.description.trim();
    return this.store.create({
      id: randomUUID(),
      workspaceId: ctx.workspaceId,
      projectId,
      reference,
      description,
      type: input.type,
      priority: input.priority,
      status: 'active',
      contentHash: requirementContentHash({
        description,
        type: input.type,
        priority: input.priority,
      }),
      retiredAt: null,
    });
  }

  async get(workspaceId: string, id: string): Promise<RequirementRecord> {
    const requirement = await this.store.findById(id);
    // The tenancy guard (T016, per EPIC-004 convergence F2): one identical
    // outcome for absence and cross-workspace, refusal recordable (FR-033).
    assertSameWorkspace(workspaceId, requirement, {
      targetType: 'requirement',
      ...(this.onRefused ? { onRefused: this.onRefused } : {}),
    });
    return requirement as RequirementRecord;
  }

  async list(
    workspaceId: string,
    projectId: string,
    filters: ListFilters,
  ): Promise<RequirementRecord[]> {
    return this.store.list(workspaceId, projectId, validateListFilters(filters));
  }

  /**
   * FR-009: an edit that changes material content appends the prior state to
   * the history FIRST, then moves the record and refreshes the content hash.
   * An edit that changes nothing appends nothing — a no-op is not history.
   */
  async edit(
    ctx: ActingContext,
    id: string,
    input: EditRequirementInput,
  ): Promise<RequirementRecord> {
    validateEdit(input);
    const existing = await this.get(ctx.workspaceId, id);
    if (existing.status === 'retired') {
      throw new ConflictError('A retired requirement is read-only (FR-006).');
    }

    const next = {
      description: input.description?.trim() ?? existing.description,
      type: (input.type as RequirementType | undefined) ?? existing.type,
      priority: (input.priority as RequirementPriority | undefined) ?? existing.priority,
    };
    const unchanged =
      next.description === existing.description &&
      next.type === existing.type &&
      next.priority === existing.priority;
    if (unchanged) return existing;

    await this.history.append({
      workspaceId: existing.workspaceId,
      requirementId: existing.id,
      description: existing.description,
      type: existing.type,
      priority: existing.priority,
      authoredById: ctx.userId,
    });

    return this.store.update(ctx.workspaceId, id, {
      ...next,
      contentHash: requirementContentHash(next),
    });
  }

  /** Edit history, newest first (FR-009). */
  async versions(workspaceId: string, id: string): Promise<RequirementVersionRecord[]> {
    return this.history.listForRequirement(workspaceId, id);
  }

  /** FR-005 — a generated human-facing identifier, unique within the project. */
  private async nextReference(workspaceId: string, projectId: string): Promise<string> {
    let n = (await this.store.countForProject(workspaceId, projectId)) + 1;
    // Collisions are possible after explicit references; walk forward.
    for (;;) {
      const candidate = `REQ-${String(n).padStart(3, '0')}`;
      if ((await this.store.findByReference(workspaceId, projectId, candidate)) === null) {
        return candidate;
      }
      n += 1;
    }
  }
}

/** The subset of a Prisma delegate the store uses (T651 precedent). */
export interface RequirementDelegate {
  findFirst(args: { where: Record<string, unknown> }): Promise<RequirementRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: Record<string, string>;
  }): Promise<RequirementRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  create(args: { data: Record<string, unknown> }): Promise<RequirementRecord>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

export class PrismaRequirementStore implements RequirementStore {
  constructor(private readonly requirement: RequirementDelegate) {}

  async findById(id: string): Promise<RequirementRecord | null> {
    return this.requirement.findFirst({ where: { id } });
  }

  async findByReference(
    workspaceId: string,
    projectId: string,
    reference: string,
  ): Promise<RequirementRecord | null> {
    return this.requirement.findFirst({ where: { workspaceId, projectId, reference } });
  }

  async list(
    workspaceId: string,
    projectId: string,
    query: ValidatedListQuery,
  ): Promise<RequirementRecord[]> {
    const { sortBy, sortDir, ...filters } = query;
    return this.requirement.findMany({
      where: { workspaceId, projectId, ...filters },
      orderBy: { [sortBy]: sortDir },
    });
  }

  async countForProject(workspaceId: string, projectId: string): Promise<number> {
    return this.requirement.count({ where: { workspaceId, projectId } });
  }

  async create(data: Omit<RequirementRecord, 'createdAt' | 'updatedAt'>): Promise<RequirementRecord> {
    return this.requirement.create({ data });
  }

  async update(
    workspaceId: string,
    id: string,
    data: Partial<
      Pick<RequirementRecord, 'description' | 'type' | 'priority' | 'status' | 'retiredAt' | 'contentHash'>
    >,
  ): Promise<RequirementRecord> {
    // updateMany so the workspace filter participates in the WRITE (T456).
    const { count } = await this.requirement.updateMany({ where: { workspaceId, id }, data });
    if (count === 0) throw new NotFoundError(OPAQUE);
    const updated = await this.findById(id);
    /* c8 ignore next — the row was just written under this scope. */
    if (updated === null) throw new NotFoundError(OPAQUE);
    return updated;
  }
}

/** Priority sorts by rank, not alphabetically — p1 before p2 before p3. */
const PRIORITY_RANK: Record<RequirementPriority, number> = { p1: 1, p2: 2, p3: 3 };

/** In-memory store for tests and database-less runs. No delete exists. */
export class InMemoryRequirementStore implements RequirementStore {
  private readonly rows = new Map<string, RequirementRecord>();
  private seq = 0;

  async findById(id: string): Promise<RequirementRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async findByReference(
    workspaceId: string,
    projectId: string,
    reference: string,
  ): Promise<RequirementRecord | null> {
    for (const row of this.rows.values()) {
      if (row.workspaceId === workspaceId && row.projectId === projectId && row.reference === reference) {
        return row;
      }
    }
    return null;
  }

  async list(
    workspaceId: string,
    projectId: string,
    query: ValidatedListQuery,
  ): Promise<RequirementRecord[]> {
    const { sortBy, sortDir, ...filters } = query;
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...this.rows.values()]
      .filter((r) => r.workspaceId === workspaceId && r.projectId === projectId)
      .filter((r) => Object.entries(filters).every(([k, v]) => r[k as keyof RequirementRecord] === v))
      .sort((a, b) => {
        const key = (r: RequirementRecord): string | number =>
          sortBy === 'priority'
            ? PRIORITY_RANK[r.priority]
            : sortBy === 'createdAt'
              ? r.createdAt.getTime()
              : r[sortBy];
        const [x, y] = [key(a), key(b)];
        return (x < y ? -1 : x > y ? 1 : 0) * dir;
      });
  }

  async countForProject(workspaceId: string, projectId: string): Promise<number> {
    return [...this.rows.values()].filter(
      (r) => r.workspaceId === workspaceId && r.projectId === projectId,
    ).length;
  }

  async create(data: Omit<RequirementRecord, 'createdAt' | 'updatedAt'>): Promise<RequirementRecord> {
    // Monotonic timestamps so createdAt ordering is deterministic in tests.
    const at = new Date(Date.now() + this.seq++);
    const stamped: RequirementRecord = { ...data, createdAt: at, updatedAt: at };
    this.rows.set(stamped.id, stamped);
    return stamped;
  }

  async update(
    workspaceId: string,
    id: string,
    data: Partial<
      Pick<RequirementRecord, 'description' | 'type' | 'priority' | 'status' | 'retiredAt' | 'contentHash'>
    >,
  ): Promise<RequirementRecord> {
    const row = await this.findById(id);
    if (row === null || row.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    const updated: RequirementRecord = { ...row, ...data, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }
}
