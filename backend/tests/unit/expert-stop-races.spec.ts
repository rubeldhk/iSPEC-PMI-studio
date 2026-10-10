/**
 * `T2002` (EPIC-047) — the races around a parent's end.
 *
 * `FR-EXP-037`, spec Edge Cases "a delegate outlives its parent". The cascade
 * that stops delegates is only sound if:
 *
 * - the parent is marked ended **before** its delegates are stopped, so no new
 *   delegate is admitted in between;
 * - a delegate admitted but not yet recorded re-checks its parent once its own
 *   row exists, and stops if the parent ended meanwhile;
 * - `endSession` says whether it won, so a child that settled first is not
 *   overwritten as `stopped-by-parent`, and a stopped child is not completed
 *   a second time by its own run's end.
 */
import { describe, expect, it } from 'vitest';
import type { AgentContext } from '@pmi/agent-contract';
import { ACTOR, addApproved, allowDelegation, ask, world, type World } from '../helpers/expert-dispatch.js';
import { contract, gatewaysFor, runner } from '../helpers/expert-fixtures.js';

const untilStopped = (ctx: AgentContext) =>
  new Promise<{ status: 'cancelled'; outputs: string[] }>((resolve) => {
    ctx.signal?.addEventListener('abort', () => resolve({ status: 'cancelled', outputs: [] }));
  });

async function delegating(): Promise<World> {
  const w = await world({ contract: contract({ delegatesTo: ['reviewer'], models: { preferred: 'parent-model', fallbacks: [] } }) });
  await addApproved(w, 'reviewer', { models: { preferred: 'child-model', fallbacks: [] } });
  await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
  return w;
}

describe('T2002 · stop races', () => {
  it('the parent is marked ended before its delegates are stopped', async () => {
    const w = await delegating();
    const order: string[] = [];
    const endSession = w.store.endSession.bind(w.store);
    w.store.endSession = async (ws, id, end) => {
      order.push(`${id}:${end.outcome}`);
      return endSession(ws, id, end);
    };
    let child: Promise<unknown> = Promise.resolve();
    let childStarted!: () => void;
    const started = new Promise<void>((r) => (childStarted = r));
    w.ports.gateways = gatewaysFor({
      'parent-model': [
        runner({ model: 'parent-model' }, async (ctx) => {
          child = w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: ctx.correlationId }));
          await started;
          return { status: 'succeeded', outputs: ['test-report'] };
        }),
      ],
      'child-model': [
        runner({ model: 'child-model' }, (ctx) => {
          childStarted();
          return untilStopped(ctx);
        }),
      ],
    });

    await w.service.dispatch(ACTOR, ask());
    await child;
    const parentEnd = order.indexOf('exe_1:succeeded');
    const childStop = order.indexOf('exe_2:stopped-by-parent');
    expect(parentEnd).toBeGreaterThanOrEqual(0);
    expect(childStop).toBeGreaterThan(parentEnd);
  });

  it('a delegate admitted before its parent ended, but recorded after, stops without running', async () => {
    const w = await delegating();
    let atAssemble!: () => void;
    const childAtAssemble = new Promise<void>((r) => (atAssemble = r));
    let openGate!: () => void;
    const gate = new Promise<void>((r) => (openGate = r));
    const assemble = w.context.assemble.bind(w.context);
    let calls = 0;
    w.context.assemble = async (input) => {
      calls += 1;
      if (calls === 2) {
        atAssemble();
        await gate;
      }
      return assemble(input);
    };
    const childRunner = runner({ model: 'child-model' });
    let child: Promise<{ executionId: string; outcome: string }> | undefined;
    w.ports.gateways = gatewaysFor({
      'parent-model': [
        runner({ model: 'parent-model' }, async (ctx) => {
          child = w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: ctx.correlationId }));
          await childAtAssemble;
          return { status: 'succeeded', outputs: ['test-report'] };
        }),
      ],
      'child-model': [childRunner],
    });

    const parent = await w.service.dispatch(ACTOR, ask());
    expect(parent.outcome).toBe('succeeded');
    openGate();
    const result = await child!;

    expect(result.outcome).toBe('stopped-by-parent');
    expect(childRunner.runs).toHaveLength(0);
    expect((await w.store.findSession('ws_1', result.executionId))?.outcome).toBe('stopped-by-parent');
    expect(w.executions.kindsFor(result.executionId)).toContain('stopped-by-parent');
    expect(w.executions.completed.filter((c) => c.executionId === result.executionId)).toEqual([
      expect.objectContaining({ outcome: 'cancelled' }),
    ]);
  });

  it('a child that settled first is not overwritten as stopped-by-parent', async () => {
    const w = await delegating();
    // The cascade reads a stale row: the child looks running though it has ended.
    const childrenOf = w.store.childrenOf.bind(w.store);
    w.store.childrenOf = async (ws, id) => (await childrenOf(ws, id)).map((s) => ({ ...s, outcome: null, endedAt: null }));
    let childResult: { executionId: string; outcome: string } | undefined;
    w.ports.gateways = gatewaysFor({
      'parent-model': [
        runner({ model: 'parent-model' }, async (ctx) => {
          childResult = await w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: ctx.correlationId }));
          return { status: 'succeeded', outputs: ['test-report'] };
        }),
      ],
      'child-model': [runner({ model: 'child-model' })],
    });

    await w.service.dispatch(ACTOR, ask());
    const id = childResult!.executionId;
    expect(childResult!.outcome).toBe('succeeded');
    expect((await w.store.findSession('ws_1', id))?.outcome).toBe('succeeded');
    expect(w.executions.kindsFor(id)).not.toContain('stopped-by-parent');
    expect(w.executions.completed.filter((c) => c.executionId === id)).toEqual([
      expect.objectContaining({ outcome: 'completed' }),
    ]);
  });

  it('a run stopped by its parent while settling is not completed again by its own end', async () => {
    const w = await world();
    // The parent's cascade wins the race between this run's last check and its own settle.
    const endSession = w.store.endSession.bind(w.store);
    w.store.endSession = async (ws, id, end) => {
      if (end.outcome === 'succeeded') await endSession(ws, id, { outcome: 'stopped-by-parent', endedAt: end.endedAt });
      return endSession(ws, id, end);
    };

    const result = await w.service.dispatch(ACTOR, ask());

    expect(result.outcome).toBe('stopped-by-parent');
    expect((await w.store.findSession('ws_1', 'exe_1'))?.outcome).toBe('stopped-by-parent');
    expect(w.executions.completed.filter((c) => c.executionId === 'exe_1')).toEqual([]);
    expect(w.executions.proposed).toEqual([]);
  });

  it('endSession reports whether it won', async () => {
    const w = await world();
    await w.service.dispatch(ACTOR, ask());
    await expect(w.store.endSession('ws_1', 'exe_1', { outcome: 'failed', endedAt: '2026-10-09T10:00:00.000Z' })).resolves.toBe(false);
  });
});
