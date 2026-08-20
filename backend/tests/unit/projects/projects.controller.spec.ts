/**
 * T054a — the projects controller with a mocked service.
 * Written to FAIL before T055 exists (Constitution V).
 *
 * Covers route wiring and the cross-workspace not-found rule: a resource in
 * another workspace and one that does not exist produce an IDENTICAL 404
 * (FR-002 / SC-004), while a missing session is 401 — those are different
 * failures and must not be conflated.
 */
import { describe, expect, it, vi } from 'vitest';
import { ProjectsController } from '../../../src/modules/projects/projects.controller.js';
import type { ProjectsService, ProjectRecord } from '../../../src/modules/projects/projects.service.js';
import { NotFoundError, UnauthenticatedError } from '../../../src/core/errors.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

const ROW: ProjectRecord = {
  id: 'p1',
  workspaceId: 'ws_a',
  name: 'P',
  description: null,
  status: 'active',
  engineName: null,
  ownerUserId: 'u1',
  archivedAt: null,
  createdAt: new Date('2026-08-20T00:00:00Z'),
  updatedAt: new Date('2026-08-20T00:00:00Z'),
};

function mockService(): ProjectsService {
  return {
    create: vi.fn(async () => ROW),
    list: vi.fn(async () => [ROW]),
    get: vi.fn(async () => ROW),
    update: vi.fn(async () => ROW),
    archive: vi.fn(async () => ({ ...ROW, status: 'archived' as const })),
    findEngineNameForProject: vi.fn(async () => null),
  } as unknown as ProjectsService;
}

describe('ProjectsController · wiring', () => {
  it('list delegates with the acting workspace', async () => {
    const svc = mockService();
    const c = new ProjectsController(svc);
    await c.list(CTX);
    expect(svc.list).toHaveBeenCalledWith('ws_a');
  });

  it('create delegates with the full acting context', async () => {
    const svc = mockService();
    const c = new ProjectsController(svc);
    await c.create(CTX, { name: 'P' });
    expect(svc.create).toHaveBeenCalledWith(CTX, { name: 'P' });
  });

  it('get, patch, and archive are scoped by workspace AND id', async () => {
    const svc = mockService();
    const c = new ProjectsController(svc);
    await c.get(CTX, 'p1');
    expect(svc.get).toHaveBeenCalledWith('ws_a', 'p1');
    await c.patch(CTX, 'p1', { name: 'Q' });
    expect(svc.update).toHaveBeenCalledWith('ws_a', 'p1', { name: 'Q' });
    await c.archive(CTX, 'p1');
    expect(svc.archive).toHaveBeenCalledWith('ws_a', 'p1');
  });

  it('a caller-supplied workspaceId in the body cannot widen the scope', async () => {
    const svc = mockService();
    const c = new ProjectsController(svc);
    await c.create(CTX, { name: 'P', workspaceId: 'ws_other' } as never);
    const arg = (svc.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(arg['workspaceId']).toBeUndefined();
  });
});

describe('ProjectsController · cross-workspace not-found (FR-002)', () => {
  it('propagates the opaque 404 for a resource in another workspace', async () => {
    const svc = mockService();
    (svc.get as ReturnType<typeof vi.fn>).mockRejectedValue(new NotFoundError('Not found.'));
    const c = new ProjectsController(svc);
    await expect(c.get(CTX, 'someone-elses')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('a missing session is 401 unauthenticated, not 404', async () => {
    const c = new ProjectsController(mockService());
    for (const call of [
      (): Promise<unknown> => c.list(undefined),
      (): Promise<unknown> => c.create(undefined, { name: 'P' }),
      (): Promise<unknown> => c.get(undefined, 'p1'),
      (): Promise<unknown> => c.patch(undefined, 'p1', {}),
      (): Promise<unknown> => c.archive(undefined, 'p1'),
    ]) {
      await expect(call()).rejects.toBeInstanceOf(UnauthenticatedError);
    }
  });
});
