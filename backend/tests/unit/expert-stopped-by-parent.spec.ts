/**
 * `T1953` (EPIC-047) — when a parent ends, its running delegates stop.
 *
 * `FR-EXP-037`. A delegate outliving the session that delegated it would be
 * work nobody is accountable for. When a parent ends — succeeded, failed or
 * cancelled — its running delegates are signalled to stop and recorded
 * `stopped-by-parent`, transitively.
 */
import { describe, expect, it } from 'vitest';
import { addApproved, allowDelegation, ask, world, ACTOR } from '../helpers/expert-dispatch.js';
import { contract, gatewaysFor, runner } from '../helpers/expert-fixtures.js';
import type { AgentContext } from '@pmi/agent-contract';

/** Resolves when the signal aborts, reporting the run cancelled. */
const untilStopped = (ctx: AgentContext) =>
  new Promise<{ status: 'cancelled'; outputs: string[] }>((resolve) => {
    ctx.signal?.addEventListener('abort', () => resolve({ status: 'cancelled', outputs: [] }));
  });

describe('T1953 · stopped by parent', () => {
  it('a delegate still running when its parent ends is stopped and recorded as such', async () => {
    const w = await world({ contract: contract({ delegatesTo: ['reviewer'], models: { preferred: 'parent-model', fallbacks: [] } }) });
    await addApproved(w, 'reviewer', { models: { preferred: 'child-model', fallbacks: [] } });
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);

    let child: Promise<unknown> = Promise.resolve();
    let childStarted!: () => void;
    const started = new Promise<void>((r) => (childStarted = r));
    const childRunner = runner({ model: 'child-model' }, (ctx) => {
      childStarted();
      return untilStopped(ctx);
    });
    const parentRunner = runner({ model: 'parent-model' }, async (ctx) => {
      child = w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: ctx.correlationId }));
      await started;
      return { status: 'succeeded', outputs: ['test-report'] };
    });
    w.ports.gateways = gatewaysFor({ 'parent-model': [parentRunner], 'child-model': [childRunner] });

    const parent = await w.service.dispatch(ACTOR, ask());
    const result = (await child) as { executionId: string; outcome: string };
    expect(parent.outcome).toBe('succeeded');
    expect(result.outcome).toBe('stopped-by-parent');
    expect((await w.store.findSession('ws_1', result.executionId))?.outcome).toBe('stopped-by-parent');
    expect(w.executions.kindsFor(result.executionId)).toContain('stopped-by-parent');
    // Closed once, as cancelled — not completed again by its own run's end.
    expect(w.executions.completed.filter((c) => c.executionId === result.executionId)).toEqual([
      expect.objectContaining({ outcome: 'cancelled' }),
    ]);
  });
});
