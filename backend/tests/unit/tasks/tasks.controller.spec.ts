/**
 * T098a — the tasks controller with a mocked service: route wiring, the
 * approval-gate refusal, status update, cross-workspace not-found.
 * Written to FAIL before T102a exists (Constitution V).
 */
import { describe, expect, it, vi } from 'vitest';
import { TasksController } from '../../../src/modules/tasks/tasks.controller.js';
import type { TasksApi } from '../../../src/modules/tasks/tasks.controller.js';
import {
  NotFoundError,
  SpecificationNotApprovedError,
  UnauthenticatedError,
  toErrorBody,
  toHttpStatus,
} from '../../../src/core/errors.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

function api(): TasksApi {
  return {
    submitGeneration: vi.fn(async () => ({
      id: 'job1',
      kind: 'generate_tasks',
      state: 'queued',
      failureReason: null,
      startedAt: null,
      resultRef: null,
    })),
    listForSpecification: vi.fn(async () => []),
    updateStatus: vi.fn(async () => ({ id: 't1', status: 'done' })),
    progressForProject: vi.fn(async () => ({
      total: 0,
      done: 0,
      inProgress: 0,
      notStarted: 0,
      percentComplete: 0,
    })),
  } as unknown as TasksApi;
}

describe('TasksController · wiring', () => {
  it('POST generate-tasks delegates with the acting context', async () => {
    const service = api();
    const c = new TasksController(service);
    await c.generate(CTX, 's1');
    expect(service.submitGeneration).toHaveBeenCalledWith({ workspaceId: 'ws_a', userId: 'u1' }, 's1');
  });

  it('list, status, and progress are workspace-scoped', async () => {
    const service = api();
    const c = new TasksController(service);
    await c.list(CTX, 's1');
    expect(service.listForSpecification).toHaveBeenCalledWith('ws_a', 's1');
    await c.patch(CTX, 't1', { status: 'done' });
    expect(service.updateStatus).toHaveBeenCalledWith('ws_a', 't1', 'done');
    await c.progress(CTX, 'p1');
    expect(service.progressForProject).toHaveBeenCalledWith('ws_a', 'p1');
  });
});

describe('TasksController · the approval gate (FR-020, US4 scenario 2)', () => {
  it('propagates 422 specification_not_approved untouched', async () => {
    const service = api();
    (service.submitGeneration as ReturnType<typeof vi.fn>).mockRejectedValue(
      new SpecificationNotApprovedError('draft'),
    );
    const c = new TasksController(service);
    const err = await c.generate(CTX, 's1').catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(422);
    expect(toErrorBody(err).error.code).toBe('specification_not_approved');
  });
});

describe('TasksController · refusals', () => {
  it('cross-workspace is the opaque 404', async () => {
    const service = api();
    (service.updateStatus as ReturnType<typeof vi.fn>).mockRejectedValue(new NotFoundError('Not found.'));
    const c = new TasksController(service);
    const err = await c.patch(CTX, 'someone-elses', { status: 'done' }).catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(404);
  });

  it('no session is 401 on every route', async () => {
    const c = new TasksController(api());
    for (const call of [
      (): Promise<unknown> => c.generate(undefined, 's1'),
      (): Promise<unknown> => c.list(undefined, 's1'),
      (): Promise<unknown> => c.patch(undefined, 't1', { status: 'done' }),
      (): Promise<unknown> => c.progress(undefined, 'p1'),
    ]) {
      await expect(call()).rejects.toBeInstanceOf(UnauthenticatedError);
    }
  });
});
