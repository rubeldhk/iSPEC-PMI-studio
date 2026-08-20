/**
 * T067 — append-only version history on edit (FR-009).
 *
 * A version row is the requirement AS IT STOOD before an edit (data-model.md).
 * There is deliberately no update or delete on this service or its port — the
 * same shape as `AuditService` (T028), and the database enforces the same rule
 * with the `requirement_versions_immutable` trigger (T457/T458).
 *
 * Framework-free (PC-1). Wired in `requirements.module.ts`.
 */
import { randomUUID } from 'node:crypto';
import type { RequirementPriority, RequirementType } from './requirement.validation.js';

export interface RequirementVersionRecord {
  id: string;
  workspaceId: string;
  requirementId: string;
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
  authoredById: string;
  authoredAt: Date;
}

export type AppendVersionInput = Omit<RequirementVersionRecord, 'id' | 'authoredAt'>;

/** Append and read. Nothing else exists to call. */
export interface RequirementVersionStore {
  append(data: RequirementVersionRecord): Promise<RequirementVersionRecord>;
  listForRequirement(workspaceId: string, requirementId: string): Promise<RequirementVersionRecord[]>;
}

export class RequirementVersionService {
  constructor(private readonly store: RequirementVersionStore) {}

  async append(input: AppendVersionInput): Promise<RequirementVersionRecord> {
    return this.store.append({ ...input, id: randomUUID(), authoredAt: new Date() });
  }

  /** History, newest first (US2 scenario 2: prior text stays retrievable). */
  async listForRequirement(
    workspaceId: string,
    requirementId: string,
  ): Promise<RequirementVersionRecord[]> {
    return this.store.listForRequirement(workspaceId, requirementId);
  }
}

/** The subset of a Prisma delegate the store uses (T651 precedent). */
export interface RequirementVersionDelegate {
  create(args: { data: RequirementVersionRecord }): Promise<RequirementVersionRecord>;
  findMany(args: {
    where: { workspaceId: string; requirementId: string };
    orderBy: { authoredAt: 'desc' };
  }): Promise<RequirementVersionRecord[]>;
}

export class PrismaRequirementVersionStore implements RequirementVersionStore {
  constructor(private readonly requirementVersion: RequirementVersionDelegate) {}

  async append(data: RequirementVersionRecord): Promise<RequirementVersionRecord> {
    return this.requirementVersion.create({ data });
  }

  async listForRequirement(
    workspaceId: string,
    requirementId: string,
  ): Promise<RequirementVersionRecord[]> {
    return this.requirementVersion.findMany({
      where: { workspaceId, requirementId },
      orderBy: { authoredAt: 'desc' },
    });
  }
}

/**
 * In-memory store for tests and database-less runs. `mutateForTest` exists so
 * a test can prove appended rows refuse mutation — mirroring the trigger.
 */
export class InMemoryRequirementVersionStore implements RequirementVersionStore {
  private readonly rows: RequirementVersionRecord[] = [];
  private seq = 0;

  async append(data: RequirementVersionRecord): Promise<RequirementVersionRecord> {
    // A monotonic tiebreak: two appends can land in the same millisecond, and
    // "newest first" must still be deterministic.
    const stamped = { ...data, authoredAt: new Date(Date.now() + this.seq++) };
    this.rows.push(Object.freeze(stamped) as RequirementVersionRecord);
    return stamped;
  }

  async listForRequirement(
    workspaceId: string,
    requirementId: string,
  ): Promise<RequirementVersionRecord[]> {
    return this.rows
      .filter((r) => r.workspaceId === workspaceId && r.requirementId === requirementId)
      .sort((a, b) => b.authoredAt.getTime() - a.authoredAt.getTime());
  }

  /** Test-only: proves the rows are frozen. Throws like the database trigger. */
  mutateForTest(id: string): void {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('no such version row');
    throw new Error('requirement_versions is append-only');
  }
}
