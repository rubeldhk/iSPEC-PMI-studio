/**
 * `T2532` (EPIC-047 Convergence) — every exit path accounts for what it
 * consumed.
 *
 * `FR-EXP-045`, `FR-EXP-036`. A run whose runner throws still ran for a measurable
 * time, and a delegate stopped before it ran consumed nothing — both are facts,
 * and neither is "not yet reported". Every limit the run could not report gets a
 * reason that says which of those happened.
 */
import { describe, expect, it } from 'vitest';
import { ACTOR, addApproved, allowDelegation, ask, insideRun, world } from '../helpers/expert-dispatch.js';
import { contract } from '../helpers/expert-fixtures.js';

describe('T2532 · consumption on the failure paths', () => {
  it('a runner that throws records its elapsed time, and a reason for each unreported limit', async () => {
    const w = await world();
    w.preferred.run = async () => {
      throw new Error('runner crashed');
    };
    await expect(w.service.dispatch(ACTOR, ask())).rejects.toThrow(/crashed/);
    const limits = await w.store.limitsFor('ws_1', 'exe_1');
    const time = limits.find((l) => l.limit === 'time');
    expect(typeof time?.consumed).toBe('number');
    expect(time?.consumedReason).toBeNull();
    const tokens = limits.find((l) => l.limit === 'tokens');
    expect(tokens?.consumed).toBeNull();
    expect(tokens?.consumedReason).toMatch(/failed before.*reported/);
    for (const l of limits) expect(l.consumedReason).not.toBe('not yet reported');
  });

  it('a delegate stopped before it ran consumed no time, and says why nothing was reported', async () => {
    const w = await world({ contract: contract({ delegatesTo: ['reviewer'] }) });
    await addApproved(w, 'reviewer');
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
    const { inner } = await insideRun(w, ask(), async (parent) => {
      // The parent ends while the delegate is assembling its context — after
      // admission, before its session row exists.
      const assemble = w.ports.context.assemble.bind(w.ports.context);
      w.ports.context = {
        ...w.ports.context,
        async assemble(input) {
          await w.store.endSession('ws_1', parent, { outcome: 'succeeded', endedAt: '2026-10-09T09:00:59.000Z' });
          return assemble(input);
        },
      };
      return w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: parent }));
    });
    expect(inner.outcome).toBe('stopped-by-parent');
    const limits = await w.store.limitsFor('ws_1', inner.executionId);
    expect(limits.find((l) => l.limit === 'time')?.consumed).toBe(0);
    expect(limits.find((l) => l.limit === 'tokens')?.consumedReason).toMatch(/stopped before it ran/);
    for (const l of limits) expect(l.consumedReason).not.toBe('not yet reported');
  });
});
