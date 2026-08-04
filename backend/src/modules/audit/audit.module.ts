import { Module } from '@nestjs/common';

/**
 * Audit module (F-13.1). Providers are wired at the composition root once a
 * Prisma client exists; the service and interceptor are framework-free (PC-1)
 * and fully unit-tested without this module.
 */
@Module({})
export class AuditModule {}
