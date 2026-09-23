/**
 * `T1165` — the one configured `LoopModule`, called once.
 *
 * ## Why this file exists at all
 *
 * Nest keys a dynamic module by its metadata, so `LoopModule.register(a)` and
 * `LoopModule.register(b)` are two module instances — two `LoopService`s and,
 * because `LOOP_STORE` defaults to `InMemoryLoopStore`, **two stores**. An object
 * declared through one would be invisible to the other, and every test that used
 * a single path would pass.
 *
 * `LoopModule` has two importers — `AppModule` and `ExecutionsModule`, the
 * latter for exactly one token (`PROPOSAL_ADJUDICATOR`). Both take the constant
 * below, so there is one instance by identity. This is the shape the Nest
 * documentation uses for a dynamic module shared across importers: hoist the
 * call, import the result.
 *
 * ## Why it lives here rather than in either module
 *
 * It cannot live in `loop.module.ts`: `EPIC-030` would then import `EPIC-033`'s
 * handlers, and the loop would depend on one of its own workflow types.
 *
 * It cannot live in `requirement-room.module.ts` either, because `EPIC-037`
 * would have to import the Requirement Room to reach the adjudicator.
 *
 * So it is composition, and it sits at the composition root — which is where
 * `loop.module.ts` says the seams are filled: *"EPIC-031, EPIC-032, EPIC-021 and
 * EPIC-004 supply them by overriding the tokens at the composition root."*
 * `LOOP_STAGE_HANDLERS` is the same kind of seam; it simply had no mechanism
 * until `T1165`.
 *
 * ## Adding a Room
 *
 * `EPIC-034` and `EPIC-035` append their handlers to the array below. They must
 * not each call `register` — that is the two-instance bug this file exists to
 * prevent — and `StageRegistry` throws on a duplicate stage, so two Rooms
 * claiming one stage is a loud failure at composition rather than a silent
 * winner.
 */
import type { DynamicModule } from '@nestjs/common';
import { LoopModule } from '../modules/loop/loop.module.js';
import { REQUIREMENT_ROOM_STAGE_HANDLERS } from '../modules/requirement-room/stage-handlers.js';
import { CHANGE_ROOM_STAGE_HANDLERS } from '../modules/change-room/stage-handlers.js';
import { DEFECT_ROOM_STAGE_HANDLERS } from '../modules/defect-room/stage-handlers.js';

/**
 * The governed loop, configured with every Room's stage handlers.
 *
 * A module-level constant, evaluated once when this file is first imported.
 */
export const GOVERNED_LOOP: DynamicModule = LoopModule.register({
  // Every Room's stages, unioned. `buildConfigRegistry` refuses EVERY workflow
  // file when any one names an unregistered stage, so a Room added here without
  // its handlers takes the others down with it — which is exactly what adding
  // `change-room.json` did before `T406w`, and what `T1164` caught.
  //
  // The Change Room contributes only the stages the Requirement Room does not
  // already register: `StageRegistry` throws on a duplicate, and that throw is
  // the guard against two Rooms silently claiming one stage.
  //
  // The Defect Room contributes `Execute` — the eighth stage, which it is
  // the only Room to use. A defect's repair is real work rather than a
  // decision, so the stage belongs here and not in the other two.
  stageHandlers: [
    ...REQUIREMENT_ROOM_STAGE_HANDLERS,
    ...CHANGE_ROOM_STAGE_HANDLERS,
    ...DEFECT_ROOM_STAGE_HANDLERS,
  ],
});
