/**
 * T112a — lifecycle and version endpoints with a mocked service.
 * Written to FAIL before T113 exists (Constitution V).
 */
import { describe, expect, it, vi } from 'vitest';
import { SpecificationLifecycleController } from '../../../src/modules/specifications/specifications.controller.js';
import type { SpecificationLifecycleApi } from '../../../src/modules/specifications/lifecycle-api.service.js';
import { UnauthenticatedError } from '../../../src/core/errors.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

function api(): SpecificationLifecycleApi {
  return {
    transition: vi.fn(async () => ({ id: 's1', lifecycleState: 'review' })),
    approve: vi.fn(async () => ({
      specification: { id: 's1', lifecycleState: 'approved' },
      outstandingFindings: [],
    })),
    archive: vi.fn(async () => ({ id: 's1', lifecycleState: 'archived' })),
    versions: vi.fn(async () => []),
    diff: vi.fn(async () => ({ fromVersion: 1, toVersion: 2, added: [], removed: [], unchanged: 0, identical: true })),
    findings: vi.fn(async () => []),
    submitValidation: vi.fn(async () => ({ id: 'job1', kind: 'validate_specification', state: 'queued', failureReason: null, startedAt: null, resultRef: null })),
  } as unknown as SpecificationLifecycleApi;
}

describe('SpecificationLifecycleController · the six transitions delegate with acting context', () => {
  it.each([
    ['submitForReview', 'review'],
    ['reject', 'draft'],
    ['baseline', 'baselined'],
    ['markImplemented', 'implemented'],
  ] as const)('%s → transition to %s', async (handler, to) => {
    const service = api();
    const c = new SpecificationLifecycleController(service);
    await (c[handler] as (ctx: unknown, id: string) => Promise<unknown>)(CTX, 's1');
    expect(service.transition).toHaveBeenCalledWith(
      { workspaceId: 'ws_a', userId: 'u1' },
      's1',
      to,
    );
  });

  it('approve routes through the approval service — findings ride the response', async () => {
    const service = api();
    const c = new SpecificationLifecycleController(service);
    const out = await c.approve(CTX, 's1');
    expect(service.approve).toHaveBeenCalledWith({ workspaceId: 'ws_a', userId: 'u1' }, 's1');
    expect(out).toHaveProperty('outstandingFindings');
  });

  it('archive has its own path — three legal source states, one target', async () => {
    const service = api();
    const c = new SpecificationLifecycleController(service);
    await c.archive(CTX, 's1');
    expect(service.archive).toHaveBeenCalledWith({ workspaceId: 'ws_a', userId: 'u1' }, 's1');
  });
});

describe('SpecificationLifecycleController · versions', () => {
  it('lists versions workspace-scoped', async () => {
    const service = api();
    const c = new SpecificationLifecycleController(service);
    await c.versions(CTX, 's1');
    expect(service.versions).toHaveBeenCalledWith('ws_a', 's1');
  });

  it('diffs two versions by their numbers', async () => {
    const service = api();
    const c = new SpecificationLifecycleController(service);
    await c.diff(CTX, 's1', '1', '3');
    expect(service.diff).toHaveBeenCalledWith('ws_a', 's1', 1, 3);
  });
});

describe('SpecificationLifecycleController · refusals', () => {
  it('no session is 401 on every route', async () => {
    const c = new SpecificationLifecycleController(api());
    for (const call of [
      (): Promise<unknown> => c.submitForReview(undefined, 's1'),
      (): Promise<unknown> => c.reject(undefined, 's1'),
      (): Promise<unknown> => c.approve(undefined, 's1'),
      (): Promise<unknown> => c.baseline(undefined, 's1'),
      (): Promise<unknown> => c.markImplemented(undefined, 's1'),
      (): Promise<unknown> => c.archive(undefined, 's1'),
      (): Promise<unknown> => c.versions(undefined, 's1'),
      (): Promise<unknown> => c.diff(undefined, 's1', '1', '2'),
    ]) {
      await expect(call()).rejects.toBeInstanceOf(UnauthenticatedError);
    }
  });
});
