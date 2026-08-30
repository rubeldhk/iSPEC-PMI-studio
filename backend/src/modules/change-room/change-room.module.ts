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
import { prismaClient } from '../../persistence/prisma.js';
import { ChangeRoomController } from './change-room.controller.js';
import {
  ImpactComposer,
  type ArchitectureDecisionPort,
  type ImpactPort,
  type TraversalPort,
} from './impact.composer.js';
import { ChangeIntakeService } from './intake.service.js';
import { OptionsService } from './options.service.js';
import { CHANGE_ROOM_PORTS, CHANGE_ROOM_STORE } from './change-room.tokens.js';
import { InMemoryChangeRoomStore, type ChangeRoomStore } from './change-room.store.js';
import {
  PrismaChangeRoomStore,
  type ChangeRoomPrismaClient,
} from './change-room.store.prisma.js';

/** Resolvable proof the module is in the graph — `T406u` asks for it by name. */
export class ChangeRoomService {
  /** The ports this Room declares, and what each absence does. */
  readonly ports = CHANGE_ROOM_PORTS;

  /** The workflow type this Room is, per `change-room.json` (`FR-CHR-001`). */
  readonly workflowType = 'change-room';
}

@Module({
  controllers: [ChangeRoomController],
  providers: [
    { provide: ChangeRoomService, useFactory: (): ChangeRoomService => new ChangeRoomService() },
    {
      provide: CHANGE_ROOM_STORE,
      // `T1178`'s lesson, applied in the commit that first needs it rather than
      // in a later remediation: `DATABASE_URL` decides, as it does for
      // `REQUIREMENT_ROOM_STORE` and `LOOP_STORE`. Unset in unit tests, so the
      // in-memory store stays their default and only theirs.
      useFactory: (): ChangeRoomStore =>
        process.env['DATABASE_URL']
          ? new PrismaChangeRoomStore(prismaClient() as unknown as ChangeRoomPrismaClient)
          : new InMemoryChangeRoomStore(),
    },
    {
      provide: ImpactComposer,
      /**
       * `T996q` — bound with its three seams **unfilled**, on purpose.
       *
       * `ImpactSource` is the one port of the six that degrades rather than
       * refuses (`FR-CHR-032`): an unreachable dependency graph means nobody
       * could see the blast radius, which is a fact a decision-maker can weigh
       * provided they are told. So each of these throws with a sentence naming
       * the Epic that owes it, and the composer turns that into eight `unknown`
       * areas carrying the sentence.
       *
       * They are not fixtures and not defaults. A fixture would answer; these
       * decline to, in writing. The difference matters because the alternative
       * — an adapter returning an empty map — reads on screen as eight areas
       * checked and found clean, which is the one answer nobody is entitled to
       * give here.
       */
      useFactory: (): ImpactComposer => {
        const unbound = (port: string, epic: string) => (): never => {
          throw new Error(`no ${port} is bound in this deployment (${epic} supplies it)`);
        };
        const impact: ImpactPort = { impactFor: unbound('ImpactSource', 'EPIC-020') };
        const traversal: TraversalPort = {
          reachableFrom: unbound('ChainTraversal', 'EPIC-011'),
        };
        const decisions: ArchitectureDecisionPort = {
          decisionsTouchedBy: unbound('ArchitectureDecisionSource', 'EPIC-016'),
        };
        return new ImpactComposer(impact, traversal, decisions);
      },
    },
    {
      provide: OptionsService,
      /**
       * `T996x` — constructed with **no binding**, which is the honest state.
       *
       * `EPIC-028` supplies the `AgentGateway` and `EPIC-024` the session; until
       * they do, `generate` returns no options and says why. It does not invent
       * a second option to satisfy `FR-CHR-040`'s count, and it does not refuse
       * either — an unavailable model would otherwise block every change,
       * including the ones a model outage has nothing to do with.
       */
      useFactory: (): OptionsService => new OptionsService(undefined),
    },
    {
      provide: ChangeIntakeService,
      inject: [CHANGE_ROOM_STORE],
      useFactory: (store: ChangeRoomStore): ChangeIntakeService => new ChangeIntakeService(store),
    },
    // `ImpactComposer` is constructed where its two ports are bound. Exported as
    // a type for now; `EPIC-020`'s adapter arrives with the user-story phases.
  ],
  exports: [ChangeRoomService, ChangeIntakeService, ImpactComposer, OptionsService],
})
export class ChangeRoomModule {}

export { ImpactComposer };
