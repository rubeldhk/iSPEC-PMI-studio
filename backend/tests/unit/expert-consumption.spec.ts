/**
 * `T1962` (EPIC-047) — consumption: unreported is not zero, and a delegate's
 * counts against every ancestor.
 *
 * `FR-EXP-036`, `FR-EXP-045`. A provider that does not report tokens leaves
 * the limit's consumption **null with a reason**. A delegate's reported
 * consumption is charged to its parent's limit too — so a chain cannot spend
 * past its root's budget by splitting the work.
 */
import { describe, expect, it } from 'vitest';
import { ACTOR, addApproved, allowDelegation, ask, world } from '../helpers/expert-dispatch.js';
import { contract, gatewaysFor, runner } from '../helpers/expert-fixtures.js';

const tokens = { time: { value: 60_000 }, tokens: { value: 1000, onUnenforceable: 'proceed' as const } };

describe('T1962 · consumption', () => {
  it('unreported consumption is null with a reason, never 0', async () => {
    const w = await world({ contract: contract({ budget: tokens }) });
    const result = await w.service.dispatch(ACTOR, ask());
    const row = (await w.store.limitsFor('ws_1', result.executionId)).find((l) => l.limit === 'tokens');
    expect(row?.consumed).toBeNull();
    expect(row?.consumedReason).toMatch(/did not report/);
  });

  it('resource is the number of reported tool calls', async () => {
    const w = await world({
      contract: contract({ budget: { time: { value: 60_000 }, resource: { value: 5 } } }),
      runners: {
        'claude-opus-5-5': [runner({}, { status: 'succeeded', outputs: ['test-report'], toolCalls: ['run-tests', 'run-tests'] })],
      },
    });
    const result = await w.service.dispatch(ACTOR, ask());
    expect((await w.store.limitsFor('ws_1', result.executionId)).find((l) => l.limit === 'resource')?.consumed).toBe(2);
  });

  it("a delegate's consumption is charged to its parent, which can breach late because of it", async () => {
    const w = await world({ contract: contract({ budget: tokens, delegatesTo: ['reviewer'], models: { preferred: 'p', fallbacks: [] } }) });
    await addApproved(w, 'reviewer', { budget: tokens, models: { preferred: 'c', fallbacks: [] } });
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
    let child = '';
    w.ports.gateways = gatewaysFor({
      p: [
        runner({ model: 'p' }, async (ctx) => {
          child = (await w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: ctx.correlationId })))
            .executionId;
          return { status: 'succeeded', outputs: ['test-report'], consumption: { tokens: 400 } };
        }),
      ],
      c: [runner({ model: 'c' }, { status: 'succeeded', outputs: ['test-report'], consumption: { tokens: 700 } })],
    });
    const parent = await w.service.dispatch(ACTOR, ask());
    const childTokens = (await w.store.limitsFor('ws_1', child)).find((l) => l.limit === 'tokens');
    const parentTokens = (await w.store.limitsFor('ws_1', parent.executionId)).find((l) => l.limit === 'tokens');
    expect(childTokens).toMatchObject({ consumed: 700, reached: 'no' });
    // 700 charged up while the parent ran, then its own 400: 1100 against 1000.
    expect(parentTokens).toMatchObject({ consumed: 1100, reached: 'detected-late' });
  });
});
