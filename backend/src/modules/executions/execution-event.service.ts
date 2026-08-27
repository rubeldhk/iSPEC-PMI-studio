/**
 * T1045, T1047 (EPIC-037 Band A) — appending to the authoritative stream.
 *
 * Three guarantees live here, and each is enforced by the database rather than
 * by care:
 *
 * **Gapless sequence, per execution.** A PostgreSQL sequence is global and gaps
 * on rollback, so it cannot provide "gapless per execution" — `R-037-6` says so
 * and this does not use one. Instead the parent `executions` row is locked
 * `FOR UPDATE` inside the transaction, so appends to one execution serialise
 * while appends to different executions do not block each other. `UNIQUE
 * (executionId, sequence)` is the backstop: if the lock ever failed, the second
 * writer would collide rather than silently reuse a number.
 *
 * **Class-aware terminality** (`FR-EXR-018`). Once a terminal lifecycle event
 * exists, no further *lifecycle* event may be appended. Everything else may:
 * an execution finishing does not settle the argument about it, and comments,
 * redactions, reconciliation and governance verdicts all arrive afterwards.
 *
 * **Idempotency.** `UNIQUE (workspaceId, idempotencyKey)` and a replay returns
 * the ORIGINAL event rather than appending a second. A read-then-write check in
 * application code would be a race with extra steps.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  RegistryRefusedError,
  classOf,
  isExecutionEventType,
  isTerminalLifecycleEvent,
  permittedAfterTerminal,
  type AppendedEvent,
  type ExecutionEventType,
} from '@pmi/execution-registry-contract';

export interface EventRow {
  id: string;
  workspaceId: string;
  executionId: string;
  sequence: number;
  localSequence: number | null;
  class: string;
  type: string;
  payload: unknown;
  occurredAt: Date | string;
  recordedAt: Date | string;
  emittedBy: string;
  idempotencyKey: string;
  integrityHash: string;
}

/** The narrow transactional surface this service needs. */
export interface EventTx {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export interface EventDb {
  $transaction<T>(fn: (tx: EventTx) => Promise<T>): Promise<T>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export interface AppendInput {
  workspaceId: string;
  executionId: string;
  type: ExecutionEventType;
  payload: Record<string, unknown>;
  occurredAt: string;
  emittedBy: string;
  idempotencyKey: string;
  expectedSequence?: number;
  localSequence?: number;
}

const iso = (v: Date | string): string => (v instanceof Date ? v.toISOString() : v);

function toAppended(row: EventRow, replayed: boolean): AppendedEvent {
  return {
    eventId: row.id,
    executionId: row.executionId,
    sequence: row.sequence,
    type: row.type as ExecutionEventType,
    recordedAt: iso(row.recordedAt),
    replayed,
  };
}

/**
 * The integrity hash chains each event to its predecessor.
 *
 * Chained rather than per-row, so removing a middle event is detectable. The
 * table is append-only, but a hash that only covered its own row would prove
 * nothing about the stream's shape.
 */
export function hashEvent(input: {
  executionId: string;
  sequence: number;
  type: string;
  payload: unknown;
  occurredAt: string;
  emittedBy: string;
  previousHash: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        input.executionId,
        input.sequence,
        input.type,
        input.payload,
        input.occurredAt,
        input.emittedBy,
        input.previousHash,
      ]),
    )
    .digest('hex');
}

export class ExecutionEventService {
  constructor(private readonly db: EventDb) {}

