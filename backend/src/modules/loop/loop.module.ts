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
import { Module } from '@nestjs/common';
import { LoopController } from './loop.controller.js';
import { LoopService } from './loop.service.js';
import { LoopConfigRegistry } from './config-registry.js';
import { StageRegistry } from './stage-registry.js';
import { InMemoryLoopStore, type LoopStore } from './loop.store.js';
import { buildConfigRegistry } from './workflow-files.js';
import {
  ADJUDICATION_APPLICATION_INTENTS,
  ADJUDICATION_AUTHORITY_POLICY,
  ADJUDICATION_GATE_OUTCOMES,
  ADJUDICATION_INTAKE_AUTHORIZATION,
  ADJUDICATION_LIFECYCLE_APPLICATION,
  ADJUDICATION_LIFECYCLE_VALIDATION,
  ADJUDICATION_RECORDS,
  LOOP_CONFIG_SOURCE,
  LOOP_STAGE_HANDLERS,
  LOOP_STORE,
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
  LifecycleApplicationAdapter,
  type ApplicationIntentStore,
} from './lifecycle-application.adapter.js';
import {
  AccessIntakeAuthorization,
  ConfiguredAuthorityPolicy,
  EpicNineLifecycleValidation,
  EpicNineTransitionAdapter,
  GrantBackedAuthorities,
  PrismaAdjudicationRecords,
  PrismaApplicationIntents,
  UnconfiguredGateOutcomes,
} from './adjudication.adapters.js';
import type { AdjudicationEvidenceRow } from './adjudication-evidence.js';
import { DEFAULT_SEPARATION_POLICY } from './separation-of-duties.js';
import { SpecificationsModule } from '../specifications/specifications.module.js';
import { SpecificationsReadService } from '../specifications/specifications-read.service.js';
import { SpecificationLifecycleService } from '../specifications/lifecycle-api.service.js';
import { permittedFrom } from '../specifications/lifecycle.machine.js';
import { AccessModule } from '../access/access.module.js';
import { AccessEnforcementService } from '../access/access-enforcement.service.js';
import { prismaClient } from '../../persistence/prisma.js';

@Module({
  imports: [SpecificationsModule, AccessModule],
  controllers: [LoopController],
  providers: [
    {
      provide: LOOP_STAGE_HANDLERS,
      useFactory: (): StageRegistry => new StageRegistry([]),
    },
    {
      provide: LOOP_STORE,
      useFactory: (): LoopStore => new InMemoryLoopStore(),
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
      inject: [LOOP_STORE, LOOP_CONFIG_SOURCE],
      useFactory: (store: LoopStore, configs: LoopConfigRegistry): LoopService =>
        new LoopService(store, configs),
    },

    // --- Adjudication ports -------------------------------------------------

    {
      provide: ADJUDICATION_LIFECYCLE_VALIDATION,
      inject: [SpecificationsReadService],
      useFactory: (reads: SpecificationsReadService): LifecycleValidationPort =>
        // `permittedFrom` is EPIC-009's function, passed in. A table copied here
        // would be a second lifecycle engine (`FR-GEL-065`).
        new EpicNineLifecycleValidation(reads, (state) => permittedFrom(state as never)),
    },
    {
      provide: ADJUDICATION_APPLICATION_INTENTS,
      useFactory: (): ApplicationIntentStore =>
        // Lazily reached: `prismaClient()` reads DATABASE_URL when constructed,
        // so it must not be called while modules are merely being assembled.
        new PrismaApplicationIntents({
          create: (args) =>
            prismaClient().applicationIntent.create(args as never) as Promise<{ id: string }>,
        }),
    },
    {
      provide: ADJUDICATION_LIFECYCLE_APPLICATION,
      inject: [SpecificationLifecycleService, ADJUDICATION_APPLICATION_INTENTS],
      useFactory: (
        lifecycle: SpecificationLifecycleService,
        intents: ApplicationIntentStore,
      ): LifecycleApplicationAdapter =>
        new LifecycleApplicationAdapter(new EpicNineTransitionAdapter(lifecycle), intents),
    },
    {
      provide: ADJUDICATION_GATE_OUTCOMES,
      // EPIC-021 supplies no gate-outcome service. This refuses rather than
      // assuming every declared gate is satisfied.
      useFactory: (): GateOutcomePort => new UnconfiguredGateOutcomes(),
    },
    {
      provide: ADJUDICATION_AUTHORITY_POLICY,
      useFactory: (): AuthorityPolicyPort =>
        // No rules declared yet, so nothing auto-applies: an unconfigured
        // transition resolves to `validated`, never `applied`.
        new ConfiguredAuthorityPolicy([], new GrantBackedAuthorities({})),
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
        application: LifecycleApplicationAdapter,
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
  ],
})
export class LoopModule {}

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
