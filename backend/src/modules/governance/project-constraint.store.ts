/**
 * `T1480` (EPIC-042, data-model.md §1) — owner-authored constraints. Interface,
 * in-memory (tests) and Prisma under `DATABASE_URL`; asserted by
 * `tests/architecture/durable-stores.spec.ts`. Retired, never deleted.
 */

export type ConstraintKind = 'principle' | 'constraint' | 'non_goal';
export type ConstraintStatus = 'active' | 'retired';

export interface ProjectConstraintRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly kind: ConstraintKind;
  readonly title: string;
  readonly body: string;
  readonly order: number;
  readonly version: number;
  readonly status: ConstraintStatus;
  readonly createdById: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ConstraintPatch {
  readonly title?: string;
  readonly body?: string;
  readonly order?: number;
  readonly status?: ConstraintStatus;
  readonly version: number;
  readonly updatedAt: Date;
}

export interface ConstraintFilters {
  readonly kind?: ConstraintKind;
  readonly status?: ConstraintStatus;
}

export interface ProjectConstraintStore {
  create(row: ProjectConstraintRecord): Promise<ProjectConstraintRecord>;
  find(id: string): Promise<ProjectConstraintRecord | null>;
  update(id: string, patch: ConstraintPatch): Promise<ProjectConstraintRecord>;
  /** Ordered by kind (principle, constraint, non_goal) then order. */
  list(workspaceId: string, projectId: string, filters: ConstraintFilters): Promise<ProjectConstraintRecord[]>;
}

const KIND_ORDER: readonly ConstraintKind[] = ['principle', 'constraint', 'non_goal'];

export function sortConstraints(rows: ProjectConstraintRecord[]): ProjectConstraintRecord[] {
  return [...rows].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime());
}

export class InMemoryProjectConstraintStore implements ProjectConstraintStore {
  private readonly rows = new Map<string, ProjectConstraintRecord>();

  async create(row: ProjectConstraintRecord): Promise<ProjectConstraintRecord> {
    const frozen = Object.freeze({ ...row });
    this.rows.set(row.id, frozen);
    return frozen;
  }

  async find(id: string): Promise<ProjectConstraintRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async update(id: string, patch: ConstraintPatch): Promise<ProjectConstraintRecord> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`No constraint ${id}`);
    const next = Object.freeze({
      ...existing,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.order !== undefined ? { order: patch.order } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      version: patch.version,
      updatedAt: patch.updatedAt,
    });
    this.rows.set(id, next);
    return next;
  }

  async list(workspaceId: string, projectId: string, filters: ConstraintFilters): Promise<ProjectConstraintRecord[]> {
    return sortConstraints(
      [...this.rows.values()].filter(
        (r) => r.workspaceId === workspaceId && r.projectId === projectId && (filters.kind === undefined || r.kind === filters.kind) && (filters.status === undefined || r.status === filters.status),
      ),
    );
  }
}

/** The subset of `PrismaClient['projectConstraint']` the store uses. */
export interface ProjectConstraintDelegate {
  create(args: { data: Record<string, unknown> }): Promise<ProjectConstraintRecord>;
  findUnique(args: { where: { id: string } }): Promise<ProjectConstraintRecord | null>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<ProjectConstraintRecord>;
  findMany(args: { where: Record<string, unknown> }): Promise<ProjectConstraintRecord[]>;
}

export class PrismaProjectConstraintStore implements ProjectConstraintStore {
  constructor(private readonly constraints: ProjectConstraintDelegate) {}

  async create(row: ProjectConstraintRecord): Promise<ProjectConstraintRecord> {
    return this.constraints.create({ data: { ...row } });
  }

  async find(id: string): Promise<ProjectConstraintRecord | null> {
    return this.constraints.findUnique({ where: { id } });
  }

  async update(id: string, patch: ConstraintPatch): Promise<ProjectConstraintRecord> {
    return this.constraints.update({ where: { id }, data: { ...patch } });
  }

  async list(workspaceId: string, projectId: string, filters: ConstraintFilters): Promise<ProjectConstraintRecord[]> {
    const rows = await this.constraints.findMany({
      where: { workspaceId, projectId, ...(filters.kind !== undefined ? { kind: filters.kind } : {}), ...(filters.status !== undefined ? { status: filters.status } : {}) },
    });
    return sortConstraints(rows);
  }
}
