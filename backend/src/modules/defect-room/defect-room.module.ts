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
import { ChangeRoomModule } from '../change-room/change-room.module.js';
import { ChangeIntakeService } from '../change-room/intake.service.js';
import { RequirementRoomModule } from '../requirement-room/requirement-room.module.js';
import { IntakeService as RequirementIntakeService } from '../requirement-room/intake.service.js';
import { prismaClient } from '../../persistence/prisma.js';
import { DefectRoomController } from './defect-room.controller.js';
import { InMemoryDefectRoomStore, type DefectRoomStore } from './defect-room.store.js';
import {
  PrismaDefectRoomStore,
  PrismaEscapeStore,
  type DefectRoomPrismaClient,
} from './defect-room.store.prisma.js';
import { DEFECT_ROOM_PORTS, DEFECT_ROOM_STORE } from './defect-room.tokens.js';
import { DefectRoutingService, RoutingResolver } from './routing.service.js';
import { DefectIntakeService } from './intake.service.js';
import { RepairService } from './repair.service.js';
import {
  DefectAnalyticsService,
  DefectBlockersService,
  InMemoryEscapeStore,
  type EscapeStore,
} from './analytics.service.js';
import { EvidenceCheckService } from './evidence-check.service.js';
import { TriageService } from './triage.service.js';
import { DefectTestService } from './defect-test.service.js';
import { ReproductionService } from './reproduction.service.js';
import { VerificationService } from './verification.service.js';

/** Resolvable proof the module is in the graph — `T997v` asks for it by name. */
export class DefectRoomService {
  /** The ports this Room declares, and what each absence does. */
  readonly ports = DEFECT_ROOM_PORTS;

  /** The workflow type this Room is, per `defect-room.json` (`FR-DFR-001`). */
  readonly workflowType = 'defect-room';
}

