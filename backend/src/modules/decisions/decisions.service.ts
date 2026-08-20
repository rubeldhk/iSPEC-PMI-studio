/**
 * T143a — the ADR service: create, list, update, status change, specification
 * linking (FR-034).
 *
 * Status is a three-value enum with NO transition guards and no attribution
 * table — deliberately unlike EPIC-009's six-state lifecycle (tasks.md note).
 * Superseding is a status, not a deletion: a superseded ADR stays readable,
 * consistent with retired requirements (FR-006) and archived specifications
 * (FR-011b).
 *
 * Framework-free (PC-1). Wired in `decisions.module.ts`.
 */
import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { assertSameWorkspace, type RefusalRecord } from '../../core/workspace.guard.js';

export const ADR_STATUSES = ['proposed', 'accepted', 'superseded'] as const;
export type AdrStatus = (typeof ADR_STATUSES)[number];

export interface AdrRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  reference: string;
  title: string;
  status: AdrStatus;
  context: string;
  decision: string;
  consequences: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActingContext {
  workspaceId: string;
  userId: string;
}

export interface CreateAdrInput {
  reference?: string;
  title?: string;
  context?: string;
  decision?: string;
  consequences?: string;
}

export interface UpdateAdrInput {
  title?: string;
  context?: string;
  decision?: string;
  consequences?: string;
  status?: AdrStatus;
}

/** No delete exists: decisions are records (the point of keeping them). */
export interface AdrStore {
  findById(id: string): Promise<AdrRecord | null>;
  findByReference(workspaceId: string, projectId: string, reference: string): Promise<AdrRecord | null>;
  list(workspaceId: string, projectId: string): Promise<AdrRecord[]>;
  countForProject(workspaceId: string, projectId: string): Promise<number>;
  create(row: Omit<AdrRecord, 'createdAt' | 'updatedAt'>): Promise<AdrRecord>;
  update(workspaceId: string, id: string, patch: Partial<Omit<AdrRecord, 'id' | 'workspaceId' | 'projectId'>>): Promise<AdrRecord>;
}

/** The many-to-many to specifications (FR-034). Add and remove — link rows only. */
export interface AdrSpecificationLinkStore {
  add(adrId: string, specificationIds: string[]): Promise<void>;
  remove(adrId: string, specificationIds: string[]): Promise<void>;
  linkedSpecificationIds(adrId: string): Promise<string[]>;
}

const REQUIRED_FIELDS = ['title', 'context', 'decision', 'consequences'] as const;

export interface DecisionsServiceOptions {
  onRefused?: (record: RefusalRecord) => void;
}

export class DecisionsService {
  private readonly onRefused: ((record: RefusalRecord) => void) | undefined;

  constructor(
    private readonly store: AdrStore,
    private readonly links: AdrSpecificationLinkStore,
    options: DecisionsServiceOptions = {},
  ) {
    this.onRefused = options.onRefused;
  }

  async create(ctx: ActingContext, projectId: string, input: CreateAdrInput): Promise<AdrRecord> {
    const fields = REQUIRED_FIELDS.filter((f) => !input[f] || (input[f] as string).trim() === '').map(
      (field) => ({ field, reason: 'required' }),
    );
    if (fields.length > 0) {
      throw new ValidationFailedError('Architecture decision record cannot be saved.', { fields });
    }

    let reference = input.reference?.trim();
    if (reference) {
      if ((await this.store.findByReference(ctx.workspaceId, projectId, reference)) !== null) {
        throw new ConflictError(`Reference "${reference}" is already used in this project.`);
      }
    } else {
      reference = await this.nextReference(ctx.workspaceId, projectId);
    }

    return this.store.create({
      id: randomUUID(),
      workspaceId: ctx.workspaceId,
      projectId,
      reference,
      title: (input.title as string).trim(),
      status: 'proposed',
      context: input.context as string,
      decision: input.decision as string,
      consequences: input.consequences as string,
    });
  }

  async list(workspaceId: string, projectId: string): Promise<AdrRecord[]> {
    return this.store.list(workspaceId, projectId);
  }

  async get(workspaceId: string, id: string): Promise<AdrRecord> {
    const adr = await this.store.findById(id);
    // The tenancy guard (T016, per EPIC-004 convergence F2).
    assertSameWorkspace(workspaceId, adr, {
      targetType: 'architecture_decision_record',
      ...(this.onRefused ? { onRefused: this.onRefused } : {}),
    });
    return adr as AdrRecord;
  }

