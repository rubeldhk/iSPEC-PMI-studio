/**
 * `T2006` (EPIC-047) — consumption is charged on every exit path, and charges do not lose each other.
 *
 * `FR-EXP-036`, `FR-EXP-045`, US3/AC5. A delegate stopped by its parent still
 * spent what it spent: its reported consumption is charged up the chain and
 * its limits say why they read as they do. Two siblings charging one ancestor
 * at once must both land — a read-then-write would let one overwrite the
 * other, and the chain would look cheaper than it was. Time is recorded as the
 * elapsed time actually consumed.
 */
import { describe, expect, it } from 'vitest';
import type { AgentContext } from '@pmi/agent-contract';
import { chargeConsumption } from '../../src/modules/experts/limits.js';
import type { ExpertSession } from '../../src/modules/experts/expert.types.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import { ACTOR, addApproved, allowDelegation, ask, world } from '../helpers/expert-dispatch.js';
import { contract, expert, gatewaysFor, runner, version } from '../helpers/expert-fixtures.js';

const tokens = { time: { value: 60_000 }, tokens: { value: 1000, onUnenforceable: 'proceed' as const } };

function session(executionId: string, parent: string | null): ExpertSession {
  return {
    executionId, workspaceId: 'ws_1', expertId: 'ex_test', contractVersionId: 'cv_1',
    delegatedFromExecutionId: parent, actorId: 'u_1', depth: parent === null ? 0 : 1, model: 'm',
    usedFallback: false, fallbackReason: null,
    effectiveAuthority: { capabilities: [], tools: [], permissions: [], prohibitedActions: [] },
    toolObservation: 'unobserved', unattended: false, reviewRequired: false, outcome: null,
    startedAt: '2026-10-09T09:00:00.000Z', endedAt: null,
  };
}

const tokenLimit = (executionId: string) => ({
  executionId, limit: 'tokens' as const, value: 1000, requested: null, enforcement: 'unenforceable' as const,
  consumed: null, consumedReason: 'not yet reported', reached: 'no' as const, detectedAt: null,
});

describe('T2006 · consumption on every path', () => {
  it('a delegate stopped by its parent still charges what it reported, up the chain', async () => {
    const w = await world({ contract: contract({ budget: tokens, delegatesTo: ['reviewer'], models: { preferred: 'p', fallbacks: [] } }) });
    await addApproved(w, 'reviewer', { budget: tokens, models: { preferred: 'c', fallbacks: [] } });
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
    let child: Promise<{ executionId: string; outcome: string }> | undefined;
    let childStarted!: () => void;
    const started = new Promise<void>((r) => (childStarted = r));
    w.ports.gateways = gatewaysFor({
      p: [
        runner({ model: 'p' }, async (ctx) => {
          child = w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: ctx.correlationId }));
          await started;
          return { status: 'succeeded', outputs: ['test-report'], consumption: { tokens: 100 } };
        }),
      ],
      c: [
        runner({ model: 'c' }, (ctx: AgentContext) => {
          childStarted();
          return new Promise((resolve) =>
            ctx.signal?.addEventListener('abort', () => resolve({ status: 'cancelled', outputs: [], consumption: { tokens: 300 } })),
          );
        }),
      ],
    });

    const parent = await w.service.dispatch(ACTOR, ask());
    const result = await child!;
    expect(result.outcome).toBe('stopped-by-parent');

    const childTokens = (await w.store.limitsFor('ws_1', result.executionId)).find((l) => l.limit === 'tokens');
    expect(childTokens).toMatchObject({ consumed: 300, consumedReason: null });
    const parentTokens = (await w.store.limitsFor('ws_1', parent.executionId)).find((l) => l.limit === 'tokens');
    expect(parentTokens?.consumed).toBe(400);
  });

  it('a delegate stopped before it ran gives its limits a reason, not a silent null', async () => {
    const w = await world({ contract: contract({ budget: tokens }) });
    const store = w.store;
    await store.addSession({ ...session('exe_parent', null), outcome: 'succeeded', endedAt: '2026-10-09T09:01:00.000Z' });
    await store.addSession(session('exe_child', 'exe_parent'));
    await store.putLimit(tokenLimit('exe_child'));
    await chargeConsumption(store, 'ws_1', 'exe_child', {}, '2026-10-09T09:02:00.000Z');
    const row = (await store.limitsFor('ws_1', 'exe_child'))[0];
    expect(row?.consumed).toBeNull();
    expect(row?.consumedReason).toMatch(/did not report/);
  });

  it('concurrent sibling charges to one ancestor both land', async () => {
    const store = new InMemoryExpertsStore();
    await store.addExpert(expert());
    await store.addVersion(version());
    await store.addSession(session('exe_root', null));
    await store.addSession(session('exe_a', 'exe_root'));
    await store.addSession(session('exe_b', 'exe_root'));
    for (const id of ['exe_root', 'exe_a', 'exe_b']) await store.putLimit(tokenLimit(id));

    await Promise.all([
      chargeConsumption(store, 'ws_1', 'exe_a', { tokens: 300 }, '2026-10-09T09:02:00.000Z'),
      chargeConsumption(store, 'ws_1', 'exe_b', { tokens: 500 }, '2026-10-09T09:02:00.000Z'),
    ]);

    expect((await store.limitsFor('ws_1', 'exe_root'))[0]?.consumed).toBe(800);
  });

  it('the time limit records the elapsed time as consumed', async () => {
    const w = await world({ contract: contract({ budget: tokens }) });
    w.preferred.run = async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { status: 'succeeded', outputs: ['test-report'] };
    };
    const result = await w.service.dispatch(ACTOR, ask());
    const time = (await w.store.limitsFor('ws_1', result.executionId)).find((l) => l.limit === 'time');
    expect(time?.consumed).toBeGreaterThanOrEqual(15);
    expect(time?.consumed).toBeLessThan(60_000);
    expect(time?.consumedReason).toBeNull();
  });
});
