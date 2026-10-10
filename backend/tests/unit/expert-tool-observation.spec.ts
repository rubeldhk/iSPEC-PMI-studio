/**
 * `T1937` (EPIC-047) — tool use is observed only when the provider reports it.
 *
 * `FR-EXP-024`, clarified 2026-10-09. A provider that cannot report its tool
 * calls leaves the session `unobserved` with a `tool-use-unobserved` event —
 * never `observed`, and never read as "used no tools". A reported call outside
 * the contract is a `tool-call-breach`, recorded whether or not the run could
 * be stopped.
 */
import { describe, expect, it } from 'vitest';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';
import { runner } from '../helpers/expert-fixtures.js';

describe('T1937 · tool observation', () => {
  it('a provider that reports nothing leaves tool use unobserved', async () => {
    const w = await world();
    const result = await w.service.dispatch(ACTOR, ask());
    expect(result.toolObservation).toBe('unobserved');
    expect(w.executions.kindsFor(result.executionId)).toContain('tool-use-unobserved');
    expect((await w.store.findSession('ws_1', result.executionId))?.toolObservation).toBe('unobserved');
  });

  it('a provider that reports calls inside the contract is observed, with no breach', async () => {
    const w = await world({
      runners: { 'claude-opus-5-5': [runner({}, { status: 'succeeded', outputs: ['test-report'], toolCalls: ['run-tests'] })] },
    });
    const result = await w.service.dispatch(ACTOR, ask());
    expect(result.toolObservation).toBe('observed');
    expect(w.executions.kindsFor(result.executionId)).not.toContain('tool-call-breach');
  });

  it('a reported call outside the contract is a breach, and the run does not read as succeeded', async () => {
    const w = await world({
      runners: {
        'claude-opus-5-5': [runner({}, { status: 'succeeded', outputs: ['test-report'], toolCalls: ['run-tests', 'shell'] })],
      },
    });
    const result = await w.service.dispatch(ACTOR, ask());
    const breach = w.executions.events.find((e) => e.kind === 'tool-call-breach');
    expect(breach?.detail).toMatchObject({ tools: ['shell'] });
    expect(result.outcome).toBe('failed');
  });

  it('a reported call to a prohibited action is a breach even if allowed', async () => {
    const w = await world({
      runners: {
        'claude-opus-5-5': [runner({}, { status: 'succeeded', outputs: ['test-report'], toolCalls: ['push'] })],
      },
    });
    const result = await w.service.dispatch(ACTOR, ask());
    expect(w.executions.kindsFor(result.executionId)).toContain('tool-call-breach');
  });
});
