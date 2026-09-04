/**
 * `T1351` (EPIC-041) — the Prisma-backed audit writer and reader.
 *
 * Found by the first provisioning route test rather than by PMI-DOC-004B §2.1:
 * `audit.module.ts` bound `AUDIT_WRITER` to `UnconfiguredAuditWriter` and
 * nothing at any composition root ever replaced it, so under `DATABASE_URL`
 * every audited action — requirement versions, provisioning — threw
 * `AuditPersistenceUnavailableError` and answered 500. The refusal was doing
 * its job (FR-033: no action without its audit entry); the adapter it asked for
 * simply did not exist. This is that adapter, bound the way every other durable
 * store is (`tests/architecture/durable-stores.spec.ts`).
 *
 * The writer takes the row `AuditService.record()` shaped; the reader takes the
 * `{ where }` the controller scoped, newest first.
 */
import type { AuditReader } from './audit.controller.js';
import type { AuditWriter } from './audit.service.js';

/** The subset of `PrismaClient['auditEntry']` these adapters use. */
export interface AuditEntryDelegate {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }): Promise<unknown[]>;
}

export class PrismaAuditWriter implements AuditWriter {
  constructor(private readonly entries: AuditEntryDelegate) {}

  async create(data: Record<string, unknown>): Promise<void> {
    await this.entries.create({ data });
  }
}

export class PrismaAuditReader implements AuditReader {
  constructor(private readonly entries: AuditEntryDelegate) {}

  async list(query: { where: Record<string, unknown> }): Promise<unknown[]> {
    return this.entries.findMany({ where: query.where, orderBy: { occurredAt: 'desc' } });
  }
}
