/**
 * T1048 (EPIC-037 Band A) — the rebuildable projection.
 *
 * The projection is **derived and non-authoritative**. Everything it holds can
 * be recomputed from `execution_events`, and `rebuild` does exactly that —
 * which is the test of the claim, not a convenience. A projection nobody can
 * rebuild is a second source of truth wearing a cache's name.
 *
 * `projectedThroughSequence` is why the table is worth having rather than
 * merely fast: it makes staleness **visible**. A projection that cannot say how
 * far it has read is indistinguishable from one that is up to date, and a
 * reader would have no way to know they are looking at a stale answer.
 */
import {
  classOf,
  isTerminalLifecycleEvent,
  type ExecutionEventType,
} from '@pmi/execution-registry-contract';

export interface ProjectionDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

interface StreamRow {
  sequence: number;
  class: string;
  type: string;
}

export interface ProjectedExecution {
  executionId: string;
  lifecycleState: string;
  governanceState: string;
  projectedThroughSequence: number;
}

/**
 * Fold the stream into current state.
 *
 * A **pure function** of the events, deliberately: it can be tested without a
 * database, and `rebuild` and the incremental path cannot drift because they
 * both call this.
 */
export function foldExecution(events: readonly { sequence: number; type: string }[]): {
  lifecycleState: string;
  projectedThroughSequence: number;
} {
  let lifecycleState = 'registered';
  let projectedThroughSequence = 0;
  for (const event of events) {
    projectedThroughSequence = Math.max(projectedThroughSequence, event.sequence);
    if (classOf(event.type as ExecutionEventType) !== 'lifecycle') continue;
    // Terminal states are absorbing: a later lifecycle event cannot be
    // appended at all, so the fold never needs to leave one.
    if (isTerminalLifecycleEvent(lifecycleState as ExecutionEventType)) continue;
    lifecycleState = event.type;
  }
  return { lifecycleState, projectedThroughSequence };
}

export class ExecutionProjectionService {
  constructor(private readonly db: ProjectionDb) {}

  /**
   * Recompute one execution's projection from its authoritative events.
   *
   * Safe to run at any time and any number of times — that is what makes the
   * projection disposable, and disposability is what makes it a projection.
   */
  async rebuild(workspaceId: string, executionId: string): Promise<ProjectedExecution> {
    const rows = await this.db.$queryRawUnsafe<StreamRow[]>(
      `SELECT "sequence","class","type" FROM "execution_events"
        WHERE "workspaceId" = $1 AND "executionId" = $2 ORDER BY "sequence"`,
      workspaceId,
      executionId,
    );
    const folded = foldExecution(rows);

    const governance = await this.db.$queryRawUnsafe<{ governanceState: string }[]>(
      `SELECT "governanceState" FROM "executions" WHERE "id" = $1`,
      executionId,
    );
    const governanceState = governance[0]?.governanceState ?? 'provisional';

    await this.db.$executeRawUnsafe(
      `INSERT INTO "execution_state"
         ("executionId","workspaceId","lifecycleState","governanceState","projectedThroughSequence","updatedAt")
       VALUES ($1,$2,$3,$4,$5, now())
       ON CONFLICT ("executionId") DO UPDATE
         SET "lifecycleState" = EXCLUDED."lifecycleState",
             "governanceState" = EXCLUDED."governanceState",
             "projectedThroughSequence" = EXCLUDED."projectedThroughSequence",
             "updatedAt" = now()`,
      executionId,
      workspaceId,
      folded.lifecycleState,
      governanceState,
      folded.projectedThroughSequence,
    );

    return {
      executionId,
      lifecycleState: folded.lifecycleState,
      governanceState,
      projectedThroughSequence: folded.projectedThroughSequence,
    };
  }

  async read(workspaceId: string, executionId: string): Promise<ProjectedExecution | null> {
    const rows = await this.db.$queryRawUnsafe<
      { executionId: string; lifecycleState: string; governanceState: string; projectedThroughSequence: number }[]
    >(
      `SELECT "executionId","lifecycleState","governanceState","projectedThroughSequence"
         FROM "execution_state" WHERE "executionId" = $1 AND "workspaceId" = $2`,
      executionId,
      workspaceId,
    );
    return rows[0] ?? null;
  }

  /**
   * Project the verdict stream onto a proposal's state.
   *
   * The verdict itself lives in EPIC-030's records and in this Epic's event
   * stream. This is a **read model** over both — there is deliberately no
   * adjudication column on the proposal (`R-037-5`), because a mutable verdict
   * field becomes the audit authority the moment somebody reads it.
   */
  async projectProposal(
    workspaceId: string,
    proposalId: string,
    state: string,
    throughSequence: number,
  ): Promise<void> {
    await this.db.$executeRawUnsafe(
      `INSERT INTO "status_transition_state"
         ("proposalId","workspaceId","state","projectedThroughSequence","updatedAt")
       VALUES ($1,$2,$3,$4, now())
       ON CONFLICT ("proposalId") DO UPDATE
         SET "state" = EXCLUDED."state",
             "projectedThroughSequence" = EXCLUDED."projectedThroughSequence",
             "updatedAt" = now()`,
      proposalId,
      workspaceId,
      state,
      throughSequence,
    );
  }
}
