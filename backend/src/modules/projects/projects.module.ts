/**
 * T054/T055 — projects module wiring. T1350 (EPIC-041) — provisioning.
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
 *
 * ## Provisioning (EPIC-041)
 *
 * `ProvisioningService` composes the projects-root configuration (six variables,
 * `R-041-2`), the record store, the job queue that carries the initialise step
 * to the worker (`R-041-1`), the ledger `refresh()` reads to derive
 * *initialisation pending*, the workspace bundle (`R-041-9`), `git init` as a
 * tool on PATH, and the audit service. **Nothing here names an engine.**
 */
import { Module, forwardRef } from '@nestjs/common';
import { BUNDLE_VERSION, DEFAULT_AGENT_INTEGRATION, skillsDir, skillsPathFor } from '@pmi/workspace-bundle';
import type { ProjectEngineSelectionPort } from '../engines/engine-resolver.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { ConnectorModule } from '../connector/connector.module.js';
import { AuditService } from '../audit/audit.service.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { JobsService } from '../jobs/jobs.service.js';
import { PrismaGenerationJobLedger } from '../specifications/generation-job.ledger.prisma.js';
import { ProjectsController } from './projects.controller.js';
import { prismaClient } from '../../persistence/prisma.js';
import { readProjectsRootConfig } from './projects-root.js';
import {
  InMemoryProjectStore,
  PrismaProjectStore,
  ProjectsService,
  type ProjectDelegate,
  type ProjectStore,
} from './projects.service.js';
import { ProvisioningService, gitInit } from './provisioning.service.js';
import {
  InMemoryProvisioningRecordStore,
  PrismaProvisioningRecordStore,
  type ProvisioningRecordStore,
} from './provisioning.store.js';

export const PROJECT_STORE = Symbol('PROJECT_STORE');
export const PROVISIONING_RECORD_STORE = Symbol('PROVISIONING_RECORD_STORE');

/** FR-019 — the per-project engine selection, read from the project record. */
export class ProjectEngineSelection implements ProjectEngineSelectionPort {
  constructor(private readonly projects: ProjectsService) {}

  async findEngineNameForProject(projectId: string): Promise<string | null> {
    return this.projects.findEngineNameForProject(projectId);
  }
}

@Module({
  // forwardRef: provisioning mints a credential (FR-LPW-020) and minting reads
  // the project — the cycle Nest's circular-dependency guidance covers.
  imports: [JobsModule, AuditModule, forwardRef(() => ConnectorModule)],
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
          ? new PrismaProjectStore(prismaClient().project as unknown as ProjectDelegate)
          : new InMemoryProjectStore(),
    },
    {
      provide: PROVISIONING_RECORD_STORE,
      // EPIC-041 T1341 — append-only in the database (reject_mutation) and by
      // interface. Asserted by tests/architecture/durable-stores.spec.ts.
      useFactory: (): ProvisioningRecordStore =>
        process.env['DATABASE_URL']
          ? new PrismaProvisioningRecordStore(prismaClient().provisioningRecord)
          : new InMemoryProvisioningRecordStore(),
    },
    {
      provide: ProjectsService,
      inject: [PROJECT_STORE],
      useFactory: (store: ProjectStore): ProjectsService => new ProjectsService(store),
    },
    {
      provide: ProvisioningService,
      inject: [PROJECT_STORE, PROVISIONING_RECORD_STORE, JobsService, AuditService],
      useFactory: (
        projects: ProjectStore,
        records: ProvisioningRecordStore,
        jobs: JobsService,
        audit: AuditService,
      ): ProvisioningService =>
        new ProvisioningService({
          config: readProjectsRootConfig(process.env),
          projects,
          records,
          jobs,
          // `refresh()` reads the same generation_jobs rows the worker claims.
          // Without a database there is no worker either, so nothing to read.
          ledger: process.env['DATABASE_URL'] ? new PrismaGenerationJobLedger(prismaClient().generationJob) : null,
          bundle: { version: BUNDLE_VERSION, defaultIntegration: DEFAULT_AGENT_INTEGRATION, skillsDir, skillsPathFor },
          git: { init: gitInit },
          audit,
        }),
    },
    {
      provide: ProjectEngineSelection,
      inject: [ProjectsService],
      useFactory: (projects: ProjectsService): ProjectEngineSelection =>
        new ProjectEngineSelection(projects),
    },
  ],
  exports: [ProjectsService, ProvisioningService, PROJECT_STORE, PROVISIONING_RECORD_STORE, ProjectEngineSelection],
})
export class ProjectsModule {}
