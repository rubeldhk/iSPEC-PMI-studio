/**
 * `T1958` (EPIC-047) — limits: narrowed to the contract, and honest about
 * what can be enforced.
 *
 * `FR-EXP-040`…`FR-EXP-044`, `R-047-7`. A request above its contract gets the
 * contract's value, keeping what it asked for. Time is always enforced — the
 * runner's context carries a timeout and a signal. Tokens, cost and resource
 * are enforced only where the runner declares the control; otherwise they read
 * `unenforceable`, never `enforced`. And the clarified default: an
 * unenforceable money limit refuses; time and resource proceed and record.
 */
import { describe, expect, it } from 'vitest';
import { planLimits } from '../../src/modules/experts/limits.js';

describe('T1958 · planning limits', () => {
  it('time is always enforced', () => {
    const plan = planLimits({ time: { value: 60_000 } }, {}, undefined);
    expect(plan.limits).toEqual([
      expect.objectContaining({ limit: 'time', value: 60_000, requested: null, enforcement: 'enforced', reached: 'no' }),
    ]);
    expect(plan.refusal).toBeNull();
  });

  it('a request above the contract is narrowed, keeping what was asked', () => {
    const plan = planLimits({ time: { value: 60_000 } }, { time: 120_000 }, undefined);
    expect(plan.limits[0]).toMatchObject({ value: 60_000, requested: 120_000 });
    expect(plan.narrowed).toEqual([{ limit: 'time', requested: 120_000, applied: 60_000 }]);
  });

  it('a request below the contract is taken as asked, and is not a narrowing', () => {
    const plan = planLimits({ time: { value: 60_000 } }, { time: 30_000 }, undefined);
    expect(plan.limits[0]).toMatchObject({ value: 30_000, requested: 30_000 });
    expect(plan.narrowed).toEqual([]);
  });

  it('tokens are enforced only where the runner declares the control', () => {
    const budget = { time: { value: 1000 }, tokens: { value: 5000, onUnenforceable: 'proceed' as const } };
    expect(planLimits(budget, {}, ['tokens']).limits.find((l) => l.limit === 'tokens')?.enforcement).toBe('enforced');
    expect(planLimits(budget, {}, undefined).limits.find((l) => l.limit === 'tokens')?.enforcement).toBe('unenforceable');
    expect(planLimits(budget, {}, []).limits.find((l) => l.limit === 'tokens')?.enforcement).toBe('unenforceable');
  });

  it('the clarified default refuses an unenforceable cost or token limit (FR-EXP-043)', () => {
    expect(planLimits({ time: { value: 1000 }, cost: { value: 4 } }, {}, undefined).refusal).toMatch(
      /cost.*cannot be enforced.*refuse/,
    );
    expect(planLimits({ time: { value: 1000 }, tokens: { value: 4 } }, {}, undefined).refusal).toMatch(/tokens/);
  });

  it('the clarified default proceeds on an unenforceable resource limit, and records it', () => {
    const plan = planLimits({ time: { value: 1000 }, resource: { value: 20 } }, {}, undefined);
    expect(plan.refusal).toBeNull();
    expect(plan.unenforceable).toEqual(['resource']);
  });

  it('a contract may choose to proceed on money, and is never recorded as enforced', () => {
    const plan = planLimits({ time: { value: 1000 }, cost: { value: 4, onUnenforceable: 'proceed' } }, {}, undefined);
    expect(plan.refusal).toBeNull();
    expect(plan.limits.find((l) => l.limit === 'cost')?.enforcement).toBe('unenforceable');
  });

  it('a limit only the request sets still applies, under the default posture', () => {
    const plan = planLimits({ time: { value: 1000 } }, { cost: 2 }, undefined);
    expect(plan.limits.find((l) => l.limit === 'cost')).toMatchObject({ value: 2, requested: 2 });
    expect(plan.refusal).toMatch(/cost/);
  });
});
