/**
 * T969 — an exception names who authorised it and why. `FR-GEL-021`,
 * `BR-0060`, `FR-GEL-022`.
 *
 * *"A skipped gate is a recorded violation or an **explicit exception**."*
 *
 * The word doing the work is *explicit*. An exception with no authorizer is a
 * bypass that has been given a nicer name, and an exception with no reason is
 * one nobody can review — both of which look identical to a legitimate
 * exception in every aggregate anyone would compute.
 *
 * So an exception missing either field resolves to **violation**, not to
 * "exception with a blank field". That is the difference between a governed
 * departure and an ungoverned one, and it is the whole of `BR-0060`.
 */
import { describe, expect, it } from 'vitest';
import { departures, evaluateGates } from '../../src/modules/loop/gate-evaluator.js';

const granted = { gateId: 'g1', authorizedBy: 'u_lead', reason: 'hotfix window, incident INC-42' };

describe('T969 · a complete exception is recorded as an exception', () => {
  it('resolves to exception when both fields are present', () => {
    const evaluation = evaluateGates({ declared: ['g1'], reported: [], exceptions: [granted] });
    expect(evaluation.outcomes[0]?.result).toBe('exception');
  });

  it('records the authorizer and the reason where an auditor will read them', () => {
    const evaluation = evaluateGates({ declared: ['g1'], reported: [], exceptions: [granted] });
    expect(evaluation.outcomes[0]?.detail).toMatch(/u_lead/);
    expect(evaluation.outcomes[0]?.detail).toMatch(/INC-42/);
  });

  it('takes precedence over a gate that was never evaluated', () => {
    // The realistic case: the gate could not run, and a human authorised
    // proceeding anyway. That is exactly what an exception is for — and it must
    // read as `exception`, not as the `violation` an unevaluated gate would
    // otherwise become.
    const evaluation = evaluateGates({ declared: ['g1'], reported: [], exceptions: [granted] });
    expect(evaluation.outcomes[0]?.result).toBe('exception');
    expect(evaluation.outcomes[0]?.detail).not.toMatch(/never evaluated/);
  });
});

describe('FR-GEL-021 · an incomplete exception is a violation', () => {
  it.each([
    ['no authorizer', { gateId: 'g1', authorizedBy: '', reason: 'because' }],
    ['no reason', { gateId: 'g1', authorizedBy: 'u_lead', reason: '' }],
    ['neither', { gateId: 'g1', authorizedBy: '', reason: '' }],
  ])('resolves an exception with %s to violation', (_label, exception) => {
    const evaluation = evaluateGates({ declared: ['g1'], reported: [], exceptions: [exception] });
    expect(evaluation.outcomes[0]?.result).toBe('violation');
  });

  it('says why it was downgraded, so the fix is obvious', () => {
    const evaluation = evaluateGates({
      declared: ['g1'],
      reported: [],
      exceptions: [{ gateId: 'g1', authorizedBy: '', reason: 'because' }],
    });
    expect(evaluation.outcomes[0]?.detail).toMatch(/an exception nobody granted is a violation/);
  });

  it('does not let an incomplete exception hide an unevaluated gate', () => {
    // Both faults at once — the gate did not run AND the exception is empty.
    // The result must be a violation either way; what must not happen is the
    // empty exception counting as "handled".
    const evaluation = evaluateGates({
      declared: ['g1'],
      reported: [],
      exceptions: [{ gateId: 'g1', authorizedBy: '', reason: '' }],
    });
    expect(evaluation.passed).toBe(false);
    expect(evaluation.outcomes[0]?.result).toBe('violation');
  });
});

describe('FR-GEL-022 · the departures projection', () => {
  it('reports exceptions and violations', () => {
    const evaluation = evaluateGates({
      declared: ['g1', 'g2', 'g3'],
      reported: [{ gateId: 'g1', result: 'satisfied' }, { gateId: 'g3', result: 'violation' }],
      exceptions: [{ gateId: 'g2', authorizedBy: 'u', reason: 'r' }],
    });
    expect(departures(evaluation.outcomes).map((o) => o.gateId)).toEqual(['g2', 'g3']);
  });

  it('does NOT report a plain refusal as a departure', () => {
    // A refused gate stopped the transition and nothing departed from the rules.
    // Including it would make "how often do we bypass our own gates?"
    // unanswerable — the number would be dominated by gates working correctly.
    const evaluation = evaluateGates({
      declared: ['g1'],
      reported: [{ gateId: 'g1', result: 'refused' }],
    });
    expect(departures(evaluation.outcomes)).toEqual([]);
  });

  it('reports nothing when every gate was satisfied', () => {
    const evaluation = evaluateGates({
      declared: ['g1', 'g2'],
      reported: [{ gateId: 'g1', result: 'satisfied' }, { gateId: 'g2', result: 'satisfied' }],
    });
    expect(departures(evaluation.outcomes)).toEqual([]);
  });
});
