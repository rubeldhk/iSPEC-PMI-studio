/**
 * T1105 (EPIC-009 C2C reopening) — atomic lifecycle application.
 *
 * ## The gap this closes
 *
 * `X8`: EPIC-009 changed lifecycle state through `setLifecycleState` and
 * recorded transition evidence through a separate `TransitionRecorder`. Two
 * writes, two stores, no shared transaction — so a crash between them could
 * leave a state change with no evidence, or evidence for a change that never
 * landed. The service also discarded the transition record, so no caller could
 * name the transition it had just caused.
 *
 * Binding the old store and the old recorder to two independent Prisma adapters
 * would have preserved exactly that split. This is a single **unit of work**
 * instead: one `$transaction`, both writes, or neither.
 *
 * ## Optimistic concurrency without a lock
 *
 * The expected status is part of the UPDATE's `WHERE`, not a preceding SELECT.
 * Two concurrent applications from the same expected state therefore contend in
 * the database: the first matches and commits, the second matches **zero** rows
 * and is refused. A read-then-write would leave a window between the check and
 * the update in which both callers believe they may proceed.
 *
 * ## Idempotency
 *
 * A unique index over `(workspaceId, specificationId, idempotencyKey)` is the
 * oracle. A retry finds the committed transition and returns it verbatim,
 * marked `idempotent`, so a lost response cannot produce a second transition.
 */
import { NotFoundError } from '../../core/errors.js';

/** What a committed application produced. Every field comes from the commit. */
export interface LifecycleTransitionResult {
  readonly transitionId: string;
  readonly specificationId: string;
  readonly previousStatus: string;
  readonly resultingStatus: string;
  readonly previousVersionId: string | null;
  readonly resultingVersionId: string | null;
  readonly appliedAt: string;
  readonly actorId: string;
  readonly actorSnapshotId: string | null;
  readonly correlationId: string;
  readonly causationId: string;
  /** True when a prior committed result was returned instead of a new one. */
  readonly idempotent: boolean;
}

export interface ApplyTransitionInput {
  readonly workspaceId: string;
  readonly specificationId: string;
  readonly expectedStatus: string;
  readonly requestedStatus: string;
  readonly actorId: string;
  readonly actorSnapshotId?: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly idempotencyKey: string;
}

/**
 * The observed state contradicted the caller's expectation.
 *
 * Distinct from a refusal: nothing was decided against the request, the
 * specification simply is not where the caller believed it was.
 */
export class ExpectedStateMismatchError extends Error {
  readonly code = 'expected_state_mismatch' as const;
  constructor(
    readonly expected: string,
    readonly observed: string,
  ) {
    super(`Expected lifecycle status "${expected}" but the specification is "${observed}".`);
    this.name = 'ExpectedStateMismatchError';
  }
}

/** The narrow slice of Prisma this repository needs, inside or outside a tx. */
export interface LifecycleTx {
  specification: {
    findFirst(args: {
      where: { workspaceId: string; id: string };
      select: { lifecycleState: true; currentVersionId: true };
    }): Promise<{ lifecycleState: string; currentVersionId: string | null } | null>;
    updateMany(args: {
      where: { workspaceId: string; id: string; lifecycleState: string };
      data: { lifecycleState: string; updatedById: string };
    }): Promise<{ count: number }>;
  };
  lifecycleTransition: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string; occurredAt: Date }>;
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<Record<string, unknown> | null>;
  };
}

/** `PrismaClient.$transaction`, supplied at the composition root. */
export type LifecycleTransactionRunner = <T>(fn: (tx: LifecycleTx) => Promise<T>) => Promise<T>;

function iso(at: Date | string): string {
  return at instanceof Date ? at.toISOString() : String(at);
}

function resultFromRow(row: Record<string, unknown>, idempotent: boolean): LifecycleTransitionResult {
  return {
    transitionId: String(row['id']),
    specificationId: String(row['specificationId']),
    previousStatus: String(row['fromState']),
    resultingStatus: String(row['toState']),
    previousVersionId: (row['previousVersionId'] as string | null) ?? null,
    resultingVersionId: (row['resultingVersionId'] as string | null) ?? null,
    appliedAt: iso(row['occurredAt'] as Date),
    actorId: String(row['actorId']),
    actorSnapshotId: (row['actorSnapshotId'] as string | null) ?? null,
    correlationId: String(row['correlationId'] ?? ''),
    causationId: String(row['causationId'] ?? ''),
    idempotent,
  };
}

