/**
 * T945 — where loop objects and transitions live.
 *
 * PC-1: framework-free. The in-memory implementation is the default the module
 * wires; the Prisma-backed one is supplied by overriding `LOOP_STORE` at the
 * composition root, which is this repository's platform-wide seam.
 *
 * **Defaulting the store to in-memory is correct here, unlike defaulting a
 * policy provider.** The difference: an in-memory store loses data, which is
 * visible and testable. A default policy that permits is invisible — it looks
 * exactly like a policy that said yes — which is why `loop.module.ts` binds this
 * and deliberately binds none of the four governance seams.
 */

import { randomUUID } from 'node:crypto';
import type { LoopStage, TransactionHandle, TransitionOutcome } from '@pmi/loop-contract';

export interface LoopObjectRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly workflowType: string;
  /** `FR-GEL-006` — pinned at creation and never rewritten. */
  readonly configVersion: number;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly currentStage: LoopStage;
  /** `R-030-1` — the OCC token. */
  readonly version: number;
  readonly closedAt: Date | null;
  readonly createdAt: Date;
}

export interface LoopTransitionRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly objectId: string;
  readonly objectVersion: number;
  readonly fromStage: LoopStage | null;
  readonly toStage: LoopStage;
  readonly outcome: TransitionOutcome;
  readonly refusalReason: string | null;
  readonly wonBy: string | null;
  readonly actorId: string;
  readonly actorKind: 'human' | 'automation';
  readonly authorityBasis: string;
  readonly triggerRuleId: string | null;
  readonly triggerEventId: string | null;
  readonly configVersion: number;
  readonly gateOutcomes: unknown;
  readonly occurredAt: Date;
}

export interface CreateObjectInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly workflowType: string;
  readonly configVersion: number;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly currentStage: LoopStage;
}

export interface AdvanceInput {
  readonly id: string;
  /** `R-030-1` — the version the caller read the object at. */
  readonly expectedVersion: number;
  readonly toStage: LoopStage;
}

/** `X20` — what a caller may narrow a listing by. */
export interface ListObjectsQuery {
  /**
   * **Required, and first.** A list is the one read where a forgotten filter
   * returns more rather than failing, so the workspace is not optional and not
   * applied by the caller afterwards (`DEF-030-003`).
   */
  readonly workspaceId: string;
  readonly workflowType: string;
  /** Bounded by default — an index must not depend on a workspace staying small. */
  readonly limit?: number;
}

/** `X20`. Generous, and a cap rather than a page — paging is `T1066`'s. */
export const DEFAULT_LIST_LIMIT = 200;

export interface LoopStore {
  createObject(input: CreateObjectInput): Promise<LoopObjectRow>;
  findObject(id: string): Promise<LoopObjectRow | null>;
  /**
   * `X20` — the objects of one workflow type in one workspace, newest first.
   *
   * Added for `EPIC-033`'s Rooms index, which had no way to reach a Room without
   * already knowing its id. The alternative — listing from the Room's own
   * `roomObjectId` column — would miss a Room with no candidates yet and would
   * source the stage from outside the loop, which `FR-RQR-074` forbids.
   *
   * The Prisma implementation is a `findMany` with both fields in the `where`,
   * never a `findMany` filtered in application code: the filter belongs where it
   * cannot be forgotten by the next caller.
   */
  listObjects(query: ListObjectsQuery): Promise<readonly LoopObjectRow[]>;
  /**
   * `R-030-1` — conditional advance. Returns the updated row, or **null** when
   * the version moved.
   *
   * Null rather than a throw: losing an optimistic race is an ordinary outcome
   * with a governed answer (`conflict`, `FR-GEL-015`), and an exception would
   * make it look like a fault.
   *
   * The Prisma implementation is `updateMany({ where: { id, version }, data: {
   * currentStage, version: { increment: 1 } } })` and a count of 0 is the loss —
   * one statement, so there is no window between checking and writing.
   */
  advanceObject(input: AdvanceInput): Promise<LoopObjectRow | null>;
  appendTransition(
    row: Omit<LoopTransitionRow, 'id' | 'occurredAt'>,
    tx?: TransactionHandle,
  ): Promise<LoopTransitionRow>;
  transitionsFor(objectId: string): Promise<readonly LoopTransitionRow[]>;
  /**
   * `FR-GEL-041`, `R-030-2` — the transition and its audit record land together
   * or neither lands.
   *
   * The in-memory implementation really does roll back. A fake that ran the
   * callback and ignored failure would let `T957`'s fail-closed test pass over
   * behaviour the database does not have, which is worse than having no
   * in-memory store at all.
   */
  runInTransaction<T>(fn: (tx: TransactionHandle) => Promise<T>): Promise<T>;
}

/** In-memory store for tests and database-less runs. Mirrors `InMemoryTaskStore`. */
export class InMemoryLoopStore implements LoopStore {
  readonly #objects = new Map<string, LoopObjectRow>();
  readonly #transitions: LoopTransitionRow[] = [];

  async createObject(input: CreateObjectInput): Promise<LoopObjectRow> {
    const row: LoopObjectRow = {
      id: randomUUID(),
      ...input,
      version: 0,
      closedAt: null,
      createdAt: new Date(),
    };
    this.#objects.set(row.id, row);
    return row;
  }

  async listObjects(query: ListObjectsQuery): Promise<readonly LoopObjectRow[]> {
    const limit = query.limit ?? DEFAULT_LIST_LIMIT;
    return [...this.#objects.values()]
      .filter(
        (row) =>
          row.workspaceId === query.workspaceId && row.workflowType === query.workflowType,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async findObject(id: string): Promise<LoopObjectRow | null> {
    return this.#objects.get(id) ?? null;
  }

  async advanceObject(input: AdvanceInput): Promise<LoopObjectRow | null> {
    const current = this.#objects.get(input.id);
    // The whole condition in one read-and-write, mirroring the single
    // `updateMany` statement the Prisma store issues. A read, a check and a
    // separate write would open exactly the window OCC exists to close.
    if (!current || current.version !== input.expectedVersion) return null;
    const next: LoopObjectRow = {
      ...current,
      currentStage: input.toStage,
      version: current.version + 1,
    };
    this.#objects.set(next.id, next);
    return next;
  }

  async appendTransition(
    row: Omit<LoopTransitionRow, 'id' | 'occurredAt'>,
  ): Promise<LoopTransitionRow> {
    // Append-only in memory as well as in PostgreSQL. A store that permitted
    // rewriting here would let a unit test pass over behaviour the database
    // refuses, which is worse than having no in-memory store at all.
    const full: LoopTransitionRow = { ...row, id: randomUUID(), occurredAt: new Date() };
    this.#transitions.push(full);
    return full;
  }

  async transitionsFor(objectId: string): Promise<readonly LoopTransitionRow[]> {
    return this.#transitions.filter((t) => t.objectId === objectId);
  }

  /**
   * A real rollback, not a pass-through.
   *
   * Snapshots both collections, runs the callback, and restores on failure. It
   * costs a shallow copy and it buys the one thing a fake transaction cannot:
   * `T957`'s fail-closed assertion fails here for the same reason it would fail
   * against PostgreSQL.
   */
  async runInTransaction<T>(fn: (tx: TransactionHandle) => Promise<T>): Promise<T> {
    const objects = new Map(this.#objects);
    const transitions = [...this.#transitions];
    try {
      return await fn({ __loopTransaction: 'opaque' });
    } catch (error) {
      this.#objects.clear();
      for (const [k, v] of objects) this.#objects.set(k, v);
      this.#transitions.length = 0;
      this.#transitions.push(...transitions);
      throw error;
    }
  }
}
