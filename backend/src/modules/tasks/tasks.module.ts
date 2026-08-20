/**
 * T100–T103 — tasks module wiring.
 *
 * Services stay framework-free (PC-1); stores default to in-memory; Prisma
 * adapters ride the composition seam (EPIC-014 F-11.2), the platform posture.
 *
 * `TasksApi` composes the pieces for the controller: generation submission
 * rides the SAME job machinery as generation and validation (spec store +
 * engine resolver + jobs service), with the FR-020 gate checked BEFORE any
 * job exists.
 */
import { Module } from '@nestjs/common';
import { newCorrelationId } from '@pmi/observability';
import { assertSameWorkspace } from '../../core/workspace.guard.js';
import { EngineResolverService } from '../engines/engine-resolver.service.js';
import { EnginesModule } from '../engines/engines.module.js';
import { JobsService } from '../jobs/jobs.service.js';
import { assertTaskGenerationPermitted, type SpecLifecycleState } from '../specifications/lifecycle.machine.js';
import {
  GENERATION_JOBS_SERVICE,
  SPECIFICATION_STORE,
  SpecificationsModule,
} from '../specifications/specifications.module.js';
import type { SpecificationStore } from '../specifications/specifications-read.service.js';
import { LinkWriterService } from '../traceability/link-writer.service.js';
import { TraceabilityModule } from '../traceability/traceability.module.js';
import {
  GenerateTasksService,
  InMemoryTaskStore,
  type TaskStore,
} from './generate-tasks.service.js';
import { TaskRegenerationService } from './task-regeneration.service.js';
import { TASKS_API, TasksController, type TaskJobBody, type TasksApi } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

export const TASK_STORE = Symbol('TASK_STORE');

/** The controller's composed surface: reads via TasksService, submit via jobs. */
class ComposedTasksApi implements TasksApi {
  constructor(
    private readonly service: TasksService,
    private readonly specifications: SpecificationStore,
    private readonly engines: EngineResolverService,
    private readonly jobs: JobsService,
  ) {}

  async submitGeneration(
    ctx: { workspaceId: string; userId: string },
    specificationId: string,
  ): Promise<TaskJobBody> {
    const spec = await this.specifications.findById(specificationId);
    assertSameWorkspace(ctx.workspaceId, spec, { targetType: 'specification' });
    // FR-020: refused HERE, before a job exists — a queued job that fails
    // later would hide the gate behind an asynchronous failure.
    assertTaskGenerationPermitted(spec!.lifecycleState as SpecLifecycleState);

    const engine = await this.engines.resolveForProject(spec!.projectId);
    const submitted = await this.jobs.submit({
      workspaceId: ctx.workspaceId,
      projectId: spec!.projectId,
      kind: 'generate_tasks',
      requestedById: ctx.userId,
      engineName: engine.descriptor.name,
      engineVersion: engine.descriptor.version,
      correlationId: newCorrelationId(),
      inputRefs: { specificationId },
    });
    return {
      id: submitted.job.id,
      kind: 'generate_tasks',
      state: submitted.job.state,
      failureReason: null,
      startedAt: null,
      resultRef: null,
    };
  }

  listForSpecification(workspaceId: string, specificationId: string): ReturnType<TasksService['listForSpecification']> {
    return this.service.listForSpecification(workspaceId, specificationId);
  }

  updateStatus(workspaceId: string, id: string, status: Parameters<TasksService['updateStatus']>[2]): ReturnType<TasksService['updateStatus']> {
    return this.service.updateStatus(workspaceId, id, status);
  }

  progressForProject(workspaceId: string, projectId: string): ReturnType<TasksService['progressForProject']> {
    return this.service.progressForProject(workspaceId, projectId);
  }
}

@Module({
  imports: [EnginesModule, SpecificationsModule, TraceabilityModule],
  controllers: [TasksController],
  providers: [
    { provide: TASK_STORE, useFactory: (): TaskStore => new InMemoryTaskStore() },
    {
      provide: GenerateTasksService,
      inject: [TASK_STORE, LinkWriterService],
      useFactory: (store: TaskStore, links: LinkWriterService): GenerateTasksService =>
        new GenerateTasksService(store, links),
    },
    {
      provide: TaskRegenerationService,
      inject: [GenerateTasksService, TASK_STORE, LinkWriterService],
      useFactory: (
        generator: GenerateTasksService,
        store: TaskStore,
        links: LinkWriterService,
      ): TaskRegenerationService => new TaskRegenerationService(generator, store, links),
    },
    {
      provide: TasksService,
      inject: [TASK_STORE, SPECIFICATION_STORE],
      useFactory: (store: TaskStore, specifications: SpecificationStore): TasksService =>
        new TasksService(store, {
          // Progress needs the project's specification ids; the store already
          // scopes the read (T083f's findScoped).
          listSpecificationIds: async (workspaceId, projectId) =>
            (await specifications.findScoped(workspaceId, projectId)).map(
              (candidate) => candidate.specification.id,
            ),
        }),
    },
    {
      provide: TASKS_API,
      inject: [TasksService, SPECIFICATION_STORE, EngineResolverService, GENERATION_JOBS_SERVICE],
      useFactory: (
        service: TasksService,
        specifications: SpecificationStore,
        engines: EngineResolverService,
        jobs: JobsService,
      ): TasksApi => new ComposedTasksApi(service, specifications, engines, jobs),
    },
  ],
  exports: [GenerateTasksService, TaskRegenerationService, TasksService, TASK_STORE, TASKS_API],
})
export class TasksModule {}
