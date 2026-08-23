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
import type { LoopStage, TransitionOutcome } from '@pmi/loop-contract';

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

export interface LoopStore {
  createObject(input: CreateObjectInput): Promise<LoopObjectRow>;
  findObject(id: string): Promise<LoopObjectRow | null>;
  appendTransition(row: Omit<LoopTransitionRow, 'id' | 'occurredAt'>): Promise<LoopTransitionRow>;
  transitionsFor(objectId: string): Promise<readonly LoopTransitionRow[]>;
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

  async findObject(id: string): Promise<LoopObjectRow | null> {
    return this.#objects.get(id) ?? null;
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
}
