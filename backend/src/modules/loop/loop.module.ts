/**
 * T935, T945 — loop module wiring.
 *
 * Services stay framework-free (PC-1). The four **governance** seams — policy,
 * evidence, gates, audit — are **not registered here**: `EPIC-031`, `EPIC-032`,
 * `EPIC-021` and `EPIC-004` supply them by overriding the tokens at the
 * composition root, which is the platform-wide pattern `DecisionsModule` uses.
 *
 * **The store defaults to in-memory and the governance seams default to
 * nothing, and the asymmetry is the point.** Every other module here defaults
 * its store, and that is right: an in-memory store loses data, which is visible
 * and testable. A default `PolicyProvider` that permits is invisible — it looks
 * exactly like a policy that said yes — so `FR-GEL-062` requires its absence to
 * cause a refusal, and there is nothing bound for a caller to pick up by
 * accident.
 *
 * **`StageRegistry` is bound empty and that is deliberate.** `EPIC-031`–`035`
 * register the handlers for the stages their Rooms use. An empty registry means
 * the configuration loader refuses every file naming a stage nothing can run —
 * at composition, loudly, rather than at the first transition.
 *
 * ## Adjudication (C2A closure, `T1096`–`T1102`)
 *
 * The adjudication providers below **are** bound, unlike the seams above, and
 * the difference is deliberate. Closure finding `X6` was that
 * `ProposalAdjudicatorService` existed only where a test constructed it — so
 * leaving these unbound would restate the finding rather than close it. Where
 * an owning Epic supplies nothing, the *adapter* refuses; the discipline is the
 * same, expressed as a provider rather than as an absence.
 *
 * Only {@link PROPOSAL_ADJUDICATOR} is exported. A consumer that could reach the
 * individual ports could assemble its own adjudicator with its own gate
 * provider, which is the bypass `FR-GEL-073` forbids.
 */
import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { StageHandler } from '@pmi/loop-contract';
import { LoopController } from './loop.controller.js';
import { LoopService } from './loop.service.js';
import { LoopConfigRegistry } from './config-registry.js';
import { StageRegistry } from './stage-registry.js';
import { InMemoryLoopStore, type LoopStore,
  PrismaLoopStore,
  type LoopPrismaClient,
} from './loop.store.js';
import { buildConfigRegistry } from './workflow-files.js';
import {
  ADJUDICATION_AUTHORITY_POLICY,
  ADJUDICATION_GATE_OUTCOMES,
  ADJUDICATION_INTAKE_AUTHORIZATION,
  ADJUDICATION_LIFECYCLE_APPLICATION,
  ADJUDICATION_LIFECYCLE_VALIDATION,
  ADJUDICATION_RECORDS,
  LOOP_CONFIG_SOURCE,
  LOOP_STAGE_HANDLERS,
  LOOP_STORE,
  APPLICATION_POLICY_STORE,
  PROPOSAL_ADJUDICATOR,
} from './loop.tokens.js';
import {
  ProposalAdjudicatorService,
  type AdjudicationRecordPort,
  type AuthorityPolicyPort,
  type GateOutcomePort,
  type IntakeAuthorizationPort,
  type LifecycleValidationPort,
} from './adjudicator.service.js';
import {
  AccessIntakeAuthorization,
  DurableApplicationPolicy,
  PrismaApplicationPolicyStore,
  EpicNinePersistentValidation,
  EpicNineTransactionalApplication,
  EpicTwentyOneGateOutcomes,
  GrantBackedAuthorities,
  PrismaAdjudicationRecords,
  type LifecycleRepositoryShape,
} from './adjudication.adapters.js';
import type { AdjudicationEvidenceRow } from './adjudication-evidence.js';
import { DEFAULT_SEPARATION_POLICY } from './separation-of-duties.js';
import {
  ApplicationPolicyService,
  type ApplicationPolicyStore,
} from './application-policy.service.js';
import { SpecificationsModule } from '../specifications/specifications.module.js';
import { permittedFrom } from '../specifications/lifecycle.machine.js';
import { AccessModule } from '../access/access.module.js';
import { WorkspaceBoundaryService } from '../access/workspace-boundary.service.js';
import { ReviewsModule } from '../reviews/reviews.module.js';
import { GateProductionService } from '../reviews/gate-production.service.js';
import { LIFECYCLE_TRANSITION_REPOSITORY } from '../specifications/specifications.module.js';
import type { PrismaLifecycleTransitionRepository } from '../specifications/lifecycle-transition.repository.js';
import { AccessEnforcementService } from '../access/access-enforcement.service.js';
import { prismaClient } from '../../persistence/prisma.js';

