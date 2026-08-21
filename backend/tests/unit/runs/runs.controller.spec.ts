/**
 * T415 — the runs controller: `reached_stop_point` is returned as a SUCCESS
 * state, and cross-workspace access is ABSENT rather than forbidden.
 *
 * Written to FAIL before T417 exists (Constitution V).
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { NotFoundError, UnauthenticatedError, toHttpStatus } from '../../../src/core/errors.js';
import { RunsController, toRunBody } from '../../../src/modules/runs/runs.controller.js';
import { InMemoryRunStore, RunModeService } from '../../../src/modules/runs/run-mode.service.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };
const OTHER = { workspaceId: 'ws_b', userId: 'u2' };
const PROJECT = 'proj_1';

function build(): { controller: RunsController; service: RunModeService } {
  const service = new RunModeService(new InMemoryRunStore());
  return { controller: new RunsController(service), service };
}

describe('T415 · runs controller', () => {
  it('starts a run and answers the run body', async () => {
    const { controller } = build();
    const body = await controller.start(CTX, PROJECT, {
      mode: 'unattended',
      stopRange: 'after_specification',
    });
    expect(body.state).toBe('running');
    expect(body.projectId).toBe(PROJECT);
    expect(body.stoppedAtSelectedRange).toBe(false);
  });

  it('returns reached_stop_point as a SUCCESS state, not an error (FR-RUN-008a)', async () => {
    const { controller, service } = build();
    const started = await controller.start(CTX, PROJECT, {
      mode: 'unattended',
      stopRange: 'after_specification',
    });
    await service.reachStopPoint(CTX.workspaceId, started.id);

    // A GET on the stopped run RESOLVES — no throw, no error mapping.
    const body = await controller.get(CTX, started.id);
    expect(body.state).toBe('reached_stop_point');
    expect(body.stoppedAtSelectedRange).toBe(true);
    expect(body.outcomeReason).toContain('after_specification');
  });

  it('cross-workspace access is ABSENT — 404, never 403', async () => {
    const { controller } = build();
    const started = await controller.start(CTX, PROJECT, {
      mode: 'unattended',
      stopRange: 'through_tasks',
    });
    const attempt = controller.get(OTHER, started.id);
    await expect(attempt).rejects.toThrow(NotFoundError);
    expect(toHttpStatus(await attempt.catch((e: unknown) => e))).toBe(404);
  });

  it('lists only the caller workspace runs', async () => {
    const { controller } = build();
    await controller.start(CTX, PROJECT, { mode: 'unattended', stopRange: 'through_tasks' });
    expect(await controller.list(CTX, PROJECT)).toHaveLength(1);
    expect(await controller.list(OTHER, PROJECT)).toHaveLength(0);
  });

  it('cancel and continue delegate and answer run bodies', async () => {
    const { controller, service } = build();
    const a = await controller.start(CTX, PROJECT, { mode: 'unattended', stopRange: 'after_specification' });
    expect((await controller.cancel(CTX, a.id)).state).toBe('cancelled');

    const b = await controller.start(CTX, PROJECT, { mode: 'unattended', stopRange: 'after_specification' });
    await service.reachStopPoint(CTX.workspaceId, b.id);
    expect((await controller.continueRun(CTX, b.id)).state).toBe('running');
  });

  it('refuses an unauthenticated caller', async () => {
    const { controller } = build();
    await expect(controller.list(undefined, PROJECT)).rejects.toThrow(UnauthenticatedError);
  });

  it('toRunBody carries the documented fields', () => {
    const keys = Object.keys(
      toRunBody({
        id: 'r1', workspaceId: 'ws', projectId: 'p', mode: 'unattended',
        stopRange: 'through_tasks', state: 'running', accessSnapshot: null,
        initiatedById: 'u', startedAt: new Date(), endedAt: null, outcomeReason: null,
      }),
    ).sort();
    expect(keys).toEqual(
      ['accessSnapshot', 'endedAt', 'id', 'mode', 'outcomeReason', 'projectId', 'startedAt', 'state', 'stopRange', 'stoppedAtSelectedRange'].sort(),
    );
  });
});
