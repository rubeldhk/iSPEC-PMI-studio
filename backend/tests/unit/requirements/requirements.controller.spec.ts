/**
 * T069a — the requirements controller with a mocked service.
 * Written to FAIL before T070 exists (Constitution V).
 */
import { describe, expect, it, vi } from 'vitest';
import { RequirementsController } from '../../../src/modules/requirements/requirements.controller.js';
import type { RequirementsService, RequirementRecord } from '../../../src/modules/requirements/requirements.service.js';
import type { RequirementRetireService } from '../../../src/modules/requirements/requirement-retire.service.js';
import { NotFoundError, UnauthenticatedError } from '../../../src/core/errors.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

const ROW: RequirementRecord = {
  id: 'r1',
  workspaceId: 'ws_a',
  projectId: 'p1',
  reference: 'REQ-001',
  description: 'd',
  type: 'functional',
  priority: 'p1',
  status: 'active',
  contentHash: 'h',
  retiredAt: null,
  createdAt: new Date('2026-08-20T00:00:00Z'),
  updatedAt: new Date('2026-08-20T00:00:00Z'),
};

function mocks(): { svc: RequirementsService; retirer: RequirementRetireService } {
  return {
    svc: {
      create: vi.fn(async () => ROW),
      list: vi.fn(async () => [ROW]),
      get: vi.fn(async () => ROW),
      edit: vi.fn(async () => ROW),
      versions: vi.fn(async () => []),
    } as unknown as RequirementsService,
    retirer: {
      retire: vi.fn(async () => ({ ...ROW, status: 'retired' as const })),
    } as unknown as RequirementRetireService,
  };
}

describe('RequirementsController · wiring', () => {
  it('list delegates workspace, project, and the query filters', async () => {
    const { svc, retirer } = mocks();
    const c = new RequirementsController(svc, retirer);
    await c.list(CTX, 'p1', { type: 'functional', priority: 'p1', status: 'active' });
    expect(svc.list).toHaveBeenCalledWith('ws_a', 'p1', {
      type: 'functional',
      priority: 'p1',
      status: 'active',
    });
  });

  it('create delegates the acting context and body', async () => {
    const { svc, retirer } = mocks();
    const c = new RequirementsController(svc, retirer);
    await c.create(CTX, 'p1', { description: 'd', type: 'functional', priority: 'p1' });
    expect(svc.create).toHaveBeenCalledWith(CTX, 'p1', {
      description: 'd',
      type: 'functional',
      priority: 'p1',
    });
  });

  it('get, patch, retire, versions are workspace-scoped', async () => {
    const { svc, retirer } = mocks();
    const c = new RequirementsController(svc, retirer);
    await c.get(CTX, 'r1');
    expect(svc.get).toHaveBeenCalledWith('ws_a', 'r1');
    await c.patch(CTX, 'r1', { description: 'x' });
    expect(svc.edit).toHaveBeenCalledWith(CTX, 'r1', { description: 'x' });
    await c.retire(CTX, 'r1');
    expect(retirer.retire).toHaveBeenCalledWith('ws_a', 'r1');
    await c.versions(CTX, 'r1');
    expect(svc.versions).toHaveBeenCalledWith('ws_a', 'r1');
  });

  it('a body cannot smuggle scope fields past the controller', async () => {
    const { svc, retirer } = mocks();
    const c = new RequirementsController(svc, retirer);
    await c.create(CTX, 'p1', { description: 'd', workspaceId: 'ws_other', projectId: 'px' } as never);
    const body = (svc.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[2] as Record<string, unknown>;
    expect(body['workspaceId']).toBeUndefined();
    expect(body['projectId']).toBeUndefined();
  });
});

describe('RequirementsController · refusals', () => {
  it('no session is 401 on every route', async () => {
    const { svc, retirer } = mocks();
    const c = new RequirementsController(svc, retirer);
    for (const call of [
      (): Promise<unknown> => c.list(undefined, 'p1', {}),
      (): Promise<unknown> => c.create(undefined, 'p1', {}),
      (): Promise<unknown> => c.get(undefined, 'r1'),
      (): Promise<unknown> => c.patch(undefined, 'r1', {}),
      (): Promise<unknown> => c.retire(undefined, 'r1'),
      (): Promise<unknown> => c.versions(undefined, 'r1'),
    ]) {
      await expect(call()).rejects.toBeInstanceOf(UnauthenticatedError);
    }
  });

  it('propagates the opaque 404 untouched', async () => {
    const { svc, retirer } = mocks();
    (svc.get as ReturnType<typeof vi.fn>).mockRejectedValue(new NotFoundError('Not found.'));
    const c = new RequirementsController(svc, retirer);
    await expect(c.get(CTX, 'other')).rejects.toBeInstanceOf(NotFoundError);
  });
});
