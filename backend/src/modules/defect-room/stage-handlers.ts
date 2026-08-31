/**
 * `T997w`, `T997x` (EPIC-035) — the Defect Room's stage handlers.
 *
 * `FR-GEL-007`: a configuration naming a stage with no registered handler fails
 * to load — and `buildConfigRegistry` refuses **every** workflow file when any
 * one of them is unloadable, not just the offender.
 *
 * `EPIC-034` paid for that lesson. Adding `change-room.json` with a `Verify`
 * stage before its handlers existed took the **Requirement Room** down with it:
 * every workflow type refused, and `declareObject` answered `500` for all of
 * them. `T1164` had predicted it in as many words.
 *
 * ## Eight stages, and only one is new
 *
 * The Defect Room uses **all eight**. It is the only Room that does: a defect is
 * reported, understood, judged, repaired, verified and closed, and the repair is
 * real work rather than a decision — so `Execute` belongs here where it does not
 * belong in the other two.
 *
 * Between them the Requirement Room and Change Room already register seven.
 * This Room contributes only `Execute`, because `StageRegistry` throws on a
 * duplicate and that throw is the guard against two Rooms silently claiming one
 * stage's behaviour.
 *
 * ## What the transitions deliberately do not include
 *
 * There is **no transition from a passing reproduction run to a
 * classification** (`FR-DFR-044`, `R-035-6`). A green run routes to an evidence
 * check where a person picks one of three paths; reclassifying is one of them
 * and it is not what happens when nobody chooses. A transition here would make
 * the automatic reclassification a feature of the loop itself, where no
 * service-level guard could reach it.
 */
import type { StageHandler, TransitionContext, StageResult } from '@pmi/loop-contract';

/** The stages `defect-room.json` declares, in its order. */
export const DEFECT_ROOM_STAGES = Object.freeze([
  'Event',
  'Context',
  'Analyze',
  'Decide',
  'Execute',
  'Verify',
  'Evidence',
  'Outcome',
] as const);

/**
 * The stages this Room needs that no other Room registers.
 *
 * Only the difference is exported for composition: the Requirement Room and
 * Change Room already contribute the other seven between them, and
 * `StageRegistry` refuses a duplicate.
 */
export const DEFECT_ROOM_ONLY_STAGES = Object.freeze(['Execute'] as const);

/**
 * Admits entry and records nothing else.
 *
 * The gates named in `defect-room.json` — `behaviour-established`,
 * `human-classification`, `failing-test-on-record`, `routing-accepted`,
 * `repair-verified`, `evidence-complete` — are evaluated by `EPIC-021`'s gate
 * port, which refuses when absent (`FR-GEL-062`). None of that is this
 * handler's: a stage handler that evaluated its own gates would be the Room
 * deciding whether it may proceed.
 */
function admits(stage: (typeof DEFECT_ROOM_STAGES)[number]): StageHandler {
  return {
    stage,
    async enter(_ctx: TransitionContext): Promise<StageResult> {
      return { ok: true };
    },
  };
}

/** Supplied to `LoopModule.register` at the composition root. */
export const DEFECT_ROOM_STAGE_HANDLERS: readonly StageHandler[] = Object.freeze(
  DEFECT_ROOM_ONLY_STAGES.map((stage) => admits(stage)),
);
