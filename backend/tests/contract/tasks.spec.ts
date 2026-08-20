/**
 * T098 — contract tests for task endpoints against `contracts/platform-api.md`
 * (Tasks · US4, Generation jobs).
 */
import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import { TasksController, type TasksApi } from '../../src/modules/tasks/tasks.controller.js';
import {
  SpecificationNotApprovedError,
  toErrorBody,
  toHttpStatus,
} from '../../src/core/errors.js';

const PATH = 'path';
const METHOD = 'method';
const CTX = { workspaceId: 'ws_a', userId: 'u1' };

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = TasksController.prototype[handler as keyof TasksController] as object;
  return {
    path: Reflect.getMetadata(PATH, fn) as string,
    method: Reflect.getMetadata(METHOD, fn) as RequestMethod,
  };
}

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
    updateStatus: vi.fn(async () => ({ id: 't1', status: 'in_progress' })),
    progressForProject: vi.fn(async () => ({
      total: 4,
      done: 1,
      inProgress: 1,
      notStarted: 2,
      percentComplete: 25,
    })),
  } as unknown as TasksApi;
}

describe('contract · Tasks route surface (US4)', () => {
  it.each([
    ['generate', 'specifications/:id/jobs/generate-tasks', RequestMethod.POST],
    ['list', 'specifications/:id/tasks', RequestMethod.GET],
    ['patch', 'tasks/:id', RequestMethod.PATCH],
    ['progress', 'projects/:projectId/progress', RequestMethod.GET],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });

  it('generation is ALWAYS asynchronous — 202 with a job body', async () => {
    expect(Reflect.getMetadata('__httpCode__', TasksController.prototype.generate)).toBe(202);
    const out = await new TasksController(api()).generate(CTX, 's1');
    expect(out.kind).toBe('generate_tasks');
    expect(out.state).toBe('queued');
  });
});

describe('contract · the approval gate over HTTP (FR-020, US4 scenario 2)', () => {
  it('an unapproved specification is 422 specification_not_approved, naming the required state', async () => {
    const service = api();
    (service.submitGeneration as ReturnType<typeof vi.fn>).mockRejectedValue(
      new SpecificationNotApprovedError('review'),
    );
    const err = await new TasksController(service).generate(CTX, 's1').catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(422);
    const body = toErrorBody(err);
    expect(body.error.code).toBe('specification_not_approved');
    expect(body.error.details).toEqual({ currentState: 'review', requiredState: 'approved' });
  });
});

describe('contract · progress (US4 scenario 3)', () => {
  it('aggregates task progress for the project', async () => {
    const out = await new TasksController(api()).progress(CTX, 'p1');
    expect(out).toEqual({ total: 4, done: 1, inProgress: 1, notStarted: 2, percentComplete: 25 });
  });
});