/**
 * `T1165` — the module's metadata, as a function of the handlers a Room supplies.
 *
 * Extracted so `register` and the default cannot drift: one description of this
 * module, parameterised at exactly the point `FR-GEL-007` requires a decision.
 */
function loopModuleMetadata(stageHandlers: readonly StageHandler[]): ModuleMetadata {
  return {
  imports: [SpecificationsModule, AccessModule, ReviewsModule],
  controllers: [LoopController],
  providers: [
    {
      provide: LOOP_STAGE_HANDLERS,
      // `T1165` — supplied by the Rooms, through `register`. Still `[]` by
      // default, and `[]` still refuses every workflow type by name.
      useFactory: (): StageRegistry => new StageRegistry(stageHandlers),
    },
    {
      provide: LOOP_STORE,
      // `T1180` — the composition seam, decided on `DATABASE_URL` exactly as
      // `AuthModule.register` decides its directory. Unset in unit tests, so
      // the in-memory store stays their default and the asymmetry this module's
      // header describes still holds: a store that loses data does so visibly.
      useFactory: (): LoopStore =>
        process.env['DATABASE_URL']
          ? new PrismaLoopStore(prismaClient() as unknown as LoopPrismaClient)
          : new InMemoryLoopStore(),
    },
    {
      provide: LOOP_CONFIG_SOURCE,
      inject: [LOOP_STAGE_HANDLERS],
      useFactory: (stages: StageRegistry): LoopConfigRegistry =>
        // With no handlers registered, every workflow file naming a stage is
        // refused — so the registry is empty and `declareObject` refuses each
        // type by name. That is the honest state until a Room registers its
        // handlers, and it is why this is a try/catch rather than a crash: one
        // unfilled seam must not take the whole API down (FR-GEL-062).
        safeRegistry(stages),
    },
    {
      provide: LoopService,
      inject: [
        LOOP_STORE,
        LOOP_CONFIG_SOURCE,
        WorkspaceBoundaryService,
        ADJUDICATION_AUTHORITY_POLICY,
      ],
      // `DEF-030-003` — the two resolvers. `WorkspaceBoundaryService` says who
      // the caller is; `ADJUDICATION_AUTHORITY_POLICY` says what they hold. The
      // second is the port the adjudicator already consumes, so both halves of
      // this module now read authorities from the same place.
      //
      // The AuthorityMap is still `{}` and still refuses every transition. That
      // is unchanged and deliberate: this fix removes the escalation path, it
      // does not configure the loop.
      useFactory: (
        store: LoopStore,
        configs: LoopConfigRegistry,
        principals: WorkspaceBoundaryService,
        policy: AuthorityPolicyPort,
      ): LoopService =>
        new LoopService(store, configs, {}, undefined, principals, policy),
    },

    // --- Adjudication ports -------------------------------------------------

    {
      provide: ADJUDICATION_LIFECYCLE_VALIDATION,
      inject: [LIFECYCLE_TRANSITION_REPOSITORY],
      useFactory: (repo: PrismaLifecycleTransitionRepository): LifecycleValidationPort =>
        // Reads the SAME rows the transition writes. `permittedFrom` is
        // EPIC-009's function, passed in — a table copied here would be a
        // second lifecycle engine (`FR-GEL-065`).
        new EpicNinePersistentValidation(repo as LifecycleRepositoryShape, (state) =>
          permittedFrom(state as never),
        ),
    },
    {
      provide: ADJUDICATION_LIFECYCLE_APPLICATION,
      inject: [LIFECYCLE_TRANSITION_REPOSITORY],
      useFactory: (repo: PrismaLifecycleTransitionRepository): EpicNineTransactionalApplication =>
        // `appliedTransitionId` is now the id EPIC-009 COMMITTED, in the same
        // transaction as the state change (`X8`). The durable-intent store is
        // no longer on this path: the transaction is the durability.
        new EpicNineTransactionalApplication(repo as LifecycleRepositoryShape),
    },
    {
      provide: ADJUDICATION_GATE_OUTCOMES,
      inject: [GateProductionService, LIFECYCLE_TRANSITION_REPOSITORY],
      useFactory: (
        gates: GateProductionService,
        repo: PrismaLifecycleTransitionRepository,
      ): GateOutcomePort =>
        // EPIC-021 now supplies a production service (`X7`). The current
        // version comes from EPIC-009, so a stale outcome cannot look fresh.
        new EpicTwentyOneGateOutcomes(gates, repo as LifecycleRepositoryShape),
    },
    {
      provide: APPLICATION_POLICY_STORE,
      useFactory: (): ApplicationPolicyStore =>
        new PrismaApplicationPolicyStore({
          create: (args) => prismaClient().applicationPolicy.create(args as never) as never,
          findFirst: (args) => prismaClient().applicationPolicy.findFirst(args as never) as never,
        }),
    },
    {
      provide: ApplicationPolicyService,
      inject: [APPLICATION_POLICY_STORE],
      useFactory: (store: ApplicationPolicyStore): ApplicationPolicyService =>
        new ApplicationPolicyService(store),
    },
    {
      provide: ADJUDICATION_AUTHORITY_POLICY,
      inject: [ApplicationPolicyService],
      useFactory: (policies: ApplicationPolicyService): AuthorityPolicyPort =>
        // X15 (C2D) — auto-application requires an EXPLICIT effective policy.
        // With no policy the answer is `false`, so an unconfigured transition
        // resolves to `validated`, never `applied`.
        new DurableApplicationPolicy(policies, new GrantBackedAuthorities({})),
    },
    {
      provide: ADJUDICATION_INTAKE_AUTHORIZATION,
      inject: [AccessEnforcementService],
      useFactory: (access: AccessEnforcementService): IntakeAuthorizationPort =>
        new AccessIntakeAuthorization(access),
    },
    {
      provide: ADJUDICATION_RECORDS,
      useFactory: (): AdjudicationRecordPort =>
        new PrismaAdjudicationRecords({
          create: (args) =>
            prismaClient().adjudicationRecord.create(args as never) as Promise<{ id: string }>,
          findUnique: (args) =>
            prismaClient().adjudicationRecord.findUnique(
              args as never,
            ) as Promise<AdjudicationEvidenceRow | null>,
        }),
    },
    {
      provide: PROPOSAL_ADJUDICATOR,
      inject: [
        ADJUDICATION_LIFECYCLE_VALIDATION,
        ADJUDICATION_GATE_OUTCOMES,
        ADJUDICATION_AUTHORITY_POLICY,
        ADJUDICATION_LIFECYCLE_APPLICATION,
        ADJUDICATION_RECORDS,
        ADJUDICATION_INTAKE_AUTHORIZATION,
      ],
      useFactory: (
        lifecycle: LifecycleValidationPort,
        gates: GateOutcomePort,
        policy: AuthorityPolicyPort,
        application: EpicNineTransactionalApplication,
        records: AdjudicationRecordPort,
        authorization: IntakeAuthorizationPort,
      ): ProposalAdjudicatorService =>
        new ProposalAdjudicatorService(
          lifecycle,
          gates,
          policy,
          application,
          DEFAULT_SEPARATION_POLICY,
          records,
          authorization,
        ),
    },
  ],
  exports: [
    LoopService,
    LOOP_STORE,
    LOOP_CONFIG_SOURCE,
    LOOP_STAGE_HANDLERS,
    // The one consumer-facing token. See the note at the head of this file.
    PROPOSAL_ADJUDICATOR,
    // Configuration, not adjudication: an operator (or a future UI) declares
    // whether a transition may apply automatically. Exporting it does not let
    // a consumer decide any particular proposal.
    ApplicationPolicyService,
  ],
};
}

