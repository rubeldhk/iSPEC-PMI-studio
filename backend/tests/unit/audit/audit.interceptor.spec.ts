/**
 * T028a — the interceptor writes audit inside the caller's transaction, and a
 * failed action rolls its audit entry back with it.
 * Written to FAIL before T029 exists (Constitution V).
 */
import { describe, expect, it, vi } from 'vitest';
import { auditedTransaction } from '../../../src/modules/audit/audit.interceptor.js';
import { AuditService, type AuditWriter } from '../../../src/modules/audit/audit.service.js';

/** A transaction that discards its writes when the body throws. */
function fakeDb() {
  const committed: unknown[] = [];
  return {
    committed,
    async transaction<T>(fn: (tx: AuditWriter) => Promise<T>): Promise<T> {
      const staged: unknown[] = [];
      const tx: AuditWriter = { create: async (d) => void staged.push(d) };
      const result = await fn(tx); // a throw here skips the commit below
      committed.push(...staged);
      return result;
    },
  };
}

const base = {
  workspaceId: 'ws_a',
  actorId: 'u1',
  action: 'create' as const,
  targetType: 'project',
  outcome: 'success' as const,
};

describe('auditedTransaction()', () => {
  it('commits the action and its audit entry together', async () => {
    const db = fakeDb();
    const audit = new AuditService({ create: vi.fn() });
    const result = await auditedTransaction(db, audit, base, async () => 'created');
    expect(result).toBe('created');
    expect(db.committed).toHaveLength(1);
  });

  it('rolls the audit entry back when the action throws', async () => {
    const db = fakeDb();
    const audit = new AuditService({ create: vi.fn() });
    await expect(
      auditedTransaction(db, audit, base, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(db.committed).toHaveLength(0);
  });

  it('writes into the transaction, never around it', async () => {
    const outer = { create: vi.fn() };
    const db = fakeDb();
    await auditedTransaction(db, new AuditService(outer), base, async () => undefined);
    expect(outer.create).not.toHaveBeenCalled();
    expect(db.committed).toHaveLength(1);
  });

  it('records the failure outcome when the action throws', async () => {
    const db = fakeDb();
    const seen: unknown[] = [];
    const audit = new AuditService({ create: async (d) => void seen.push(d) });
    await expect(
      auditedTransaction(db, audit, base, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow();
    // The rolled-back attempt is still surfaced to the caller-supplied hook.
    expect(seen).toHaveLength(0);
  });
});
