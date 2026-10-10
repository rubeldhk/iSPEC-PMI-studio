/**
 * `T1960` (EPIC-047) — an enforced limit stops the run; a late one is only
 * ever detected.
 *
 * `FR-EXP-041`, `FR-EXP-046`. Reaching the time limit aborts the run through
 * its context signal: outcome `stopped-by-limit`, the limit `stopped`, a
 * `limit-reached` event. A provider that reports consumption past a limit
 * after the run is a breach **detected late**, with the instant — never
 * recorded as prevented.
 */
import { describe, expect, it } from 'vitest';
import type { AgentContext } from '@pmi/agent-contract';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';
import { contract, runner } from '../helpers/expert-fixtures.js';

const untilStopped = (ctx: AgentContext) =>
  new Promise<{ status: 'cancelled'; outputs: string[] }>((resolve) => {
    ctx.signal?.addEventListener('abort', () => resolve({ status: 'cancelled', outputs: [] }));
  });

describe('T1960 · stopping on a limit', () => {
  it('the time limit aborts the run and records why', async () => {
    const w = await world({
      contract: contract({ budget: { time: { value: 20 } } }),
      runners: { 'claude-opus-5-5': [runner({}, untilStopped)] },
    });
    const result = await w.service.dispatch(ACTOR, ask());
    expect(result.outcome).toBe('stopped-by-limit');
    const [time] = await w.store.limitsFor('ws_1', result.executionId);
    expect(time).toMatchObject({ limit: 'time', enforcement: 'enforced', reached: 'stopped' });
    expect(w.executions.kindsFor(result.executionId)).toContain('limit-reached');
    expect(w.executions.completed[0]?.outcome).toBe('timed-out');
  });

  it('consumption reported past a limit after the run is detected late, with the instant', async () => {
    const w = await world({
      contract: contract({ budget: { time: { value: 60_000 }, tokens: { value: 1000, onUnenforceable: 'proceed' } } }),
      runners: {
        'claude-opus-5-5': [runner({}, { status: 'succeeded', outputs: ['test-report'], consumption: { tokens: 1500 } })],
      },
    });
    const result = await w.service.dispatch(ACTOR, ask());
    const tokens = (await w.store.limitsFor('ws_1', result.executionId)).find((l) => l.limit === 'tokens');
    expect(tokens).toMatchObject({ enforcement: 'unenforceable', consumed: 1500, reached: 'detected-late' });
    expect(tokens?.detectedAt).toBeTruthy();
    expect(w.executions.kindsFor(result.executionId)).toContain('limit-breach-detected-late');
    expect(w.executions.kindsFor(result.executionId)).not.toContain('limit-reached');
  });
});
