/**
 * `T2008` (EPIC-047) — a delegate cannot be given more than its chain has left.
 *
 * `R-047-7`, `FR-EXP-036`, `FR-EXP-044`. Charging a delegate's consumption up
 * the chain only *detects* overspend after the fact. A delegate's token, cost
 * and resource limits are therefore capped, before it runs, at the smallest
 * remaining budget across its ancestors — and the cap is recorded as a
 * narrowing, like any other (`FR-EXP-044`). A chain with nothing left
 * delegates nothing.
 */
import { describe, expect, it } from 'vitest';
import { ACTOR, addApproved, allowDelegation, ask, world, type World } from '../helpers/expert-dispatch.js';
import { contract, gatewaysFor, runner } from '../helpers/expert-fixtures.js';
import type { Budget } from '../../src/modules/experts/expert.types.js';

const parentBudget: Budget = {
  time: { value: 60_000 },
  tokens: { value: 1000, onUnenforceable: 'proceed' },
  resource: { value: 10 },
};
const childBudget: Budget = {
  time: { value: 60_000 },
  tokens: { value: 5000, onUnenforceable: 'proceed' },
  resource: { value: 50 },
};

async function chain(over: { parent?: Budget; child?: Budget; parentSpent?: number } = {}): Promise<{
  w: World;
  inner: () => { executionId: string } | Error;
}> {
  const w = await world({
    contract: contract({ budget: over.parent ?? parentBudget, delegatesTo: ['reviewer'], models: { preferred: 'p', fallbacks: [] } }),
  });
  await addApproved(w, 'reviewer', { budget: over.child ?? childBudget, models: { preferred: 'c', fallbacks: [] } });
  await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
  let result: { executionId: string } | Error = new Error('not run');
  w.ports.gateways = gatewaysFor({
    p: [
      runner({ model: 'p' }, async (ctx) => {
        if (over.parentSpent !== undefined) {
          await w.store.chargeLimit('ws_1', ctx.correlationId, 'tokens', over.parentSpent, '2026-10-09T09:00:30.000Z');
        }
        result = await w.service
          .dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: ctx.correlationId }))
          .catch((e: Error) => e);
        return { status: 'succeeded', outputs: ['test-report'] };
      }),
    ],
    c: [runner({ model: 'c' })],
  });
  await w.service.dispatch(ACTOR, ask());
  return { w, inner: () => result };
}

describe('T2008 · a delegate is capped by its chain’s remaining budget', () => {
  it('caps tokens and resource at what the parent has left, and records the narrowing', async () => {
    const { w, inner } = await chain({ parentSpent: 400 });
    const child = inner() as { executionId: string };
    const limits = await w.store.limitsFor('ws_1', child.executionId);
    expect(limits.find((l) => l.limit === 'tokens')?.value).toBe(600);
    expect(limits.find((l) => l.limit === 'resource')?.value).toBe(10);
    const narrowed = w.executions.events.filter((e) => e.executionId === child.executionId && e.kind === 'limit-narrowed');
    expect(narrowed.map((e) => e.detail)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ limit: 'tokens', applied: 600, reason: expect.stringMatching(/chain.*FR-EXP-036/) }),
        expect.objectContaining({ limit: 'resource', applied: 10 }),
      ]),
    );
  });

  it('takes the smallest remaining budget across every ancestor, not only the parent', async () => {
    // Grandparent → parent → child: the grandparent's 300 left binds the grandchild.
    const w = await world({
      contract: contract({
        budget: { time: { value: 60_000 }, tokens: { value: 300, onUnenforceable: 'proceed' } },
        delegatesTo: ['reviewer'],
        models: { preferred: 'g', fallbacks: [] },
      }),
    });
    await addApproved(w, 'reviewer', {
      budget: { time: { value: 60_000 }, tokens: { value: 5000, onUnenforceable: 'proceed' } },
      delegatesTo: ['auditor'],
      models: { preferred: 'p', fallbacks: [] },
    });
    await addApproved(w, 'auditor', { budget: childBudget, models: { preferred: 'c', fallbacks: [] } });
    await allowDelegation(w, [
      { from: 'test-engineer', to: 'reviewer' },
      { from: 'reviewer', to: 'auditor' },
    ]);
    let grandchild = '';
    w.ports.gateways = gatewaysFor({
      g: [
        runner({ model: 'g' }, async (ctx) => {
          await w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: ctx.correlationId }));
          return { status: 'succeeded', outputs: ['test-report'] };
        }),
      ],
      p: [
        runner({ model: 'p' }, async (ctx) => {
          grandchild = (await w.service.dispatch(ACTOR, ask({ expertId: 'ex_auditor', delegatedFromExecutionId: ctx.correlationId })))
            .executionId;
          return { status: 'succeeded', outputs: ['test-report'] };
        }),
      ],
      c: [runner({ model: 'c' })],
    });
    await w.service.dispatch(ACTOR, ask());
    expect((await w.store.limitsFor('ws_1', grandchild)).find((l) => l.limit === 'tokens')?.value).toBe(300);
  });

  it('a delegate without a limit its chain has is given one, at what the chain has left', async () => {
    const { w, inner } = await chain({
      child: { time: { value: 60_000 } },
      parentSpent: 250,
    });
    const child = inner() as { executionId: string };
    expect((await w.store.limitsFor('ws_1', child.executionId)).find((l) => l.limit === 'tokens')?.value).toBe(750);
  });

  it('a chain with nothing left delegates nothing', async () => {
    const { inner } = await chain({ parentSpent: 1000 });
    expect(inner()).toBeInstanceOf(Error);
    expect((inner() as Error).message).toMatch(/no tokens budget left.*FR-EXP-036/);
  });

  it('a delegate below its chain’s remaining budget is not narrowed', async () => {
    const { w, inner } = await chain({ child: { time: { value: 60_000 }, tokens: { value: 100, onUnenforceable: 'proceed' } } });
    const child = inner() as { executionId: string };
    expect((await w.store.limitsFor('ws_1', child.executionId)).find((l) => l.limit === 'tokens')?.value).toBe(100);
    expect(
      w.executions.events.filter((e) => e.executionId === child.executionId && e.kind === 'limit-narrowed' && e.detail['limit'] === 'tokens'),
    ).toEqual([]);
  });
});