export class PrismaLifecycleTransitionRepository {
  constructor(
    private readonly runInTransaction: LifecycleTransactionRunner,
    private readonly reader: LifecycleTx,
  ) {}

  /** The authoritative status, read from the same table the transition updates. */
  async currentStatus(
    workspaceId: string,
    specificationId: string,
  ): Promise<{ status: string; versionId: string | null }> {
    const row = await this.reader.specification.findFirst({
      where: { workspaceId, id: specificationId },
      select: { lifecycleState: true, currentVersionId: true },
    });
    if (row === null) throw new NotFoundError('Specification not found.');
    return { status: row.lifecycleState, versionId: row.currentVersionId };
  }

  /** Read back a committed transition — used to prove durability after restart. */
  async findTransition(
    workspaceId: string,
    transitionId: string,
  ): Promise<LifecycleTransitionResult | null> {
    const row = await this.reader.lifecycleTransition.findFirst({
      where: { workspaceId, id: transitionId },
    });
    return row ? resultFromRow(row, false) : null;
  }

  /**
   * Apply the transition, or change nothing.
   *
   * The state update and the evidence insert are one transaction: if the insert
   * fails, the update is rolled back with it, so no state change can survive
   * without the record that explains it.
   */
  async apply(input: ApplyTransitionInput): Promise<LifecycleTransitionResult> {
    return this.runInTransaction(async (tx) => {
      // --- Idempotency, inside the transaction so a concurrent retry either
      // sees the committed row or blocks on the unique index.
      const prior = await tx.lifecycleTransition.findFirst({
        where: {
          workspaceId: input.workspaceId,
          specificationId: input.specificationId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (prior) return resultFromRow(prior, true);

      // --- Conditional update: the expectation is part of the WHERE, so the
      // check and the write are one statement and cannot be interleaved.
      const { count } = await tx.specification.updateMany({
        where: {
          workspaceId: input.workspaceId,
          id: input.specificationId,
          lifecycleState: input.expectedStatus,
        },
        data: { lifecycleState: input.requestedStatus, updatedById: input.actorId },
      });

      if (count === 0) {
        // Nothing matched. Either the specification is absent, or it is not in
        // the state the caller expected — different facts, different answers.
        const observed = await tx.specification.findFirst({
          where: { workspaceId: input.workspaceId, id: input.specificationId },
          select: { lifecycleState: true, currentVersionId: true },
        });
        if (observed === null) throw new NotFoundError('Specification not found.');
        throw new ExpectedStateMismatchError(input.expectedStatus, observed.lifecycleState);
      }

      const after = await tx.specification.findFirst({
        where: { workspaceId: input.workspaceId, id: input.specificationId },
        select: { lifecycleState: true, currentVersionId: true },
      });

      const created = await tx.lifecycleTransition.create({
        data: {
          workspaceId: input.workspaceId,
          specificationId: input.specificationId,
          fromState: input.expectedStatus,
          toState: input.requestedStatus,
          actorId: input.actorId,
          actorSnapshotId: input.actorSnapshotId ?? null,
          correlationId: input.correlationId,
          causationId: input.causationId,
          idempotencyKey: input.idempotencyKey,
          previousVersionId: after?.currentVersionId ?? null,
          resultingVersionId: after?.currentVersionId ?? null,
        },
      });

      return {
        transitionId: created.id,
        specificationId: input.specificationId,
        previousStatus: input.expectedStatus,
        resultingStatus: input.requestedStatus,
        previousVersionId: after?.currentVersionId ?? null,
        resultingVersionId: after?.currentVersionId ?? null,
        appliedAt: iso(created.occurredAt),
        actorId: input.actorId,
        actorSnapshotId: input.actorSnapshotId ?? null,
        correlationId: input.correlationId,
        causationId: input.causationId,
        idempotent: false,
      };
    });
  }
}
