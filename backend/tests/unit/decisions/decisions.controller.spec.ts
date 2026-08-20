/**
 * T144b — the ADR controller with a mocked service: route wiring and
 * cross-workspace access returning NOT-FOUND, never forbidden.
 * Written to FAIL before T143b exists (Constitution V).
 */
import { describe, expect, it, vi } from 'vitest';
import { DecisionsController } from '../../../src/modules/decisions/decisions.controller.js';
import type { AdrRecord, DecisionsService } from '../../../src/modules/decisions/decisions.service.js';
import { NotFoundError, UnauthenticatedError } from '../../../src/core/errors.js';
import { toErrorBody, toHttpStatus } from '../../../src/core/errors.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

const ROW: AdrRecord = {
  id: 'a1',
  workspaceId: 'ws_a',
  projectId: 'p1',
  reference: 'ADR-0001',
  title: 'T',
  status: 'proposed',
  context: 'c',
  decision: 'd',
  consequences: 'q',
  createdAt: new Date('2026-08-20T00:00:00Z'),
  updatedAt: new Date('2026-08-20T00:00:00Z'),
};

function mockService(): DecisionsService {
  return {
    create: vi.fn(async () => ROW),
    list: vi.fn(async () => [ROW]),
    get: vi.fn(async () => ROW),
    update: vi.fn(async () => ROW),
    linkSpecifications: vi.fn(async () => ['s1']),
    unlinkSpecifications: vi.fn(async () => []),
  } as unknown as DecisionsService;
}

describe('DecisionsController · wiring', () => {
  it('list and create are project-nested and workspace-scoped', async () => {
    const svc = mockService();
    const c = new DecisionsController(svc);
    await c.list(CTX, 'p1');
    expect(svc.list).toHaveBeenCalledWith('ws_a', 'p1');
    await c.create(CTX, 'p1', { title: 'T' });
    expect(svc.create).toHaveBeenCalledWith(CTX, 'p1', { title: 'T' });
  });

  it('patch (including status changes) and links are id-scoped', async () => {
    const svc = mockService();
    const c = new DecisionsController(svc);
    await c.patch(CTX, 'a1', { status: 'accepted' });
    expect(svc.update).toHaveBeenCalledWith('ws_a', 'a1', { status: 'accepted' });
    await c.link(CTX, 'a1', { specificationIds: ['s1'] });
    expect(svc.linkSpecifications).toHaveBeenCalledWith('ws_a', 'a1', ['s1']);
  });

  it('a body cannot smuggle scope fields', async () => {
    const svc = mockService();
    const c = new DecisionsController(svc);
    await c.create(CTX, 'p1', { title: 'T', workspaceId: 'ws_other', projectId: 'px' } as never);
    const body = (svc.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[2] as Record<string, unknown>;
    expect(body['workspaceId']).toBeUndefined();
    expect(body['projectId']).toBeUndefined();
  });
});

describe('DecisionsController · refusals', () => {
  it('cross-workspace access is 404 not-found, NEVER 403', async () => {
    const svc = mockService();
    (svc.get as ReturnType<typeof vi.fn>).mockRejectedValue(new NotFoundError('Not found.'));
    const c = new DecisionsController(svc);
    const err = await c.get(CTX, 'someone-elses').catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(404);
    expect(toErrorBody(err).error.code).toBe('not_found');
  });

  it('no session is 401 on every route', async () => {
    const c = new DecisionsController(mockService());
    for (const call of [
      (): Promise<unknown> => c.list(undefined, 'p1'),
      (): Promise<unknown> => c.create(undefined, 'p1', {}),
      (): Promise<unknown> => c.get(undefined, 'a1'),
      (): Promise<unknown> => c.patch(undefined, 'a1', {}),
      (): Promise<unknown> => c.link(undefined, 'a1', { specificationIds: [] }),
    ]) {
      await expect(call()).rejects.toBeInstanceOf(UnauthenticatedError);
    }
  });
});
