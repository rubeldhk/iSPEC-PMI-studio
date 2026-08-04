/**
 * T029 — transactional audit.
 *
 * FR-033 / SC-012: the action and its audit entry commit or roll back together.
 * That is the whole guarantee — an action cannot succeed unrecorded, and a
 * rolled-back action leaves no orphan audit row claiming it happened.
 *
 * Framework-free (PC-1): despite the name, this is not a NestJS interceptor.
 * It is a plain higher-order function so services can use it without a
 * transport, and so it is trivially testable.
 */
import type { AuditRecordInput, AuditService, AuditWriter } from './audit.service.js';

export interface TransactionalDb {
  transaction<T>(fn: (tx: AuditWriter) => Promise<T>): Promise<T>;
}

/**
 * Run `action` and record it in the same transaction.
 *
 * The audit write happens BEFORE the action returns but inside the same
 * transaction, so if the action throws, the surrounding transaction discards
 * both.
 */
export async function auditedTransaction<T>(
  db: TransactionalDb,
  audit: AuditService,
  entry: AuditRecordInput,
  action: (tx: AuditWriter) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await action(tx);
    await audit.record(entry, tx);
    return result;
  });
}
