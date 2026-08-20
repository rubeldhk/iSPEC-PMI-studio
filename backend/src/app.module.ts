import { Module } from '@nestjs/common';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { EnginesModule } from './modules/engines/engines.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { RequirementsModule } from './modules/requirements/requirements.module.js';

/**
 * Application composition root.
 *
 * Note what is absent: any import of `engine-adapters/*`. Engines are supplied
 * at the WORKER's composition root, so the API never holds a reference to a
 * concrete engine (FR-017). Enforced by the architecture test.
 */
@Module({
  imports: [AuthModule, AuditModule, EnginesModule, JobsModule, ProjectsModule, RequirementsModule],
})
export class AppModule {}
