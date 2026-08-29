/**
 * T054/T055 — projects module wiring.
 *
 * Services stay framework-free (PC-1); plain classes wired with factory
 * providers, the same shape as `jobs.module.ts` (T651).
 *
 * The store defaults to in-memory, matching `JOB_STORE`'s posture: the API
 * boots and serves without a database, and a deployment that wants persistence
 * overrides `PROJECT_STORE` with `PrismaProjectStore` at the composition root.
 *
 * `ProjectEngineSelection` is the implementation `engines.module.ts` promised:
 * "storing a selection is EPIC-006's... this implementation is replaced there".
 * It satisfies `ProjectEngineSelectionPort` by reading the project's own
 * `engineName` — swap it in for `PROJECT_ENGINE_SELECTION` at the same
 * composition root that supplies the Prisma delegates.
 */
import { Module } from '@nestjs/common';
import type { ProjectEngineSelectionPort } from '../engines/engine-resolver.service.js';
import { ProjectsController } from './projects.controller.js';
import { prismaClient } from '../../persistence/prisma.js';
import {
  InMemoryProjectStore,
  PrismaProjectStore,
  ProjectsService,
  type ProjectStore,
} from './projects.service.js';

export const PROJECT_STORE = Symbol('PROJECT_STORE');

/** FR-019 — the per-project engine selection, read from the project record. */
export class ProjectEngineSelection implements ProjectEngineSelectionPort {
  constructor(private readonly projects: ProjectsService) {}

  async findEngineNameForProject(projectId: string): Promise<string | null> {
    return this.projects.findEngineNameForProject(projectId);
  }
}

@Module({
  controllers: [ProjectsController],
  providers: [
    {
      provide: PROJECT_STORE,
      // `T1178` (EPIC-014 F-11.2) — the composition seam this module's header
      // has always described. `DATABASE_URL` decides, exactly as
      // `AuthModule.register` decides its directory: set in production, unset
      // in unit tests, so the in-memory store remains the test default and
      // nothing that relied on it changes.
      //
      // Until this, `GET /v1/projects` returned rows while
      // `SELECT count(*) FROM projects` returned 0 — the store was never the
      // database.
      useFactory: (): ProjectStore =>
        process.env['DATABASE_URL']
          ? new PrismaProjectStore(prismaClient().project)
          : new InMemoryProjectStore(),
    },
    {
      provide: ProjectsService,
      inject: [PROJECT_STORE],
      useFactory: (store: ProjectStore): ProjectsService => new ProjectsService(store),
    },
    {
      provide: ProjectEngineSelection,
      inject: [ProjectsService],
      useFactory: (projects: ProjectsService): ProjectEngineSelection =>
        new ProjectEngineSelection(projects),
    },
  ],
  exports: [ProjectsService, PROJECT_STORE, ProjectEngineSelection],
})
export class ProjectsModule {}
