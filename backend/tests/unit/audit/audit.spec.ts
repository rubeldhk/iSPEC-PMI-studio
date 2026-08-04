/**
 * T027 — audit is written in the caller's transaction, and is append-only.
 * Written to FAIL before T028 exists (Constitution V).
 *
 * FR-033 / SC-012: an action cannot succeed without its audit entry.
 */
import { describe, expect, it, vi } from 'vitest';
import { AuditService, type AuditWriter } from '../../../src/modules/audit/audit.service.js';

function writer(): AuditWriter & { rows: unknown[] } {
  const rows: unknown[] = [];
  return {
    rows,
    create: vi.fn(async (data: unknown) => {
      rows.push(data);
    }),
  };
}

describe('AuditService', () => {
  it('records actor, action, target, outcome and workspace', async () => {
    const w = writer();
    const svc = new AuditService(w);
    await svc.record({
      workspaceId: 'ws_a',
      actorId: 'u1',
      action: 'create',
      targetType: 'project',
      targetId: 'p1',
      outcome: 'success',
    });
    expect(w.rows[0]).toMatchObject({
      workspaceId: 'ws_a',
      actorId: 'u1',
      action: 'create',
      targetType: 'project',
      outcome: 'success',
    });
  });

  it('permits a null actor ONLY for a refusal', async () => {
    const svc = new AuditService(writer());
    await expect(
      svc.record({
        workspaceId: 'ws_a',
        actorId: null,
        action: 'access_refused',
        targetType: 'project',
        outcome: 'refused',
      }),
    ).resolves.toBeUndefined();

    await expect(
      svc.record({
        workspaceId: 'ws_a',
        actorId: null,
        action: 'create',
        targetType: 'project',
        outcome: 'success',
      }),
    ).rejects.toThrow(/actor/i);
  });

  it('uses the transaction it is given, not a fresh connection', async () => {
    const outer = writer();
    const tx = writer();
    const svc = new AuditService(outer);
    await svc.record(
      {
        workspaceId: 'ws_a',
        actorId: 'u1',
        action: 'update',
        targetType: 'project',
        outcome: 'success',
      },
      tx,
    );
    expect(tx.rows).toHaveLength(1);
    expect(outer.rows).toHaveLength(0);
  });

  it('exposes no update or delete path', () => {
    const svc = new AuditService(writer()) as unknown as Record<string, unknown>;
    expect(svc['update']).toBeUndefined();
    expect(svc['delete']).toBeUndefined();
    expect(svc['remove']).toBeUndefined();
    const names = Object.getOwnPropertyNames(AuditService.prototype);
    expect(names).not.toContain('update');
    expect(names).not.toContain('delete');
  });

  it('never records engine output or a credential in detail', async () => {
    const w = writer();
    const svc = new AuditService(w);
    await svc.record({
      workspaceId: 'ws_a',
      actorId: 'u1',
      action: 'engine_invocation',
      targetType: 'generation_job',
      outcome: 'success',
      detail: { engine: 'fixture', secret: 'sk-abc123', contentRaw: '# spec' },
    });
    const stored = JSON.stringify(w.rows[0]);
    expect(stored).not.toContain('sk-abc123');
    expect(stored).not.toContain('# spec');
    expect(stored).toContain('fixture');
  });
});
