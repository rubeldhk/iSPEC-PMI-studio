/**
 * T054 — the projects service: create, list, get, rename, archive (FR-001).
 *
 * Framework-free (PC-1): callable without HTTP, so the worker and a Phase 3
 * MCP surface reach the same capability. Wired in `projects.module.ts`.
 *
 * Tenancy: every read is scoped through `scoped()` (T014) — the store port
 * takes the workspace as its first argument and a caller cannot widen it.
 * Cross-workspace access and absence are indistinguishable (FR-002): both
 * surface as the opaque `NotFoundError`.
 */
import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { assertSameWorkspace, type RefusalRecord } from '../../core/workspace.guard.js';

export type ProjectStatus = 'active' | 'archived';

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  /** FR-019: null = inherit the registered default engine. */
  engineName: string | null;
  ownerUserId: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActingContext {
  workspaceId: string;
  userId: string;
}

export interface CreateProjectInput {
  name?: string;
  description?: string;
  engineName?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  engineName?: string | null;
}

/**
 * The persistence port. Deliberately exposes NO delete: archive preserves all
 * content (FR-001), and a port without a destructive operation cannot regress.
 */
export interface ProjectStore {
  /**
   * Unscoped BY DESIGN — the one sanctioned exception to the filter rule.
   * Tenancy on id-fetches is enforced by `assertSameWorkspace` in the service
   * (EPIC-004 convergence F2: the guard must be wired by the first
   * resource-fetch endpoint), which is what lets a refusal be RECORDED rather
   * than silently collapsing into "no row matched" (FR-033).
   */
  findById(id: string): Promise<ProjectRecord | null>;
  findByName(workspaceId: string, name: string): Promise<ProjectRecord | null>;
  list(workspaceId: string): Promise<ProjectRecord[]>;
  create(data: Omit<ProjectRecord, 'createdAt' | 'updatedAt'>): Promise<ProjectRecord>;
  update(
    workspaceId: string,
    id: string,
    data: Partial<Pick<ProjectRecord, 'name' | 'description' | 'engineName' | 'status' | 'archivedAt'>>,
  ): Promise<ProjectRecord>;
  /** Unscoped by design: the engine resolver holds only a project id. */
  findEngineName(projectId: string): Promise<string | null>;
}

export interface ProjectsServiceOptions {
  now?: () => Date;
  /** Refusal hook (FR-033): wired to the audit service at the composition root. */
  onRefused?: (record: RefusalRecord) => void;
}

const NAME_MAX = 200;
const OPAQUE = 'Not found.';

function validateName(name: string | undefined): asserts name is string {
  if (!name || name.trim() === '') {
    throw new ValidationFailedError('Project cannot be saved.', {
      fields: [{ field: 'name', reason: 'required' }],
    });
  }
  if (name.length > NAME_MAX) {
    throw new ValidationFailedError('Project cannot be saved.', {
      fields: [{ field: 'name', reason: `at most ${NAME_MAX} characters` }],
    });
  }
}

export class ProjectsService {
  private readonly now: () => Date;
  private readonly onRefused: ((record: RefusalRecord) => void) | undefined;

  constructor(
    private readonly store: ProjectStore,
    options: ProjectsServiceOptions = {},
  ) {
    this.now = options.now ?? ((): Date => new Date());
    this.onRefused = options.onRefused;
  }

  async create(ctx: ActingContext, input: CreateProjectInput): Promise<ProjectRecord> {
    validateName(input.name);
    const name = input.name.trim();
    // Unique within the workspace, not globally — the tenancy boundary is the
    // namespace. Two workspaces may each hold a "Platform".
    if ((await this.store.findByName(ctx.workspaceId, name)) !== null) {
      throw new ConflictError(`A project named "${name}" already exists in this workspace.`);
    }
    return this.store.create({
      id: randomUUID(),
      workspaceId: ctx.workspaceId,
      name,
      description: input.description ?? null,
      status: 'active',
      engineName: input.engineName ?? null,
      ownerUserId: ctx.userId,
      archivedAt: null,
    });
  }

  async list(workspaceId: string): Promise<ProjectRecord[]> {
    return this.store.list(workspaceId);
  }

  async get(workspaceId: string, id: string): Promise<ProjectRecord> {
    const project = await this.store.findById(id);
    // The tenancy guard (T016, wired here per EPIC-004 convergence F2):
    // absence and cross-workspace produce one identical outcome, and the
    // refusal is recordable before the response leaves (FR-002, FR-033).
    assertSameWorkspace(workspaceId, project, {
      targetType: 'project',
      ...(this.onRefused ? { onRefused: this.onRefused } : {}),
    });
    return project as ProjectRecord;
  }

