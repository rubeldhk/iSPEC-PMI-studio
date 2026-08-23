/**
 * T924 — transition results and the progress projection.
 * `FR-GEL-008`, `FR-GEL-013`, `FR-GEL-014`, `FR-GEL-050`, `FR-GEL-051`.
 */

import { LOOP_STAGES, type LoopStage } from './stages.js';
import type { ActorRef, GateOutcome, LoopObjectRef } from './ports.js';

/**
 * `FR-GEL-014` — **there is no throw path for a governed refusal.**
 *
 * Five outcomes, each a value the caller receives and the loop records. An
 * exception would be the wrong shape twice over: a `catch` can swallow it, and
 * the thing most worth keeping — *why* the transition did not happen — is
 * exactly what does not survive being thrown.
 *
 * `conflict` and `refused` are separate deliberately. The first is the
 * optimistic-concurrency loser (`R-030-1`, HTTP `409`); the second is missing
 * authority (HTTP `403`). Collapsing them would make two different events
 * indistinguishable in the history `FR-GEL-013` promises is sufficient to
 * reconstruct the loop.
 */
export const TRANSITION_OUTCOMES = Object.freeze([
  'accepted',
  'refused',
  'conflict',
  'exception',
  'violation',
] as const);

export type TransitionOutcome = (typeof TRANSITION_OUTCOMES)[number];

export function isTransitionOutcome(candidate: string): candidate is TransitionOutcome {
  return (TRANSITION_OUTCOMES as readonly string[]).includes(candidate);
}

export interface TransitionResult {
  readonly outcome: TransitionOutcome;
  /** Always present, including on a refusal — the refusal is what got recorded. */
  readonly transitionId: string;
  readonly object: LoopObjectRef;
  readonly fromStage: LoopStage;
  readonly toStage: LoopStage;
  readonly actor: ActorRef;
  /** The version the object holds after this call, for the caller's next OCC token. */
  readonly version: number;
  readonly gates: readonly GateOutcome[];
  /** Why, in the caller's terms. Required on anything but `accepted`. */
  readonly detail?: string;
}

// ───────────────────────────────────────────────────────────── the projection

export const STAGE_STATUSES = Object.freeze(['done', 'current', 'pending'] as const);

export type StageStatus = (typeof STAGE_STATUSES)[number];

export interface LoopProgress {
  readonly stage: LoopStage;
  readonly status: StageStatus;
  /**
   * `FR-GEL-008` — the workflow type does not use this stage.
   *
   * A separate flag rather than a fourth status, because *omitted* answers a
   * different question from *how far has this got*: an omitted stage is
   * `pending` forever and saying so keeps the two facts from being conflated.
   */
  readonly omitted: boolean;
}

export interface ProgressInput {
  readonly configuredStages: readonly LoopStage[];
  readonly currentStage: LoopStage;
  readonly completedStages: readonly LoopStage[];
}

/**
 * `FR-GEL-050`, `FR-GEL-051` — computed, never stored.
 *
 * Returns **all eight stages, in model order, for every workflow type**, so a
 * consumer needs no per-type translation and a Room cannot render a shorter loop
 * than the one the model defines. Stages the type does not configure come back
 * `omitted: true` and `pending`, which is the distinction `FR-GEL-008` asks for:
 * *configured not to apply* is visible, and *not reached* is visible, and they
 * do not look alike.
 */
export function projectProgress(input: ProgressInput): readonly LoopProgress[] {
  const configured = new Set<LoopStage>(input.configuredStages);
  const completed = new Set<LoopStage>(input.completedStages);

  return LOOP_STAGES.map((stage) => {
    if (!configured.has(stage)) {
      // An omitted stage is never `done` and never `current`: it was not
      // skipped past, it was never part of this workflow type's loop.
      return { stage, status: 'pending' as const, omitted: true };
    }
    if (completed.has(stage)) return { stage, status: 'done' as const, omitted: false };
    if (stage === input.currentStage) return { stage, status: 'current' as const, omitted: false };
    return { stage, status: 'pending' as const, omitted: false };
  });
}