/**
 * **The decorator carries the full default, and `register` configures it.**
 *
 * The default is `[]` handlers — which still refuses every workflow type by
 * name, the honest state `T1164` pins. An empty decorator was tried instead, to
 * make a static import fail loudly; it broke two governance proofs that read
 * this module's metadata directly (`T934`'s reachability, `T1102`'s
 * `FR-GEL-073` export check), because both introspect the decorator rather than
 * the graph. A wiring nicety is not worth blinding those.
 *
 * Nest merges the dynamic metadata over the static, so `register`'s
 * `LOOP_STAGE_HANDLERS` provider is the one that binds. `T1164` proves that
 * empirically rather than by trusting the merge order.
 *
 * **Call it once and share the result.** Nest keys a dynamic module by its
 * metadata, so two `register` calls are two module instances with two
 * `InMemoryLoopStore`s — objects written through one invisible to the other.
 * `backend/src/composition/governed-loop.ts` holds the single call; both
 * importers take that constant.
 */
@Module(loopModuleMetadata([]))
export class LoopModule {
  static register(
    options: { readonly stageHandlers?: readonly StageHandler[] } = {},
  ): DynamicModule {
    return { module: LoopModule, ...loopModuleMetadata(options.stageHandlers ?? []) };
  }
}

/**
 * A registry of what loads, and nothing where nothing does.
 *
 * The alternative — letting a `LoopConfigError` escape composition — would make
 * an unregistered stage handler a boot failure for the entire application. The
 * refusal still happens; it happens at `declareObject`, where a caller can read
 * it, which is the shape `FR-GEL-062` asks for.
 */
function safeRegistry(stages: StageRegistry): LoopConfigRegistry {
  try {
    return buildConfigRegistry(stages.registeredStages);
  } catch {
    return new LoopConfigRegistry([]);
  }
}
