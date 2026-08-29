/**
 * `T1165` (EPIC-033 Phase 9) — the Requirement Room's six stage handlers.
 *
 * `FR-GEL-007`: a configuration naming a stage with no registered handler fails
 * to load. Until this file existed the registry was empty, so **every** workflow
 * file was refused and `declareObject` refused every type by name — the state
 * `T1164` pins.
 *
 * ## What a handler here may and may not do
 *
 * `enter` runs **as the object arrives** at a stage. It is not the place any
 * decision is taken: `FR-RQR-041` and the `decided_by_a_human` constraint put
 * the Decide gate in the database and in `EPIC-030`'s adjudication, and a
 * handler returning `{ ok: true }` from `Decide` decides nothing — it records
 * that the object may occupy the stage.
 *
 * `stage-registry.ts` puts the danger precisely: *a no-op `Decide` handler is an
 * auto-approval wearing a placeholder's name.* That is a warning about
 * **substituting** for a missing handler, not about a handler that admits entry
 * and leaves the gate where the gate lives. The gates for this workflow are
 * declared in `packages/loop-contract/workflows/requirement-room.json`
 * (`requirement-room.clarifications-resolved`, `requirement-room.human-decision`,
 * `requirement-room.evidence-complete`) and evaluated by `EPIC-021`'s gate port,
 * which refuses when absent (`FR-GEL-062`). None of that is re-implemented here,
 * and none of it may be.
 *
 * ## Six, and only six
 *
 * `Execute` and `Verify` are **not** registered. The Requirement Room does not
 * have them (`R-033-6`), `T403v` proves an object of this type cannot be moved
 * along another Room's path, and `T405i` proves they render as *omitted* rather
 * than vanishing. Adding them here to "be safe" would quietly make the Room a
 * superset of itself.
 */
import type { StageHandler, TransitionContext, StageResult } from '@pmi/loop-contract';

/**
 * The Room's stages, in the order `requirement-room.json` declares them.
 *
 * Named as a constant so the workflow file and this list can be compared by a
 * test rather than by a reader — `T1164` asserts the file loads, which is only
 * true while the two agree.
 */
export const REQUIREMENT_ROOM_STAGES = Object.freeze([
  'Event',
  'Context',
  'Analyze',
  'Decide',
  'Evidence',
  'Outcome',
] as const);

/**
 * Admits entry and records nothing else.
 *
 * Every stage's work in this Room already belongs to a service that owns it —
 * intake, clarification, analysis, decision, baseline — and each is reached
 * through the Room's own routes. A handler that duplicated any of that would be
 * a second place the same thing happens, which is the `FR-RQR-002` mistake one
 * level down.
 */
function admits(stage: (typeof REQUIREMENT_ROOM_STAGES)[number]): StageHandler {
  return {
    stage,
    async enter(_ctx: TransitionContext): Promise<StageResult> {
      return { ok: true };
    },
  };
}

/**
 * Supplied to `LoopModule.register` at the composition root, never registered by
 * import side-effect: `StageRegistry` throws on a duplicate stage, and a
 * registry populated by module load order would make *which* duplicate an
 * accident of file naming.
 */
export const REQUIREMENT_ROOM_STAGE_HANDLERS: readonly StageHandler[] = Object.freeze(
  REQUIREMENT_ROOM_STAGES.map(admits),
);
