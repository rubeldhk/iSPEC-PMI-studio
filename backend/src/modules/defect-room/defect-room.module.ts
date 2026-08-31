/**
 * `T997x` (EPIC-035) — the Defect Room module.
 *
 * Registered in `app.module.ts`, which is the whole point. `T997v` exists to
 * prove the wiring, and `DEF-005-001` is what a module built, tested and never
 * registered looks like: fifteen of fifteen tasks green and the feature
 * unreachable in the running application.
 *
 * `EPIC-034` then found four more of the same class at its convergence pass —
 * services registered in no module, with passing unit tests throughout. The
 * question that found them was *which capabilities have a caller*, not *which
 * have a test*.
 *
 * ## What is bound, and what deliberately is not
 *
 * The nine ports (`defect-room.tokens.ts`) are **not** bound here. Eight refuse
 * when absent and one degrades, and both behaviours are the honest state until
 * their Epics supply them — the same posture `loop.module.ts` and
 * `change-room.module.ts` take.
 *
 * Two of the nine have no owner at all. `TestExecution` has none because no
 * callable test-execution surface exists anywhere in the programme, and
 * `RepairTaskPort` has none because `TaskRecord` carries no provenance field.
 * Binding a permissive default for either would be invisible at every call
 * site, which is `FR-GEL-062`'s objection — and for `TestExecution` it would
 * mean a fix accepted with nothing having demonstrated the defect.
 *
 * The stage handlers are supplied through the composition root
 * (`composition/governed-loop.ts`) rather than here, because `LoopModule` is
 * registered once for every Room and a second registration would be a second
 * loop with its own store.
 */
import { Module } from '@nestjs/common';
import { DEFECT_ROOM_PORTS } from './defect-room.tokens.js';
import { RoutingResolver } from './routing.service.js';

/** Resolvable proof the module is in the graph — `T997v` asks for it by name. */
export class DefectRoomService {
  /** The ports this Room declares, and what each absence does. */
  readonly ports = DEFECT_ROOM_PORTS;

  /** The workflow type this Room is, per `defect-room.json` (`FR-DFR-001`). */
  readonly workflowType = 'defect-room';
}

@Module({
  providers: [
    { provide: DefectRoomService, useFactory: (): DefectRoomService => new DefectRoomService() },
    {
      provide: RoutingResolver,
      /**
       * Constructed with **no destination ports**, which is the honest state.
       *
       * `EPIC-034`'s change intake and `EPIC-033`'s gap intake are both real
       * routes now, but neither is bound in this deployment. Until they are,
       * `route` returns `routed: false` naming the Epic that owes the binding —
       * and nothing is recorded as routed to a destination that never received
       * it (`SC-DFR-010`).
       */
      useFactory: (): RoutingResolver => new RoutingResolver({}),
    },
  ],
  exports: [DefectRoomService, RoutingResolver],
})
export class DefectRoomModule {}
