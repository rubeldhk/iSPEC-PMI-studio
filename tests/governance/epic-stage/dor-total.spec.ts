/**
 * T503 — evaluation is total, never short-circuiting (`FR-ESK-013`).
 * Written to FAIL before T509 exists (Constitution V).
 *
 * **Why this is a requirement rather than an implementation detail.** A gate
 * that reports the first failure makes readiness an unbounded number of rounds:
 * fix one, rerun, discover the next, fix it, rerun. Nobody can plan against
 * that, and the natural response is to stop asking until the very end — which
 * is when the answer is most expensive.
 *
 * One pass tells a reader everything outstanding. Twelve conditions are cheap;
 * twelve round-trips are not.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { join } from 'node:path';
import { evaluateDor } from './dor';
import { buildEpicTree, MINIMAL_SPEC, type FixtureTree } from './fixtures';

let tree: FixtureTree | undefined;

afterEach(() => {
  tree?.cleanup();
  tree = undefined;
});

/** An Epic with a bare spec: DOR-01 passes, almost everything else fails. */
function bareEpic() {
  tree = buildEpicTree({ '999-fixture': { spec: MINIMAL_SPEC } });
  return evaluateDor({
    epicPath: join(tree.specsDir, '999-fixture'),
    directory: '999-fixture',
    declarations: {},
  });
}

describe('T503 · every condition is evaluated', () => {
  it('returns a result for all twelve, whatever they are', () => {
    const result = bareEpic();
    expect(result.results).toHaveLength(12);
    expect(result.results.map((r) => r.id)).toEqual([
      'DOR-01',
      'DOR-02',
      'DOR-03',
      'DOR-04',
      'DOR-05',
      'DOR-06',
      'DOR-07',
      'DOR-08',
      'DOR-09',
      'DOR-10',
      'DOR-11',
      'DOR-12',
    ]);
  });

  it('does not stop at the first failure', () => {
    // The load-bearing assertion. A short-circuiting evaluator would return
    // one failure and look, from the outside, exactly like a nearly-ready Epic.
    expect(bareEpic().failures.length).toBeGreaterThan(5);
  });

  it('evaluates conditions after a failure', () => {
    // DOR-05 fails on a bare Epic; DOR-12 comes after it and must still be
    // evaluated — and on a bare Epic it PASSES, which a short-circuit would
    // have silently reported as unknown.
    const result = bareEpic();
    expect(result.results.find((r) => r.id === 'DOR-05')?.passed).toBe(false);
    expect(result.results.find((r) => r.id === 'DOR-12')?.passed).toBe(true);
  });

  it('names each failing condition in a form someone can act on', () => {
    // "DOR-05 failed" is a lookup task. The condition text travels with it.
    for (const failure of bareEpic().failures) {
      expect(failure).toMatch(/DOR-\d\d/);
      expect(failure.length).toBeGreaterThan(12);
    }
  });

  it('reports a result for a condition that could not be evaluated, never a pass', () => {
    // Constitution IX's honesty rule, applied to the DOR: an unrun check is
    // never reported as passing. A missing artifact makes a condition FAIL,
    // and it must never be quietly skipped into a green.
    const results = bareEpic().results;
    expect(results.every((r) => typeof r.passed === 'boolean')).toBe(true);
    expect(results.some((r) => r.passed === false)).toBe(true);
  });

  it('is deterministic', () => {
    // The register renders readiness, so a varying DOR would surface as drift.
    const first = bareEpic().failures;
    const second = bareEpic().failures;
    expect(second).toEqual(first);
  });
});
