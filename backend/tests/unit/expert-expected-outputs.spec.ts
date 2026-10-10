/**
 * `T1939` (EPIC-047) — a run that did not produce what it owed is incomplete.
 *
 * `FR-EXP-021`. A required output missing at the end means the run ends
 * `incomplete` with an `outputs-incomplete` event naming what is missing — and
 * its execution closes as partially completed, not completed.
 */
import { describe, expect, it } from 'vitest';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';
import { contract, runner } from '../helpers/expert-fixtures.js';

describe('T1939 · expected outputs', () => {
  it('a missing required output makes the run incomplete', async () => {
    const w = await world({ runners: { 'claude-opus-5-5': [runner({}, { status: 'succeeded', outputs: [] })] } });
    const result = await w.service.dispatch(ACTOR, ask());
    expect(result.outcome).toBe('incomplete');
    const event = w.executions.events.find((e) => e.kind === 'outputs-incomplete');
    expect(event?.detail).toMatchObject({ missing: ['test-report'] });
    expect(w.executions.completed[0]?.outcome).toBe('partially-completed');
  });

  it('a missing optional output does not', async () => {
    const w = await world({
      contract: contract({
        expectedOutputs: [
          { kind: 'test-report', required: true },
          { kind: 'coverage', required: false },
        ],
      }),
    });
    expect((await w.service.dispatch(ACTOR, ask())).outcome).toBe('succeeded');
  });

  it('a run that failed is failed, not incomplete', async () => {
    const w = await world({ runners: { 'claude-opus-5-5': [runner({}, { status: 'failed', outputs: [] })] } });
    const result = await w.service.dispatch(ACTOR, ask());
    expect(result.outcome).toBe('failed');
    expect(w.executions.completed[0]?.outcome).toBe('failed');
  });
});
