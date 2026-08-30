/**
 * `T406w` (EPIC-034) — the Change Room's seven stage handlers.
 *
 * `FR-GEL-007`: a configuration naming a stage with no registered handler fails
 * to load — and `buildConfigRegistry` refuses **every** workflow file when any
 * one of them is unloadable, not just the offender.
 *
 * That is not a detail. Adding `change-room.json` with a `Verify` stage, before
 * these handlers existed, took the **Requirement Room** down with it: every
 * workflow type refused, and `declareObject` answered `500` for all of them.
 * `T1164` predicted it in as many words — *"if that file ever adds `Execute`,
 * this says so rather than the Room mysteriously failing to declare"* — and
 * that is precisely how it was caught.
 *
 * ## Seven, not six
 *
 * The Change Room omits `Execute` and uses `Verify`, where the Requirement Room
 * omits both. Each Room declares the stages it uses and no more; the union is
 * what has to be registered, and `StageRegistry` throws on a duplicate so two
 * Rooms claiming one stage is a loud failure at composition rather than a
 * silent winner.
 */
import type { StageHandler, TransitionContext, StageResult } from '@pmi/loop-contract';

/** The stages `change-room.json` declares, in its order. */
export const CHANGE_ROOM_STAGES = Object.freeze([
  'Event',
  'Context',
  'Analyze',
  'Decide',
  'Verify',
  'Evidence',
  'Outcome',
] as const);

/**
 * The stages this Room needs that the Requirement Room does not register.
 *
 * Only the difference is exported for composition: `StageRegistry` refuses a
 * duplicate, so contributing all seven would fail the moment both Rooms are
 * registered together.
 */
export const CHANGE_ROOM_ONLY_STAGES = Object.freeze(['Verify'] as const);

/**
 * Admits entry and records nothing else.
 *
 * The gates named in `change-room.json` — `impact-snapshotted`,
 * `human-decision`, `baseline-rebased`, `evidence-complete` — are evaluated by
 * `EPIC-021`'s gate port, which refuses when absent (`FR-GEL-062`). None of that
 * is re-implemented here, and none of it may be: a handler that decided its own
 * gate would be an auto-approval wearing a placeholder's name.
 */
function admits(stage: (typeof CHANGE_ROOM_STAGES)[number]): StageHandler {
  return {
    stage,
    async enter(_ctx: TransitionContext): Promise<StageResult> {
      return { ok: true };
    },
  };
}

/** Supplied to `LoopModule.register` at the composition root. */
export const CHANGE_ROOM_STAGE_HANDLERS: readonly StageHandler[] = Object.freeze(
  CHANGE_ROOM_ONLY_STAGES.map((stage) => admits(stage)),
);