  async update(workspaceId: string, id: string, input: UpdateAdrInput): Promise<AdrRecord> {
    await this.get(workspaceId, id);

    const fields: { field: string; reason: string }[] = [];
    for (const f of REQUIRED_FIELDS) {
      if (input[f] !== undefined && (input[f] as string).trim() === '') {
        fields.push({ field: f, reason: 'required' });
      }
    }
    if (input.status !== undefined && !(ADR_STATUSES as readonly string[]).includes(input.status)) {
      fields.push({ field: 'status', reason: `must be one of: ${ADR_STATUSES.join(', ')}` });
    }
    if (fields.length > 0) {
      throw new ValidationFailedError('Architecture decision record cannot be saved.', { fields });
    }

    const patch: Partial<Omit<AdrRecord, 'id' | 'workspaceId' | 'projectId'>> = {};
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.context !== undefined) patch.context = input.context;
    if (input.decision !== undefined) patch.decision = input.decision;
    if (input.consequences !== undefined) patch.consequences = input.consequences;
    // A status set is a status set — no transition guard by design.
    if (input.status !== undefined) patch.status = input.status;

    if (Object.keys(patch).length === 0) return this.get(workspaceId, id);
    return this.store.update(workspaceId, id, patch);
  }

  /** FR-034: link to the specifications the decision affects. Additive, idempotent. */
  async linkSpecifications(workspaceId: string, id: string, specificationIds: string[]): Promise<string[]> {
    await this.get(workspaceId, id);
    await this.links.add(id, specificationIds);
    return this.links.linkedSpecificationIds(id);
  }

  async unlinkSpecifications(workspaceId: string, id: string, specificationIds: string[]): Promise<string[]> {
    await this.get(workspaceId, id);
    await this.links.remove(id, specificationIds);
    return this.links.linkedSpecificationIds(id);
  }

  private async nextReference(workspaceId: string, projectId: string): Promise<string> {
    let n = (await this.store.countForProject(workspaceId, projectId)) + 1;
    for (;;) {
      const candidate = `ADR-${String(n).padStart(4, '0')}`;
      if ((await this.store.findByReference(workspaceId, projectId, candidate)) === null) {
        return candidate;
      }
      n += 1;
    }
  }
}

/** In-memory ADR store for tests and database-less runs. No delete exists. */
export class InMemoryAdrStore implements AdrStore {
  private readonly rows = new Map<string, AdrRecord>();

  async findById(id: string): Promise<AdrRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async findByReference(
    workspaceId: string,
    projectId: string,
    reference: string,
  ): Promise<AdrRecord | null> {
    for (const row of this.rows.values()) {
      if (row.workspaceId === workspaceId && row.projectId === projectId && row.reference === reference) {
        return row;
      }
    }
    return null;
  }

  async list(workspaceId: string, projectId: string): Promise<AdrRecord[]> {
    return [...this.rows.values()].filter(
      (r) => r.workspaceId === workspaceId && r.projectId === projectId,
    );
  }

  async countForProject(workspaceId: string, projectId: string): Promise<number> {
    return (await this.list(workspaceId, projectId)).length;
  }

  async create(row: Omit<AdrRecord, 'createdAt' | 'updatedAt'>): Promise<AdrRecord> {
    const stamped: AdrRecord = { ...row, createdAt: new Date(), updatedAt: new Date() };
    this.rows.set(stamped.id, stamped);
    return stamped;
  }

  async update(
    workspaceId: string,
    id: string,
    patch: Partial<Omit<AdrRecord, 'id' | 'workspaceId' | 'projectId'>>,
  ): Promise<AdrRecord> {
    const row = this.rows.get(id);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundError('Not found.');
    const updated: AdrRecord = { ...row, ...patch, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }
}

/** In-memory link store. Link rows only — never the ADR, never the spec. */
export class InMemoryAdrSpecificationLinkStore implements AdrSpecificationLinkStore {
  private readonly bySpec = new Map<string, Set<string>>();

  async add(adrId: string, specificationIds: string[]): Promise<void> {
    const set = this.bySpec.get(adrId) ?? new Set<string>();
    for (const id of specificationIds) set.add(id);
    this.bySpec.set(adrId, set);
  }

  async remove(adrId: string, specificationIds: string[]): Promise<void> {
    const set = this.bySpec.get(adrId);
    if (!set) return;
    for (const id of specificationIds) set.delete(id);
  }

  async linkedSpecificationIds(adrId: string): Promise<string[]> {
    return [...(this.bySpec.get(adrId) ?? [])];
  }
}
