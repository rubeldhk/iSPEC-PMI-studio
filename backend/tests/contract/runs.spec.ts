/**
 * T416 — contract tests for the run endpoints — start, list, get, cancel,
 * continue — against
 * `specs/002-team-review-access-storage/contracts/platform-api-epic-002.md`
 * (Runs · FR-RUN-001 to FR-RUN-008a).
 *
 * The contract's claims, asserted one by one:
 *   - 202 Accepted with a run resource — runs are asynchronous;
 *   - `mode` and `stopRange` are required;
 *   - `reached_stop_point` is a SUCCESS state, not an error;
 *   - wrong tenant → 404, absence — never 403.
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationFailedError, toHttpStatus } from '../../src/core/errors.js';
import { RunsController } from '../../src/modules/runs/runs.controller.js';
import { InMemoryRunStore, RunModeService } from '../../src/modules/runs/run-mode.service.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };
const PROJECT = 'proj_1';

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = RunsController.prototype[handler as keyof RunsController] as object;
  return {
    path: Reflect.getMetadata('path', fn) as string,
    method: Reflect.getMetadata('method', fn) as RequestMethod,
  };
}

function build(): { controller: RunsController; service: RunModeService } {
  const service = new RunModeService(new InMemoryRunStore());
  return { controller: new RunsController(service), service };
}

describe('contract · run route surface', () => {
  it.each([
    ['start', 'projects/:projectId/runs', RequestMethod.POST],
    ['list', 'projects/:projectId/runs', RequestMethod.GET],
    ['get', 'runs/:id', RequestMethod.GET],
    ['cancel', 'runs/:id/cancel', RequestMethod.POST],
    ['continueRun', 'runs/:id/continue', RequestMethod.POST],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });

  it('start, cancel and continue answer 202 Accepted — runs are asynchronous', () => {
    for (const handler of ['start', 'cancel', 'continueRun'] as const) {
      expect(Reflect.getMetadata('__httpCode__', RunsController.prototype[handler])).toBe(202);
    }
  });
});

describe('contract · required fields', () => {
  it('mode is required', async () => {
    const { controller } = build();
    const attempt = controller.start(CTX, PROJECT, { stopRange: 'through_tasks' });
    await expect(attempt).rejects.toThrow(ValidationFailedError);
    expect(toHttpStatus(await attempt.catch((e: unknown) => e))).toBe(400);
  });

  it('stopRange is required', async () => {
    const { controller } = build();
    await expect(controller.start(CTX, PROJECT, { mode: 'unattended' })).rejects.toThrow(
      ValidationFailedError,
    );
  });
});

describe('contract · reached_stop_point is a success state (FR-RUN-008a)', () => {
  it('a stopped run answers 200-shaped data with the stop reported, never an error', async () => {
    const { controller, service } = build();
    const started = await controller.start(CTX, PROJECT, {
      mode: 'unattended',
      stopRange: 'after_specification',
    });
    await service.reachStopPoint(CTX.workspaceId, started.id);
    const body = await controller.get(CTX, started.id);
    expect(body.state).toBe('reached_stop_point');
    expect(body.stoppedAtSelectedRange).toBe(true);
  });

  it('continue moves the stopped run onward (FR-RUN-008a)', async () => {
    const { controller, service } = build();
    const started = await controller.start(CTX, PROJECT, {
      mode: 'unattended',
      stopRange: 'after_specification',
    });
    await service.reachStopPoint(CTX.workspaceId, started.id);
    const continued = await controller.continueRun(CTX, started.id);
    expect(continued.state).toBe('running');
  });
});

describe('contract · the artifact rule', () => {
  it('wrong tenant → 404, never 403', async () => {
    const { controller } = build();
    const started = await controller.start(CTX, PROJECT, {
      mode: 'unattended',
      stopRange: 'through_tasks',
    });
    const attempt = controller.get({ workspaceId: 'ws_b', userId: 'u2' }, started.id);
    await expect(attempt).rejects.toThrow(NotFoundError);
    expect(toHttpStatus(await attempt.catch((e: unknown) => e))).toBe(404);
  });

  it('cancellation preserves the run resource and reports why it ended', async () => {
    const { controller } = build();
    const started = await controller.start(CTX, PROJECT, {
      mode: 'unattended',
      stopRange: 'through_tasks',
    });
    const cancelled = await controller.cancel(CTX, started.id);
    expect(cancelled.state).toBe('cancelled');
    expect(cancelled.outcomeReason).toContain('preserved');
  });
});
