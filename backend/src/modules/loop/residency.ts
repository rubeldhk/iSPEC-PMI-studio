/**
 * T976 — which stage, and for how long. `SC-GEL-006`, `PP-010`.
 *
 * PC-1: framework-free.
 *
 * *"Answerable without opening the object."*
 *
 * The question behind it is operational rather than governance: **where does
 * work stop moving?** A loop can be perfectly correct — every transition
 * authorised, every gate satisfied, every refusal recorded — and still have
 * every object sitting in `Decide` for eleven days because one approver is on
 * leave. Nothing in this Epic's other tests would notice, because nothing is
 * wrong.
 *
 * Derived from the transitions, like everything else here (`FR-GEL-013`). A
 * stored `enteredCurrentStageAt` column would be a second source that can
 * disagree with the history, and it would disagree in the direction that makes
 * a stalled object look fresh.
 */

import type { LoopStage } from '@pmi/loop-contract';
import type { LoopObjectRow, LoopTransitionRow } from './loop.store.js';

export interface StageResidency {
  readonly stage: LoopStage;
  /** When the object entered the stage it is in now. */
  readonly since: Date;
  readonly milliseconds: number;
}

export interface ResidencyInput {
  readonly object: Pick<LoopObjectRow, 'currentStage' | 'createdAt'>;
  readonly history: readonly LoopTransitionRow[];
  /** Injected rather than read from the clock, so a test can assert a duration. */
  readonly now: Date;
}

/**
 * How long the object has been where it is.
 *
 * `since` is the `occurredAt` of the most recent **accepted** transition into
 * the current stage — not the most recent transition of any kind. A refused
 * attempt does not reset the clock, and treating it as if it did would make an
 * object look freshly arrived every time someone tried to move it and failed,
 * which is exactly the object most worth noticing.
 *
 * With no accepted transition, the object has been at `Event` since it was
 * declared, so `createdAt` is the honest answer rather than `now`.
 */
export function residencyOf(input: ResidencyInput): StageResidency {
  const arrival = [...input.history]
    .filter((row) => row.outcome === 'accepted' && row.toStage === input.object.currentStage)
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0];

  const since = arrival?.occurredAt ?? input.object.createdAt;
  return {
    stage: input.object.currentStage,
    since,
    milliseconds: Math.max(0, input.now.getTime() - since.getTime()),
  };
}

/**
 * The aggregate `SC-GEL-006` asks for: how long work has been sitting, per
 * stage, across many objects.
 *
 * Returns a row for **every stage that holds an object**, and deliberately not
 * for stages that hold none — an empty stage has no residency, and a zero would
 * read as "objects here move instantly" rather than "nothing is here".
 */
export function residencyByStage(
  residencies: readonly StageResidency[],
): ReadonlyMap<LoopStage, { count: number; oldestMs: number; totalMs: number }> {
  const byStage = new Map<LoopStage, { count: number; oldestMs: number; totalMs: number }>();
  for (const residency of residencies) {
    const current = byStage.get(residency.stage) ?? { count: 0, oldestMs: 0, totalMs: 0 };
    byStage.set(residency.stage, {
      count: current.count + 1,
      // The OLDEST, not the mean. A stage where nine objects move in an hour and
      // one has been stuck for a month has an unremarkable average and one real
      // problem.
      oldestMs: Math.max(current.oldestMs, residency.milliseconds),
      totalMs: current.totalMs + residency.milliseconds,
    });
  }
  return byStage;
}
