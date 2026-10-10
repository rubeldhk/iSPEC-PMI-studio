/**
 * `T2119` (EPIC-039, `R-039-7`) — the resolver's pure core cannot skip a
 * condition. Every condition is evaluated for every candidate, in a fixed
 * order, and each candidate's record names the first one it failed
 * (`FR-HUB-030`–`FR-HUB-036`).
 *
 * Written to FAIL before `T2120`.
 */
import { describe, expect, it } from 'vitest';
import { ELIGIBILITY_CONDITIONS, evaluateCandidates, type CandidateFacts } from '../src/eligibility.js';

function candidate(key: string, over: Partial<CandidateFacts> = {}): CandidateFacts {
  return {
    entryKey: key,
    direction: 'outbound',
    inBuild: true,
    active: true,
    majors: [1],
    configured: true,
    preference: 1,
    credential: 'present',
    health: { state: 'healthy' },
    permitDegraded: false,
    environmentPermitted: true,
    policy: { status: 'permitted' },
    ...over,
  };
}

const request = { capability: 'ReadBuildStatus' as const, major: 1 };

describe('T2119 · the fixed order of R-039-7', () => {
  it('is in-build, active, implements-major, configured, credential, health, environment, policy', () => {
    expect([...ELIGIBILITY_CONDITIONS]).toEqual(['in-build', 'active', 'implements-major', 'configured', 'credential', 'health', 'environment', 'policy']);
  });

  it('evaluates EVERY condition for EVERY candidate, even after the first failure', () => {
    const r = evaluateCandidates(request, [candidate('a', { inBuild: false, configured: false, health: { state: 'unknown', reason: 'never-checked' } }), candidate('b')]);
    for (const c of r.candidates) expect(c.conditions.map((x) => x.condition)).toEqual([...ELIGIBILITY_CONDITIONS]);
    const a = r.candidates.find((c) => c.entryKey === 'a')!;
    expect(a.eligible).toBe(false);
    expect(a.firstFailure).toBe('not-in-build');
    expect(a.conditions.filter((c) => !c.holds).map((c) => c.reason)).toEqual(['not-in-build', 'not-configured', 'health-unknown']);
  });
});

describe('T2119 · outcomes', () => {
  it('resolves exactly one eligible candidate, naming every condition that held', () => {
    const r = evaluateCandidates(request, [candidate('fixture-ci')]);
    expect(r.outcome).toBe('resolved');
    if (r.outcome !== 'resolved') return;
    expect(r.chosen).toBe('fixture-ci');
    expect(r.rule).toBe('only-eligible');
    expect(r.eligibleBecause).toEqual([...ELIGIBILITY_CONDITIONS]);
  });

  it('uses the configured preference among several', () => {
    const r = evaluateCandidates(request, [candidate('a', { preference: 2 }), candidate('b', { preference: 1 })]);
    expect(r).toMatchObject({ outcome: 'resolved', chosen: 'b', rule: 'configured-preference' });
  });

  it('refuses ambiguous at equal preference, naming both (FR-HUB-032)', () => {
    const r = evaluateCandidates(request, [candidate('a'), candidate('b'), candidate('c', { preference: 2 })]);
    expect(r).toMatchObject({ outcome: 'refused', code: 'ambiguous', ambiguousBetween: ['a', 'b'] });
  });

  it('refuses no-eligible-adapter listing every candidate with its own reason (FR-HUB-035)', () => {
    const r = evaluateCandidates(request, [
      candidate('sick', { health: { state: 'unhealthy', reason: 'credential-rejected' } }),
      candidate('unset', { configured: false, preference: null }),
      candidate('nokey', { credential: 'missing' }),
      candidate('prod-only', { environmentPermitted: false }),
      candidate('pending', { policy: { status: 'pending' } }),
      candidate('refused', { policy: { status: 'not-permitted' } }),
      candidate('retired', { active: false }),
      candidate('degraded', { health: { state: 'degraded', reason: 'provider-throttled' } }),
    ]);
    expect(r.outcome).toBe('refused');
    if (r.outcome !== 'refused') return;
    expect(r.code).toBe('no-eligible-adapter');
    expect(Object.fromEntries(r.candidates.map((c) => [c.entryKey, c.firstFailure]))).toEqual({
      sick: 'health-unhealthy',
      unset: 'not-configured',
      nokey: 'credential-missing',
      'prod-only': 'environment-not-permitted',
      pending: 'policy-pending',
      refused: 'policy-not-permitted',
      retired: 'retired',
      degraded: 'health-degraded-not-permitted',
    });
  });

  it('accepts degraded only where the project permits it (FR-HUB-026)', () => {
    const r = evaluateCandidates(request, [candidate('d', { health: { state: 'degraded', reason: 'provider-throttled' }, permitDegraded: true })]);
    expect(r).toMatchObject({ outcome: 'resolved', chosen: 'd' });
  });

  it('treats a credential that is not required as held', () => {
    expect(evaluateCandidates(request, [candidate('x', { credential: 'not-required' })]).outcome).toBe('resolved');
  });

  it('treats a policy that does not apply (deployment scope) as held, with its reason recorded', () => {
    const r = evaluateCandidates(request, [candidate('x', { policy: { status: 'not-applicable', reason: 'deployment-scope binding' } })]);
    expect(r.outcome).toBe('resolved');
    expect(r.candidates[0]!.conditions.find((c) => c.condition === 'policy')).toMatchObject({ holds: true, detail: 'deployment-scope binding' });
  });

  it('never selects an inbound entry, and says why it is not a candidate', () => {
    const r = evaluateCandidates(request, [candidate('pmi-studio', { direction: 'inbound' })]);
    expect(r).toMatchObject({ outcome: 'refused', code: 'no-compatible-adapter' });
    expect(r.excluded).toEqual([{ entryKey: 'pmi-studio', reason: 'inbound connector — never a resolution candidate (FR-HUB-022)' }]);
  });

  it('never crosses a major (FR-HUB-033)', () => {
    const r = evaluateCandidates({ capability: 'ReadBuildStatus', major: 2 }, [candidate('a')]);
    expect(r).toMatchObject({ outcome: 'refused', code: 'no-compatible-adapter' });
    expect(r.candidates[0]!.firstFailure).toBe('incompatible-major');
  });

  it('refuses no-compatible-adapter when there are no candidates at all', () => {
    expect(evaluateCandidates(request, [])).toMatchObject({ outcome: 'refused', code: 'no-compatible-adapter', candidates: [] });
  });

  it('carries the policy explanation verbatim into the condition (BR-0174)', () => {
    const explanation = { policyVersion: 'p1', matchedRule: 'r', riskClass: 'low', authorityApplied: 'auto' };
    const r = evaluateCandidates(request, [candidate('a', { policy: { status: 'permitted', explanation } })]);
    expect(r.candidates[0]!.conditions.find((c) => c.condition === 'policy')!.explanation).toEqual(explanation);
  });
});