@Module({
  // The two destinations `FR-DFR-071` and `FR-DFR-076` name. Imported, not
  // reimplemented — `FR-DFR-002`.
  imports: [ChangeRoomModule, RequirementRoomModule],
  controllers: [DefectRoomController],
  providers: [
    { provide: DefectRoomService, useFactory: (): DefectRoomService => new DefectRoomService() },
    {
      provide: DEFECT_ROOM_STORE,
      // `T1178`'s lesson, applied in the commit that first needs it rather than
      // in a later remediation: `DATABASE_URL` decides, as it does for
      // `CHANGE_ROOM_STORE` and `REQUIREMENT_ROOM_STORE`. Unset in unit tests,
      // so the in-memory store stays their default and only theirs.
      useFactory: (): DefectRoomStore =>
        process.env['DATABASE_URL']
          ? new PrismaDefectRoomStore(prismaClient() as unknown as DefectRoomPrismaClient)
          : new InMemoryDefectRoomStore(),
    },
    {
      provide: DefectAnalyticsService,
      /**
       * `FR-DFR-082` — persistent for the same reason the defect store is.
       *
       * This row is written at intake and read months later by whoever asks
       * where defects come from. Backed by memory, that question is answered
       * with whatever arrived since the last restart: a number that looks like
       * data and is not, which is worse than no answer at all.
       */
      useFactory: (): DefectAnalyticsService => {
        const store: EscapeStore = process.env['DATABASE_URL']
          ? new PrismaEscapeStore(prismaClient() as unknown as DefectRoomPrismaClient)
          : new InMemoryEscapeStore();
        return new DefectAnalyticsService(store);
      },
    },
    {
      provide: DefectBlockersService,
      /**
       * `FR-DFR-093` — takes the defect store, never the escape store.
       *
       * The two services share a file and nothing else. Escape aggregation
       * cannot reach the defect table, which is what stops it growing a join
       * the day somebody wants severity broken down by state.
       */
      useFactory: (store: DefectRoomStore): DefectBlockersService =>
        new DefectBlockersService(store),
      inject: [DEFECT_ROOM_STORE],
    },
    {
      provide: DefectIntakeService,
      /**
       * `FR-DFR-010`-`FR-DFR-013`, bound with no port unfilled.
       *
       * Intake depends on nothing outside this Room, which is why it works end
       * to end while most of the Room refuses. That is not an accident of
       * scheduling: a Room whose front door needed `EPIC-033` to be reachable
       * would drop the monitoring report at three in the morning, and
       * `BR-0051` counts exactly those.
       */
      useFactory: (store: DefectRoomStore, analytics: DefectAnalyticsService): DefectIntakeService =>
        new DefectIntakeService(store, analytics),
      inject: [DEFECT_ROOM_STORE, DefectAnalyticsService],
    },
    {
      provide: RepairService,
      /**
       * `FR-DFR-050` — bound with **both** its ports unfilled, and that is the
       * honest state rather than an oversight.
       *
       * `RepairTaskPort`'s only permitted backing is `EPIC-012`'s
       * `TaskStore.createMany` (`R-035-2`), and `TASK_STORE` is bound in
       * `tasks.module.ts` to `InMemoryTaskStore`. Wiring to it would create
       * repair tasks that vanish on restart — `T1178`'s failure, in the one
       * place where the record IS that somebody was asked to fix something.
       * Refusing is worse for nobody and honest about what exists.
       *
       * `ChainLinkPort` needs `EPIC-011`'s writer through an adapter this Epic
       * has no route to exercise while the first port refuses.
       */
      useFactory: (store: DefectRoomStore): RepairService => new RepairService(store),
      inject: [DEFECT_ROOM_STORE],
    },
    {
      provide: TriageService,
      /**
       * Bound with `BaselineReader` **unfilled**, which is the honest state.
       *
       * `EPIC-033` owns approved behaviour and does not expose a reader in this
       * deployment yet. Until it does, every triage refuses and names the Epic
       * that owes the binding — because the alternative is the one mistake this
       * service is arranged to prevent: *"I could not look"* recorded as
       * *"no approved behaviour exists"*, which files a requirement gap against
       * a requirement that may well already exist (`FR-DFR-021`, `FR-GEL-062`).
       *
       * A permissive default here would be invisible at the call site and
       * wrong in the same direction every time.
       */
      useFactory: (store: DefectRoomStore, repairs: RepairService): TriageService =>
        // `US7` scenario 4 — the orphan port IS bound. Unbound, a
        // reclassification would leave repair tasks pointing at a defect that
        // no longer claims to be one, and a backlog item for a change nobody
        // approved gets worked with every artifact looking correct.
        new TriageService(store, undefined, repairs),
      inject: [DEFECT_ROOM_STORE, RepairService],
    },
    {
      provide: DefectTestService,
      useFactory: (store: DefectRoomStore): DefectTestService => new DefectTestService(store),
      inject: [DEFECT_ROOM_STORE],
    },
    {
      provide: ReproductionService,
      /**
       * Bound with `EvidenceStore` **unfilled** (`EPIC-032`).
       *
       * So every reproduction carrying evidence refuses, and none is stored
       * under this Room's access rules instead of the artifact's (`FR-DFR-033`,
       * `BR-0062`, `R-035-7`). This is the route where a user is encouraged to
       * paste a payload that reproduces a failure (`PP-008`); refusing is the
       * safe direction to be wrong in.
       */
      useFactory: (store: DefectRoomStore): ReproductionService =>
        new ReproductionService(store, undefined),
      inject: [DEFECT_ROOM_STORE],
    },
    {
      provide: VerificationService,
      /**
       * Bound with **both** seams unfilled, and they are unfilled for different
       * reasons.
       *
       * `TestExecution` has no owner at all (`R-035-1`): `BR-0080` is a gate on
       * promotion, `EPIC-015` built that gate rather than a service, and
       * nothing in the programme exposes a callable runner. `EPIC-011`'s chain
       * source exists but is not wired into this Room's graph yet.
       *
       * Either absence refuses, and neither degrades: an unknown regression set
       * and an empty one must not behave alike (`FR-DFR-064`), and *"we could
       * not run the tests"* must never resolve to *"the tests passed"*
       * (`BR-0144`).
       */
      useFactory: (store: DefectRoomStore, tests: DefectTestService): VerificationService =>
        new VerificationService(store, tests, undefined, undefined),
      inject: [DEFECT_ROOM_STORE, DefectTestService],
    },
    {
      provide: DefectRoutingService,
      /**
       * `T999v` (Phase Z) — **both destinations bound**, which they were not
       * when this Room was built.
       *
       * The comment this replaces said both inbound routes were real and
       * neither was wired. `T338u`/`T338v` had in fact landed in `EPIC-033`,
       * and `EPIC-034`'s `fromDefectTransfer` with them — so by closure the
       * refusal was no longer honest, only untouched. Exit Criterion 5 asks for
       * all three outcomes routed end to end, and the fallback it allows
       * ("record the refusal") applies where the route does not exist. Both do.
       *
       * Adapted rather than passed through: `gapIntake` answers with `EPIC-033`'s
       * candidate rows and this Room's port asks only for an id. Narrowing here
       * keeps the two Rooms' shapes independent — the alternative is this Room
       * following every change to a return type it does not own.
       *
       * `SC-DFR-010` still governs what happens when a destination fails: an
       * empty answer refuses rather than recording a routing nothing received.
       */
      useFactory: (
        store: DefectRoomStore,
        change: ChangeIntakeService,
        requirement: RequirementIntakeService,
      ): DefectRoutingService =>
        new DefectRoutingService(store, {
          changeIntake: {
            async fromDefectTransfer(input) {
              return { id: (await change.fromDefectTransfer(input)).id };
            },
          },
          requirementIntake: {
            async gapIntake(input) {
              const candidates = await requirement.gapIntake(input);
              const first = candidates[0];
              if (!first) {
                // `EPIC-033` accepted the intake and produced nothing. Refusing
                // is the honest answer: `SC-DFR-010` says nothing is recorded as
                // routed to a destination that never received it, and an
                // invented id would record exactly that.
                throw new Error(
                  'EPIC-033 gap intake returned no candidate, so nothing received this gap',
                );
              }
              return { id: first.id };
            },
          },
        }),
      inject: [DEFECT_ROOM_STORE, ChangeIntakeService, RequirementIntakeService],
    },
    {
      provide: EvidenceCheckService,
      /**
       * No seams at all, and none missing.
       *
       * Everything this service needs is recorded in this Room: the passing
       * run, the reproducibility, and the path a person chose. That it depends
       * on nothing external is why `ADR-0016`'s failure mode can be closed
       * here rather than waited on.
       */
      useFactory: (store: DefectRoomStore): EvidenceCheckService =>
        new EvidenceCheckService(store),
      inject: [DEFECT_ROOM_STORE],
    },
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
      /**
       * Constructed with **no delivery ports**, and that stays true.
       *
       * This resolver is the generic destination-delivery surface; the two real
       * inbound routes are bound on `DefectRoutingService` below, which is
       * where `FR-DFR-071` and `FR-DFR-076` actually go.
       */
      useFactory: (): RoutingResolver => new RoutingResolver({}),
    },
  ],
  exports: [
    DefectIntakeService,
    RepairService,
    DefectBlockersService,
    DefectAnalyticsService,
    DefectRoomService,
    RoutingResolver,
    DefectRoutingService,
    EvidenceCheckService,
    TriageService,
    DefectTestService,
    ReproductionService,
    VerificationService,
    DEFECT_ROOM_STORE,
  ],
})
export class DefectRoomModule {}
