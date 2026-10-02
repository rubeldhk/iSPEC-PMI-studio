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
  rootPath: null,
  agentIntegration: null,
  scriptType: null,
  provisioningState: 'not_provisioned',
  provisionedAt: null,
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
    const c = new ProjectsController(svc, mockProvisioning());
    await c.list(CTX);
    expect(svc.list).toHaveBeenCalledWith('ws_a');
  });

  it('create delegates with the full acting context', async () => {
    const svc = mockService();
    const c = new ProjectsController(svc, mockProvisioning());
    await c.create(CTX, { name: 'P' });
    expect(svc.create).toHaveBeenCalledWith(CTX, { name: 'P' });
  });

  it('get, patch, and archive are scoped by workspace AND id', async () => {
    const svc = mockService();
    const c = new ProjectsController(svc, mockProvisioning());
    await c.get(CTX, 'p1');
    expect(svc.get).toHaveBeenCalledWith('ws_a', 'p1');
    await c.patch(CTX, 'p1', { name: 'Q' });
    expect(svc.update).toHaveBeenCalledWith('ws_a', 'p1', { name: 'Q' });
    await c.archive(CTX, 'p1');
    expect(svc.archive).toHaveBeenCalledWith('ws_a', 'p1');
  });

  it('a caller-supplied workspaceId in the body cannot widen the scope', async () => {
    const svc = mockService();
    const c = new ProjectsController(svc, mockProvisioning());
    await c.create(CTX, { name: 'P', workspaceId: 'ws_other' } as never);
    const arg = (svc.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(arg['workspaceId']).toBeUndefined();
  });
});

/**
 * `T1349` (EPIC-041) — the provisioning routes.
 *
 * `FR-LPW-001`, `FR-LPW-050`; contracts/provisioning-api.md. `POST /projects`
 * with a `rootPath` provisions after the row; a refused root creates NO row;
 * `POST /projects/:id/provision` answers 202 for a prepared/resumed run and 200
 * for a no-op; `GET /projects/:id` refreshes the pending state and carries the
 * latest record. The credential shown once on create is `T1350`'s later half
 * (US2) and is asserted there.
 */
const PREPARED: ProjectRecord = { ...ROW, rootPath: '/home/dev/pmi/alpha', agentIntegration: 'claude', scriptType: 'sh', provisioningState: 'prepared' };
const RECORD = {
  id: 'prov_1', workspaceId: 'ws_a', projectId: 'p1', actorId: 'u1', correlationId: 'c', startedAt: new Date(), endedAt: new Date(),
  outcome: 'succeeded' as const, stepsCompleted: ['check_root'] as const, failedStep: null, failureReason: null, engineTag: 'v0.16.4', bundleVersion: '0.1.0', filesWritten: [],
};

function mockProvisioning(over: Partial<{ check: unknown; prepare: unknown; refresh: unknown; history: unknown }> = {}) {
  return {
    check: vi.fn(async () => undefined),
    prepare: vi.fn(async () => ({ project: PREPARED, record: RECORD })),
    refresh: vi.fn(async () => PREPARED),
    history: vi.fn(async () => [RECORD]),
    ...over,
  } as unknown as import('../../../src/modules/projects/provisioning.service.js').ProvisioningService;
}

describe('T1349 · provisioning routes', () => {
  it('POST /projects with a rootPath creates the row then provisions it, and reports the state', async () => {
    const svc = mockService();
    const prov = mockProvisioning();
    const c = new ProjectsController(svc, prov);
    const body = await c.create(CTX, { name: 'P', rootPath: 'alpha', agentIntegration: 'claude', scriptType: 'sh' });
    expect(svc.create).toHaveBeenCalledWith(CTX, expect.objectContaining({ name: 'P' }));
    expect(prov.prepare).toHaveBeenCalledWith(CTX, 'p1', { rootPath: 'alpha', agentIntegration: 'claude', scriptType: 'sh' });
    expect(body.provisioningState).toBe('prepared');
    expect(body.latestProvisioning).toMatchObject({ outcome: 'succeeded' });
  });

  it('POST /projects with a rootPath outside the root creates NO row', async () => {
    const svc = mockService();
    const c = new ProjectsController(svc, mockProvisioning({ check: vi.fn(async () => { throw new Error('outside the projects root'); }) }));
    // The refusal is decided before the row exists: the controller asks the
    // provisioning service to check the root first, then creates.
    await expect(c.create(CTX, { name: 'P', rootPath: '/tmp/elsewhere' })).rejects.toThrow(/outside/);
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('POST /projects without a rootPath behaves exactly as before', async () => {
    const svc = mockService();
    const prov = mockProvisioning();
    const c = new ProjectsController(svc, prov);
    const body = await c.create(CTX, { name: 'P' });
    expect(prov.prepare).not.toHaveBeenCalled();
    expect(body.provisioningState).toBe('not_provisioned');
  });

  it('POST /projects/:id/provision returns 202 for a run and 200 for a no-op', async () => {
    const prov = mockProvisioning();
    const c = new ProjectsController(mockService(), prov);
    const res = { status: vi.fn() };
    await c.provision(CTX, 'p1', { rootPath: 'alpha' }, res as never);
    expect(res.status).toHaveBeenCalledWith(202);
    (prov.prepare as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ project: PREPARED, record: { ...RECORD, outcome: 'no_change' } });
    await c.provision(CTX, 'p1', { rootPath: 'alpha' }, res as never);
    expect(res.status).toHaveBeenLastCalledWith(200);
  });

  it('GET /projects/:id refreshes the pending state and carries the latest record', async () => {
    const prov = mockProvisioning();
    const c = new ProjectsController(mockService(), prov);
    const body = await c.get(CTX, 'p1');
    expect(prov.refresh).toHaveBeenCalledWith('ws_a', 'p1');
    expect(body.latestProvisioning).toMatchObject({ outcome: 'succeeded' });
  });

  it('GET /projects/:id/provisioning lists every record', async () => {
    const prov = mockProvisioning();
    const c = new ProjectsController(mockService(), prov);
    expect(await c.provisioning(CTX, 'p1')).toHaveLength(1);
    expect(prov.history).toHaveBeenCalledWith('ws_a', 'p1');
  });
});

describe('ProjectsController · cross-workspace not-found (FR-002)', () => {
  it('propagates the opaque 404 for a resource in another workspace', async () => {
    const svc = mockService();
    (svc.get as ReturnType<typeof vi.fn>).mockRejectedValue(new NotFoundError('Not found.'));
    const c = new ProjectsController(svc, mockProvisioning());
    await expect(c.get(CTX, 'someone-elses')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('a missing session is 401 unauthenticated, not 404', async () => {
    const c = new ProjectsController(mockService(), mockProvisioning());
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
