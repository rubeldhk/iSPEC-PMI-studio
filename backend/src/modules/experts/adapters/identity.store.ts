/**
 * `T2562`, `T2563` (EPIC-047) — what an Expert's execution identity needs
 * remembered. `DEF-047-001`.
 *
 * Two facts, both owned by this Epic rather than by `EPIC-028`'s registry:
 *
 * - **Which agent principal acts for an Expert on behalf of a sponsor.** One per
 *   *(workspace, Expert key, sponsoring user)*: `EPIC-028` freezes a principal's
 *   sponsor, and its registry has no lookup by descriptor. The first writer
 *   wins; a concurrent second dispatch reads the winner back.
 * - **The identity each execution registered with.** `EPIC-037` re-checks the
 *   identity at completion, and a run may be completed by another process — a
 *   parent's stop cascade, for one. So the refs are stored, not recomputed.
 */
import type { ExecutionIdentityRefs } from '@pmi/execution-registry-contract';

export interface ExecutionIdentity {
  readonly executionId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly refs: ExecutionIdentityRefs;
}

export interface ExpertIdentityStore {
  principalFor(workspaceId: string, expertKey: string, sponsorUserId: string): Promise<string | null>;
  /** Records the principal for the triple and returns the one in force — the first recorded. */
  recordPrincipal(workspaceId: string, expertKey: string, sponsorUserId: string, principalId: string): Promise<string>;
  recordExecution(identity: ExecutionIdentity): Promise<void>;
  /** `null` when the execution is unknown **in this workspace**. */
  executionIdentity(workspaceId: string, executionId: string): Promise<ExecutionIdentity | null>;
}

export class InMemoryExpertIdentityStore implements ExpertIdentityStore {
  readonly #principals = new Map<string, string>();
  readonly #executions = new Map<string, ExecutionIdentity>();

  async principalFor(workspaceId: string, expertKey: string, sponsorUserId: string): Promise<string | null> {
    return this.#principals.get(key(workspaceId, expertKey, sponsorUserId)) ?? null;
  }

  async recordPrincipal(workspaceId: string, expertKey: string, sponsorUserId: string, principalId: string): Promise<string> {
    const k = key(workspaceId, expertKey, sponsorUserId);
    const existing = this.#principals.get(k);
    if (existing !== undefined) return existing;
    this.#principals.set(k, principalId);
    return principalId;
  }

  async recordExecution(identity: ExecutionIdentity): Promise<void> {
    this.#executions.set(identity.executionId, { ...identity, refs: { ...identity.refs } });
  }

  async executionIdentity(workspaceId: string, executionId: string): Promise<ExecutionIdentity | null> {
    const found = this.#executions.get(executionId);
    return found && found.workspaceId === workspaceId ? { ...found, refs: { ...found.refs } } : null;
  }
}

function key(workspaceId: string, expertKey: string, sponsorUserId: string): string {
  return JSON.stringify([workspaceId, expertKey, sponsorUserId]);
}

/** The two raw calls the PostgreSQL store needs — the shape `prismaClient()` has. */
export interface IdentityStoreClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

interface ExecutionIdentityRow {
  executionId: string;
  workspaceId: string;
  projectId: string;
  principalId: string;
  agentSnapshotId: string;
  connectorRegistrationId: string;
  sponsorUserId: string;
  delegationId: string;
  delegationIdentityVersion: number;
}

/**
 * `T2563` — PostgreSQL, through the migration `20261010120000_epic047_execution_identity`.
 * Both tables are append-only by trigger; a second principal for the same
 * triple is a no-op insert, and the winner is read back in the same call.
 */
export class PrismaExpertIdentityStore implements ExpertIdentityStore {
  constructor(private readonly db: IdentityStoreClient) {}

  async principalFor(workspaceId: string, expertKey: string, sponsorUserId: string): Promise<string | null> {
    const rows = await this.db.$queryRawUnsafe<{ principalId: string }[]>(
      `SELECT "principalId" FROM "expert_principals"
        WHERE "workspaceId" = $1 AND "expertKey" = $2 AND "sponsorUserId" = $3`,
      workspaceId,
      expertKey,
      sponsorUserId,
    );
    return rows[0]?.principalId ?? null;
  }

  async recordPrincipal(workspaceId: string, expertKey: string, sponsorUserId: string, principalId: string): Promise<string> {
    await this.db.$executeRawUnsafe(
      `INSERT INTO "expert_principals" ("workspaceId", "expertKey", "sponsorUserId", "principalId")
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      workspaceId,
      expertKey,
      sponsorUserId,
      principalId,
    );
    const winner = await this.principalFor(workspaceId, expertKey, sponsorUserId);
    if (winner === null) throw new Error(`no principal recorded for Expert '${expertKey}' and sponsor ${sponsorUserId}`);
    return winner;
  }

  async recordExecution(identity: ExecutionIdentity): Promise<void> {
    const r = identity.refs;
    await this.db.$executeRawUnsafe(
      `INSERT INTO "expert_execution_identities"
         ("executionId", "workspaceId", "projectId", "principalId", "agentSnapshotId",
          "connectorRegistrationId", "sponsorUserId", "delegationId", "delegationIdentityVersion")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      identity.executionId,
      identity.workspaceId,
      identity.projectId,
      r.authenticatedPrincipalId,
      r.agentSnapshotId,
      r.connectorRegistrationId,
      r.sponsorUserId,
      r.delegationId,
      r.delegationIdentityVersion,
    );
  }

  async executionIdentity(workspaceId: string, executionId: string): Promise<ExecutionIdentity | null> {
    const rows = await this.db.$queryRawUnsafe<ExecutionIdentityRow[]>(
      `SELECT "executionId", "workspaceId", "projectId", "principalId", "agentSnapshotId",
              "connectorRegistrationId", "sponsorUserId", "delegationId", "delegationIdentityVersion"
         FROM "expert_execution_identities" WHERE "executionId" = $1 AND "workspaceId" = $2`,
      executionId,
      workspaceId,
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      executionId: row.executionId,
      workspaceId: row.workspaceId,
      projectId: row.projectId,
      refs: {
        authenticatedPrincipalId: row.principalId,
        agentSnapshotId: row.agentSnapshotId,
        connectorRegistrationId: row.connectorRegistrationId,
        sponsorUserId: row.sponsorUserId,
        delegationId: row.delegationId,
        delegationIdentityVersion: Number(row.delegationIdentityVersion),
      },
    };
  }
}
