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
import type { RequirementStore } from '../requirements/requirements.service.js';
import {
  GenerateSpecificationService,
  InMemoryGenerationJobLedger,
  LookupRequirementSelection,
  type GenerationJobLedger,
  type RequirementSelectionPort,
} from './generate-specification.service.js';
import { newCorrelationId } from '@pmi/observability';
import {
  InMemoryFindingStore,
  SpecificationLifecycleService,
  type LifecycleActingContext,
  type ValidationJobBody,
  type ValidationSubmissionPort,
} from './lifecycle-api.service.js';
import {
  InMemoryTransitionRecorder,
  type TransitionRecorder,
} from './lifecycle.machine.js';
import { OutOfDateService } from './out-of-date.service.js';
import { SpecificationSearchService } from './specification-search.service.js';
import {
  SpecificationLifecycleController,
  SpecificationsController,
} from './specifications.controller.js';
import {
  InMemorySpecificationStore,
  SpecificationsReadService,
  type SpecificationRecord,
  type SpecificationStore,
} from './specifications-read.service.js';

export const SPECIFICATION_STORE = Symbol('SPECIFICATION_STORE');
export const GENERATION_JOB_LEDGER = Symbol('GENERATION_JOB_LEDGER');
export const REQUIREMENT_SELECTION = Symbol('REQUIREMENT_SELECTION');

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

/** EPIC-009's replaceable ports (T111 recorder, T120 findings). */
export const TRANSITION_RECORDER = Symbol('TRANSITION_RECORDER');
export const SPEC_FINDING_STORE = Symbol('SPEC_FINDING_STORE');

/**
 * T123 — validate rides the same job machinery as generation: resolve the
 * project's engine, submit a `validate_specification` job, return the job.
 * Wiring-layer adapter, so the lifecycle service stays framework- and
 * jobs-shape-free behind its port.
 */
export class JobsValidationSubmission implements ValidationSubmissionPort {
  constructor(
    private readonly engines: EngineResolverService,
    private readonly jobs: JobsService,
  ) {}

  async submitFor(
    ctx: LifecycleActingContext,
    specification: SpecificationRecord,
  ): Promise<ValidationJobBody> {
    const engine = await this.engines.resolveForProject(specification.projectId);
    const submitted = await this.jobs.submit({
      workspaceId: ctx.workspaceId,
      projectId: specification.projectId,
      kind: 'validate_specification',
      requestedById: ctx.userId,
      engineName: engine.descriptor.name,
      engineVersion: engine.descriptor.version,
      correlationId: newCorrelationId(),
      inputRefs: { specificationId: specification.id },
    });
    return {
      id: submitted.job.id,
      kind: 'validate_specification',
      state: submitted.job.state,
      failureReason: null,
      startedAt: null,
      resultRef: null,
    };
  }
}

@Module({
  imports: [EnginesModule, RequirementsModule],
  controllers: [SpecificationsController, SpecificationLifecycleController],
  providers: [
    {
      provide: SPECIFICATION_STORE,
      useFactory: (): SpecificationStore => new InMemorySpecificationStore(),
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
      provide: TRANSITION_RECORDER,
      useFactory: (): TransitionRecorder => new InMemoryTransitionRecorder(),
    },
    {
      provide: SPEC_FINDING_STORE,
      useFactory: (): InMemoryFindingStore => new InMemoryFindingStore(),
    },
    {
      provide: SpecificationLifecycleService,
      inject: [
        SPECIFICATION_STORE,
        TRANSITION_RECORDER,
        SPEC_FINDING_STORE,
        EngineResolverService,
        GENERATION_JOBS_SERVICE,
      ],
      useFactory: (
        store: SpecificationStore,
        recorder: TransitionRecorder,
        findings: InMemoryFindingStore,
        engines: EngineResolverService,
        jobs: JobsService,
      ): SpecificationLifecycleService =>
        new SpecificationLifecycleService(
          store,
          recorder,
          findings,
          new JobsValidationSubmission(engines, jobs),
        ),
    },
    {
      provide: SpecificationsController,
      inject: [GenerateSpecificationService, SpecificationsReadService, SpecificationSearchService],
      useFactory: (
        generation: GenerateSpecificationService,
        reads: SpecificationsReadService,
        search: SpecificationSearchService,
      ): SpecificationsController => new SpecificationsController(generation, reads, search),
    },
  ],
  exports: [
    GenerateSpecificationService,
    SpecificationsReadService,
    SpecificationSearchService,
    SpecificationLifecycleService,
    OutOfDateService,
    SPECIFICATION_STORE,
    GENERATION_JOB_LEDGER,
    GENERATION_JOBS_SERVICE,
    TRANSITION_RECORDER,
    SPEC_FINDING_STORE,
  ],
})
export class SpecificationsModule {}
