import { Module } from '@nestjs/common';
import { AuditModule } from './modules/audit/audit.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';

/**
 * Application composition root.
 *
 * Note what is absent: any import of `engine-adapters/*`. Engines are supplied
 * at the WORKER's composition root, so the API never holds a reference to a
 * concrete engine (FR-017). Enforced by the architecture test.
 */
@Module({
  imports: [AuditModule, JobsModule],
})
export class AppModule {}