  async append(input: AppendInput): Promise<AppendedEvent> {
    if (!isExecutionEventType(input.type)) {
      throw new RegistryRefusedError(
        'unsupported_contract_version',
        `"${input.type}" is not in the 29-event vocabulary.`,
      );
    }

    return this.db.$transaction(async (tx) => {
      // Replay first. A retry after a lost response must return the ORIGINAL
      // event, not append a second one with a new sequence.
      const existing = await tx.$queryRawUnsafe<EventRow[]>(
        `SELECT * FROM "execution_events" WHERE "workspaceId" = $1 AND "idempotencyKey" = $2`,
        input.workspaceId,
        input.idempotencyKey,
      );
      if (existing.length > 0) {
        const original = existing[0]!;
        // Same key, different content is a client bug, not a replay. Returning
        // the original would silently discard the new event.
        if (original.executionId !== input.executionId || original.type !== input.type) {
          throw new RegistryRefusedError(
            'idempotency_conflict',
            'This idempotency key was already used for a different event.',
          );
        }
        return toAppended(original, true);
      }

      // Serialise appends to THIS execution. Different executions do not block
      // each other, because the lock is on their own root row.
      const locked = await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "executions" WHERE "id" = $1 AND "workspaceId" = $2 FOR UPDATE`,
        input.executionId,
        input.workspaceId,
      );
      if (locked.length === 0) {
        throw new RegistryRefusedError(
          'identity_not_resolvable',
          'No such execution in this workspace.',
        );
      }

      const head = await tx.$queryRawUnsafe<{ sequence: number; integrityHash: string; type: string }[]>(
        `SELECT "sequence","integrityHash","type" FROM "execution_events"
          WHERE "executionId" = $1 ORDER BY "sequence" DESC LIMIT 1`,
        input.executionId,
      );
      const currentSequence = head[0]?.sequence ?? 0;

      // Optimistic concurrency for a connected append. A mismatch appends
      // nothing at all — not a retry at the new head, which would silently
      // reorder the caller's intent.
      if (input.expectedSequence !== undefined && input.expectedSequence !== currentSequence) {
        throw new RegistryRefusedError(
          'sequence_conflict',
          `Expected sequence ${input.expectedSequence} but the stream is at ${currentSequence}.`,
        );
      }

      if (classOf(input.type) === 'lifecycle') {
        const terminal = await tx.$queryRawUnsafe<{ type: string }[]>(
          `SELECT "type" FROM "execution_events"
            WHERE "executionId" = $1 AND "class" = 'lifecycle'`,
          input.executionId,
        );
        const closed = terminal.find((e) => isTerminalLifecycleEvent(e.type as ExecutionEventType));
        if (closed !== undefined) {
          throw new RegistryRefusedError(
            'lifecycle_terminal',
            `This execution is ${closed.type}; no further lifecycle event may be recorded. ` +
              'Governance, comments and reconciliation continue.',
          );
        }
      } else if (!permittedAfterTerminal(input.type)) {
        // Unreachable while the vocabulary holds. Kept so a future class that
        // should be blocked cannot slip through by being non-lifecycle.
        throw new RegistryRefusedError('lifecycle_terminal', `"${input.type}" is not permitted here.`);
      }

      const sequence = currentSequence + 1;
      const id = randomUUID();
      const integrityHash = hashEvent({
        executionId: input.executionId,
        sequence,
        type: input.type,
        payload: input.payload,
        occurredAt: input.occurredAt,
        emittedBy: input.emittedBy,
        previousHash: head[0]?.integrityHash ?? '',
      });

      await tx.$executeRawUnsafe(
        `INSERT INTO "execution_events"
           ("id","workspaceId","executionId","sequence","localSequence","class","type","payload",
            "occurredAt","emittedBy","idempotencyKey","integrityHash")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::timestamp,$10,$11,$12)`,
        id,
        input.workspaceId,
        input.executionId,
        sequence,
        input.localSequence ?? null,
        classOf(input.type),
        input.type,
        JSON.stringify(input.payload),
        input.occurredAt,
        input.emittedBy,
        input.idempotencyKey,
        integrityHash,
      );

      const written = await tx.$queryRawUnsafe<EventRow[]>(
        `SELECT * FROM "execution_events" WHERE "id" = $1`,
        id,
      );
      return toAppended(written[0]!, false);
    });
  }

  /** The authoritative stream, in sequence order. */
  async history(workspaceId: string, executionId: string): Promise<readonly AppendedEvent[]> {
    const rows = await this.db.$queryRawUnsafe<EventRow[]>(
      `SELECT * FROM "execution_events"
        WHERE "workspaceId" = $1 AND "executionId" = $2 ORDER BY "sequence"`,
      workspaceId,
      executionId,
    );
    return rows.map((r) => toAppended(r, false));
  }

  /**
   * Whether the recorded stream is gapless and correctly chained.
   *
   * Used by the replay test rather than by the write path: the write path
   * cannot create a gap, and this proves that claim against what is actually
   * stored rather than against the logic that stored it.
   */
  async verify(workspaceId: string, executionId: string): Promise<{ gapless: boolean; chained: boolean }> {
    const rows = await this.db.$queryRawUnsafe<EventRow[]>(
      `SELECT * FROM "execution_events"
        WHERE "workspaceId" = $1 AND "executionId" = $2 ORDER BY "sequence"`,
      workspaceId,
      executionId,
    );
    let previousHash = '';
    let chained = true;
    rows.forEach((row, i) => {
      const expected = hashEvent({
        executionId: row.executionId,
        sequence: row.sequence,
        type: row.type,
        payload: row.payload,
        occurredAt: iso(row.occurredAt),
        emittedBy: row.emittedBy,
        previousHash,
      });
      if (expected !== row.integrityHash) chained = false;
      previousHash = row.integrityHash;
      void i;
    });
    const gapless = rows.every((row, i) => row.sequence === i + 1);
    return { gapless, chained };
  }
}
