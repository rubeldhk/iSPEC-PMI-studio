/**
 * T083 — specifications module wiring.
 *
 * The lesson of `T462` (engines) and `T651` (jobs), applied before convergence
 * has to find it again: a module that is fully built, fully tested and provided
 * NOWHERE leaves the running API without the capability. So this file exists in
 * the same commit as the services it wires.
 *
 * Services stay framework-free (PC-1) — no `@Injectable()`, no decorators, no
 * Nest import in a `.service.ts` file. They are plain classes wired here with
 * factory providers, which is why the architecture test can assert that
 * services never import an HTTP type while this file legitimately does.
 *
 * Defaults are the in-memory implementations, matching the `JOB_STORE` posture:
 * the API boots and serves without a database, and a deployment that wants
 * persistence overrides `SPECIFICATION_STORE` and `GENERATION_JOB_LEDGER` with
 * the Prisma-backed store at the composition root (EPIC-014 F-11.2).
 */
import { Module } from '@nestjs/common';
import { EnginesModule } from '../engines/engines.module.js';
import { EngineResolverService } from '../engines/engine-resolver.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { REQUIREMENT_STORE, RequirementsModule } from '../requirements/requirements.module.js';
import { TRACEABILITY_LINK_STORE, TraceabilityModule } from '../traceability/traceability.module.js';
import {
  LinkWriterService,
  TraceabilityLinkAdapter,
  type TraceabilityLinkStore,
} from '../traceability/link-writer.service.js';
import type { RequirementStore } from '../requirements/requirements.service.js';
import {
  GenerateSpecificationService,
  InMemoryGenerationJobLedger,
  LookupRequirementSelection,
  type GenerationJobLedger,
  type RequirementSelectionPort,
} from './generate-specification.service.js';
import { ApprovalService } from './approval.service.js';
import {
  InMemoryTransitionRecorder,
  LifecycleMachine,
  type TransitionRecorder,
} from './lifecycle.machine.js';
import { SpecificationLifecycleService } from './lifecycle.service.js';
import { OutOfDateService } from './out-of-date.service.js';
import type { OutstandingFindingsSource } from './approval.service.js';
import { SpecificationSearchService } from './specification-search.service.js';
import { SpecificationsController } from './specifications.controller.js';
import {
  InMemorySpecificationStore,
  SpecificationsReadService,
  type SpecificationStore,
} from './specifications-read.service.js';

export const SPECIFICATION_STORE = Symbol('SPECIFICATION_STORE');
export const GENERATION_JOB_LEDGER = Symbol('GENERATION_JOB_LEDGER');
export const REQUIREMENT_SELECTION = Symbol('REQUIREMENT_SELECTION');
export const TRANSITION_RECORDER = Symbol('TRANSITION_RECORDER');
export const OUTSTANDING_FINDINGS = Symbol('OUTSTANDING_FINDINGS');

/**
 * A `JobsService` bound to THIS ledger.
 *
 * `JobsModule` provides its own over a `NullJobStore`, which is right for the
 * submission path in isolation. The generation API needs the submission path
 * and the read path to see the same rows, so it supplies one ledger to both
 * rather than reading from a store nothing writes to. In a composed deployment
 * both are the same `generation_jobs` table and the distinction disappears.
 */
export const GENERATION_JOBS_SERVICE = Symbol('GENERATION_JOBS_SERVICE');

