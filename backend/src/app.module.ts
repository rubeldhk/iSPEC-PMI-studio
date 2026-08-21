import { Module } from '@nestjs/common';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { PrismaUserDirectory, UnconfiguredUserDirectory } from './modules/auth/identity-provider.js';
import { prismaClient } from './persistence/prisma.js';
import { DecisionsModule } from './modules/decisions/decisions.module.js';
import { EnginesModule } from './modules/engines/engines.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { RequirementsModule } from './modules/requirements/requirements.module.js';
import { SpecificationsModule } from './modules/specifications/specifications.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { SteeringModule } from './modules/steering/steering.module.js';
import { DependenciesModule } from './modules/dependencies/dependencies.module.js';
import { TraceabilityModule } from './modules/traceability/traceability.module.js';
import { RunsModule } from './modules/runs/runs.module.js';
import { ReviewModule } from './modules/review/review.module.js';
import { AccessModule } from './modules/access/access.module.js';
import { StorageModule } from './modules/storage/storage.module.js';

/**
 * Application composition root.
 *
 * Note what is absent: any import of `engine-adapters/*`. Engines are supplied
 * at the WORKER's composition root, so the API never holds a reference to a
 * concrete engine (FR-017). Enforced by the architecture test.
 */
@Module({
  imports: [
    // T831 / DEF-005-001 — the composition root supplies the REAL directory,
    // which is the act every module comment promised and nothing performed:
    // the composed graph resolved the refusing default, and sign-in was a 500
    // in the running application while 15/15 tasks were green (the fourth
    // built-tested-called-by-nothing, after DEF-001-001/002 and DEF-028-005).
    //
    // The conditional is configuration, not caution: with no DATABASE_URL
    // there is no directory to consult, and the refusing default is the honest
    // answer — it names the missing configuration instead of telling every
    // caller "wrong password".
    AuthModule.register({
      directory: () =>
        process.env['DATABASE_URL']
          ? new PrismaUserDirectory(prismaClient().user)
          : new UnconfiguredUserDirectory(),
    }),
    AuditModule,
    EnginesModule,
    JobsModule,
    ProjectsModule,
    RequirementsModule,
    SpecificationsModule,
    TasksModule,
    SteeringModule,
    DependenciesModule,
    TraceabilityModule,
    DecisionsModule,
    RunsModule,
    ReviewModule,
    AccessModule,
    StorageModule,
  ],
})
export class AppModule {}