  async update(workspaceId: string, id: string, input: UpdateProjectInput): Promise<ProjectRecord> {
    const existing = await this.get(workspaceId, id);
    const patch: Parameters<ProjectStore['update']>[2] = {};

    if (input.name !== undefined) {
      validateName(input.name);
      const name = input.name.trim();
      if (name !== existing.name) {
        const taken = await this.store.findByName(workspaceId, name);
        if (taken !== null && taken.id !== id) {
          throw new ConflictError(`A project named "${name}" already exists in this workspace.`);
        }
      }
      patch.name = name;
    }
    if (input.description !== undefined) patch.description = input.description;
    if (input.engineName !== undefined) patch.engineName = input.engineName;

    if (Object.keys(patch).length === 0) return existing;
    return this.store.update(workspaceId, id, patch);
  }

  /**
   * Archive is a status, never a delete (FR-001, US1 scenario 5). Everything
   * the project holds survives intact; only `status` and `archivedAt` move.
   * Idempotent: archiving an archived project keeps the first timestamp.
   */
  async archive(workspaceId: string, id: string): Promise<ProjectRecord> {
    const existing = await this.get(workspaceId, id);
    if (existing.status === 'archived') return existing;
    return this.store.update(workspaceId, id, {
      status: 'archived',
      archivedAt: this.now(),
    });
  }

  /**
   * The `ProjectEngineSelectionPort` read (FR-019): the engine a project has
   * selected, or null to inherit the deployment default — exactly the contract
   * `EngineResolverService` has honoured since T035.
   */
  async findEngineNameForProject(projectId: string): Promise<string | null> {
    return this.store.findEngineName(projectId);
  }
}

/** The subset of a Prisma delegate the store uses (T463/T651 precedent). */
export interface ProjectDelegate {
  findFirst(args: { where: Record<string, unknown> }): Promise<ProjectRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, string>;
  }): Promise<ProjectRecord[]>;
  create(args: { data: Record<string, unknown> }): Promise<ProjectRecord>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

export class PrismaProjectStore implements ProjectStore {
  constructor(private readonly project: ProjectDelegate) {}

  async findById(id: string): Promise<ProjectRecord | null> {
    return this.project.findFirst({ where: { id } });
  }

  async findByName(workspaceId: string, name: string): Promise<ProjectRecord | null> {
    return this.project.findFirst({ where: { workspaceId, name } });
  }

  async list(workspaceId: string): Promise<ProjectRecord[]> {
    return this.project.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } });
  }

  async create(data: Omit<ProjectRecord, 'createdAt' | 'updatedAt'>): Promise<ProjectRecord> {
    return this.project.create({ data });
  }

  async update(
    workspaceId: string,
    id: string,
    data: Partial<Pick<ProjectRecord, 'name' | 'description' | 'engineName' | 'status' | 'archivedAt'>>,
  ): Promise<ProjectRecord> {
    // updateMany so the workspace filter participates in the WRITE — a plain
    // update({ where: { id } }) would trust the id's provenance, which is
    // exactly what T456's header warns against.
    const { count } = await this.project.updateMany({ where: { workspaceId, id }, data });
    if (count === 0) throw new NotFoundError(OPAQUE);
    const updated = await this.findById(id);
    /* c8 ignore next — the row was just written under this scope. */
    if (updated === null) throw new NotFoundError(OPAQUE);
    return updated;
  }

  async findEngineName(projectId: string): Promise<string | null> {
    const row = await this.findById(projectId);
    return row?.engineName ?? null;
  }
}

/**
 * In-memory store for tests and database-less deployments — the same posture
 * as `NullJobStore`. Note there is no delete method to call: T050 asserts it.
 */
export class InMemoryProjectStore implements ProjectStore {
  private readonly rows = new Map<string, ProjectRecord>();

  async findById(id: string): Promise<ProjectRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async findByName(workspaceId: string, name: string): Promise<ProjectRecord | null> {
    for (const row of this.rows.values()) {
      if (row.workspaceId === workspaceId && row.name === name) return row;
    }
    return null;
  }

  async list(workspaceId: string): Promise<ProjectRecord[]> {
    return [...this.rows.values()].filter((r) => r.workspaceId === workspaceId);
  }

  async create(data: Omit<ProjectRecord, 'createdAt' | 'updatedAt'>): Promise<ProjectRecord> {
    const stamped: ProjectRecord = { ...data, createdAt: new Date(), updatedAt: new Date() };
    this.rows.set(stamped.id, stamped);
    return stamped;
  }

  async update(
    workspaceId: string,
    id: string,
    data: Partial<Pick<ProjectRecord, 'name' | 'description' | 'engineName' | 'status' | 'archivedAt'>>,
  ): Promise<ProjectRecord> {
    const row = await this.findById(id);
    if (row === null || row.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    const updated: ProjectRecord = { ...row, ...data, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async findEngineName(projectId: string): Promise<string | null> {
    return this.rows.get(projectId)?.engineName ?? null;
  }
}