@Module({
  imports: [EnginesModule, RequirementsModule, TraceabilityModule],
  controllers: [SpecificationsController],
  providers: [
    {
      /**
       * T858 (EPIC-011) — generation writes its links into the SHARED
       * traceability store, through `LinkWriterService`.
       *
       * Convergence found link creation implemented twice and connected once:
       * this store kept its own array while `LinkWriterService` — the task's
       * whole deliverable — had no caller, so a generated specification was
       * invisible to `/trace` and `/coverage`. One store, one writer, and the
       * permitted-edge rule now applies to generation too.
       */
      provide: SPECIFICATION_STORE,
      inject: [TRACEABILITY_LINK_STORE, LinkWriterService],
      useFactory: (
        links: TraceabilityLinkStore,
        writer: LinkWriterService,
      ): SpecificationStore =>
        new InMemorySpecificationStore(new TraceabilityLinkAdapter(writer, links)),
    },
    {
      provide: GENERATION_JOB_LEDGER,
      useFactory: (): InMemoryGenerationJobLedger => new InMemoryGenerationJobLedger(),
    },
    {
      provide: GENERATION_JOBS_SERVICE,
      inject: [GENERATION_JOB_LEDGER],
      useFactory: (ledger: InMemoryGenerationJobLedger): JobsService => new JobsService(ledger),
    },
    {
      // T843 — the scope check reads the LIVE requirement register, not a copy.
      // This is the composition seam: neither module imports the other's
      // service, and they meet here, on a token.
      provide: REQUIREMENT_SELECTION,
      inject: [REQUIREMENT_STORE],
      useFactory: (store: RequirementStore): RequirementSelectionPort =>
        new LookupRequirementSelection(store),
    },
    {
      provide: GenerateSpecificationService,
      inject: [
        EngineResolverService,
        SPECIFICATION_STORE,
        GENERATION_JOBS_SERVICE,
        GENERATION_JOB_LEDGER,
        REQUIREMENT_SELECTION,
      ],
      useFactory: (
        engines: EngineResolverService,
        store: SpecificationStore,
        jobs: JobsService,
        ledger: GenerationJobLedger,
        requirements: RequirementSelectionPort,
      ): GenerateSpecificationService =>
        new GenerateSpecificationService(engines, store, { jobs, ledger, requirements }),
    },
    {
      // T109's recorder. In-memory by default, like every other store here;
      // the composition root binds it to `lifecycle_transitions`.
      provide: TRANSITION_RECORDER,
      useFactory: (): TransitionRecorder => new InMemoryTransitionRecorder(),
    },
    {
      provide: LifecycleMachine,
      inject: [TRANSITION_RECORDER],
      useFactory: (recorder: TransitionRecorder): LifecycleMachine =>
        new LifecycleMachine(recorder),
    },
    {
      /**
       * T120's read side. Empty by default and deliberately NOT a stub that
       * claims "no findings": an unwired source reports nothing because
       * nothing has been validated, which is the truthful answer before
       * EPIC-014 binds it to `validation_findings`.
       */
      provide: OUTSTANDING_FINDINGS,
      useFactory: (): OutstandingFindingsSource => ({ outstandingFor: async () => [] }),
    },
    {
      provide: ApprovalService,
      inject: [OUTSTANDING_FINDINGS, TRANSITION_RECORDER],
      useFactory: (
        findings: OutstandingFindingsSource,
        recorder: TransitionRecorder,
      ): ApprovalService => new ApprovalService(findings, recorder),
    },
    {
      provide: SpecificationLifecycleService,
      inject: [SPECIFICATION_STORE, LifecycleMachine, ApprovalService, OUTSTANDING_FINDINGS],
      useFactory: (
        store: SpecificationStore,
        machine: LifecycleMachine,
        approvals: ApprovalService,
        findings: OutstandingFindingsSource,
      ): SpecificationLifecycleService =>
        new SpecificationLifecycleService(store, machine, { approvals, findings }),
    },
    {
      provide: SpecificationsReadService,
      inject: [SPECIFICATION_STORE],
      useFactory: (store: SpecificationStore): SpecificationsReadService =>
        new SpecificationsReadService(store),
    },
    {
      provide: SpecificationSearchService,
      inject: [SPECIFICATION_STORE],
      useFactory: (store: SpecificationStore): SpecificationSearchService =>
        new SpecificationSearchService(store),
    },
    {
      // FR-032's consumer. EPIC-007 built the hash and said so: "the one
      // function in this epic with no user-visible behaviour". This is where
      // it acquires one.
      provide: OutOfDateService,
      inject: [SPECIFICATION_STORE],
      useFactory: (store: SpecificationStore): OutOfDateService => new OutOfDateService(store),
    },
    {
      provide: SpecificationsController,
      inject: [
        GenerateSpecificationService,
        SpecificationsReadService,
        SpecificationSearchService,
        SpecificationLifecycleService,
      ],
      useFactory: (
        generation: GenerateSpecificationService,
        reads: SpecificationsReadService,
        search: SpecificationSearchService,
        lifecycle: SpecificationLifecycleService,
      ): SpecificationsController =>
        new SpecificationsController(generation, reads, search, lifecycle),
    },
  ],
  exports: [
    GenerateSpecificationService,
    SpecificationLifecycleService,
    LifecycleMachine,
    ApprovalService,
    SpecificationsReadService,
    SpecificationSearchService,
    OutOfDateService,
    SPECIFICATION_STORE,
    GENERATION_JOB_LEDGER,
  ],
})
export class SpecificationsModule {}
