/**
 * `T406w` (EPIC-034) — the Change Room module.
 *
 * Registered in `app.module.ts`, which is the whole point: `T406u` exists to
 * prove the wiring, and `DEF-005-001` is what a module built, tested and never
 * registered looks like — fifteen of fifteen tasks green and the feature
 * unreachable in the running application.
 *
 * ## What is bound, and what deliberately is not
 *
 * The six ports (`change-room.tokens.ts`) are **not** bound here. Five refuse
 * when absent and one degrades, and both behaviours are the honest state until
 * their Epics supply them — the same posture `loop.module.ts` takes with its
 * governance seams. Binding a permissive default would be invisible at every
 * call site, which is `FR-GEL-062`'s whole objection.
 *
 * The stage handlers are supplied through the composition root
 * (`composition/governed-loop.ts`) rather than here, because `LoopModule` is
 * registered once for every Room and a second registration would be a second
 * loop with its own store.
 */
import { Module } from '@nestjs/common';
import { ImpactComposer } from './impact.composer.js';
import { CHANGE_ROOM_PORTS } from './change-room.tokens.js';

/** Resolvable proof the module is in the graph — `T406u` asks for it by name. */
export class ChangeRoomService {
  /** The ports this Room declares, and what each absence does. */
  readonly ports = CHANGE_ROOM_PORTS;

  /** The workflow type this Room is, per `change-room.json` (`FR-CHR-001`). */
  readonly workflowType = 'change-room';
}

@Module({
  providers: [
    { provide: ChangeRoomService, useFactory: (): ChangeRoomService => new ChangeRoomService() },
    // `ImpactComposer` is constructed where its two ports are bound. Exported as
    // a type for now; `EPIC-020`'s adapter arrives with the user-story phases.
  ],
  exports: [ChangeRoomService],
})
export class ChangeRoomModule {}

export { ImpactComposer };
