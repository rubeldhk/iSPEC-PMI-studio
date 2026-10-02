/**
 * `T1482` (EPIC-042, data-model.md §2) — one decomposition policy per project.
 * Interface, in-memory (tests) and Prisma under `DATABASE_URL`.
 */
import type { OfflineMode } from '@pmi/workspace-bundle';

export interface DecompositionPolicyRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly oneSpecPerEpic: boolean;
  readonly taskCeiling: number;
  readonly splitRequiresConfirmation: boolean;
  readonly offlineMode: OfflineMode;
  readonly version: number;
  readonly updatedById: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PolicyValues {
  readonly oneSpecPerEpic: boolean;
  readonly taskCeiling: number;
  readonly splitRequiresConfirmation: boolean;
  readonly offlineMode: OfflineMode;
}

export interface DecompositionPolicyStore {
  findByProject(projectId: string): Promise<DecompositionPolicyRecord | null>;
  create(row: DecompositionPolicyRecord): Promise<DecompositionPolicyRecord>;
  update(projectId: string, values: PolicyValues & { version: number; updatedById: string; updatedAt: Date }): Promise<DecompositionPolicyRecord>;
}

export class InMemoryDecompositionPolicyStore implements DecompositionPolicyStore {
  private readonly rows = new Map<string, DecompositionPolicyRecord>();

  async findByProject(projectId: string): Promise<DecompositionPolicyRecord | null> {
    return this.rows.get(projectId) ?? null;
  }

  async create(row: DecompositionPolicyRecord): Promise<DecompositionPolicyRecord> {
    const frozen = Object.freeze({ ...row });
    this.rows.set(row.projectId, frozen);
    return frozen;
  }

  async update(projectId: string, values: PolicyValues & { version: number; updatedById: string; updatedAt: Date }): Promise<DecompositionPolicyRecord> {
    const existing = this.rows.get(projectId);
    if (!existing) throw new Error(`No policy for ${projectId}`);
    const next = Object.freeze({ ...existing, ...values });
    this.rows.set(projectId, next);
    return next;
  }
}

/** The subset of `PrismaClient['decompositionPolicy']` the store uses. */
export interface DecompositionPolicyDelegate {
  findUnique(args: { where: { projectId: string } }): Promise<DecompositionPolicyRecord | null>;
  create(args: { data: Record<string, unknown> }): Promise<DecompositionPolicyRecord>;
  update(args: { where: { projectId: string }; data: Record<string, unknown> }): Promise<DecompositionPolicyRecord>;
}

export class PrismaDecompositionPolicyStore implements DecompositionPolicyStore {
  constructor(private readonly policies: DecompositionPolicyDelegate) {}

  async findByProject(projectId: string): Promise<DecompositionPolicyRecord | null> {
    return this.policies.findUnique({ where: { projectId } });
  }

  async create(row: DecompositionPolicyRecord): Promise<DecompositionPolicyRecord> {
    return this.policies.create({ data: { ...row } });
  }

  async update(projectId: string, values: PolicyValues & { version: number; updatedById: string; updatedAt: Date }): Promise<DecompositionPolicyRecord> {
    return this.policies.update({ where: { projectId }, data: { ...values } });
  }
}
