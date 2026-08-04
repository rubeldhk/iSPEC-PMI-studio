/**
 * T029a — the audit endpoint exposes no write or delete route.
 * Written to FAIL before T030 exists (Constitution V).
 */
import { describe, expect, it, vi } from 'vitest';
import { AuditController } from '../../../src/modules/audit/audit.controller.js';
import type { AuditReader } from '../../../src/modules/audit/audit.controller.js';

function reader(rows: unknown[] = []): AuditReader {
  return { list: vi.fn(async () => rows) };
}

describe('AuditController', () => {
  it('lists entries scoped to the acting workspace', async () => {
    const r = reader([{ id: 'a1' }]);
    const c = new AuditController(r);
    const out = await c.list({ workspaceId: 'ws_a', userId: 'u1' }, {});
    expect(out).toEqual([{ id: 'a1' }]);
    expect(r.list).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'ws_a' }) }),
    );
  });

  it('refuses to run without a workspace context', async () => {
    const c = new AuditController(reader());
    await expect(c.list(undefined, {})).rejects.toThrow();
  });

  it('cannot be widened by a caller-supplied workspace filter', async () => {
    const r = reader();
    const c = new AuditController(r);
    await c.list({ workspaceId: 'ws_a', userId: 'u1' }, { workspaceId: 'ws_other' });
    const arg = (r.list as unknown as { mock: { calls: [{ where: { workspaceId: string } }][] } })
      .mock.calls[0]?.[0];
    expect(arg?.where.workspaceId).toBe('ws_a');
  });

  it('exposes ONLY read routes', () => {
    const methods = Object.getOwnPropertyNames(AuditController.prototype).filter(
      (m) => m !== 'constructor',
    );
    expect(methods).toEqual(['list']);
    for (const forbidden of ['create', 'update', 'delete', 'remove', 'patch', 'put']) {
      expect(methods).not.toContain(forbidden);
    }
  });
});
