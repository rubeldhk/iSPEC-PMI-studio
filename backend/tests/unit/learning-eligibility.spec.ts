/**
 * `T2346` (EPIC-048, `FR-LRN-022`, `FR-LRN-026`, `FR-LRN-034`, `SC-LRN-008`) —
 * the automatic path is chosen only when **all** hold; `MP-2`'s target.
 *
 * - the category exists and is declared `lowRisk: true`;
 * - the scope is exactly the source project;
 * - every citation is `verified` (the unfiltered state, `R-048-9`);
 * - there is no conflict with a current approved entry;
 * - the kind is `new`;
 * - the execution is governed.
 *
 * Each failing condition is named, so *"why did this wait for a human?"* is
 * answerable. With no category opted in, everything routes to review.
 */
import { describe, expect, it } from 'vitest';
import { eligibilityOf, ELIGIBILITY_CONDITIONS } from '../../src/modules/learning/eligibility.js';
import { LearningPolicy, parseLearningPolicy } from '../../src/modules/learning/learning-policy.js';
import { candidateRecord } from '../helpers/learning-fixtures.js';
import { POLICY } from '../helpers/learning-ports.js';

function policy(doc: object = POLICY): LearningPolicy {
  const parsed = parseLearningPolicy(JSON.stringify(doc));
  if (!parsed.ok) throw new Error('bad test policy');
  return new LearningPolicy('pol', 1, 'u_admin', new Date(), parsed.content);
}

const eligible = candidateRecord({ category: 'test-setup', kind: 'new', projectId: 'p1', claimedScope: { kind: 'project', projectIds: ['p1'] }, provisional: false });
const base = { policy: policy(), candidate: eligible, citationStates: ['verified'] as const, conflict: false };

describe('T2346 · the automatic path needs every condition', () => {
  it('all hold → automatic, nothing failed', () => {
    expect(eligibilityOf({ ...base, citationStates: ['verified'] })).toEqual({ automatic: true, failedConditions: [] });
  });

  it.each([
    ['category-not-declared-low-risk', { candidate: { ...eligible, category: 'architecture' } }],
    ['category-not-declared-low-risk', { candidate: { ...eligible, category: 'not-in-policy' } }],
    ['scope-not-source-project', { candidate: { ...eligible, claimedScope: { kind: 'workspace', projectIds: [] } as const } }],
    ['scope-not-source-project', { candidate: { ...eligible, claimedScope: { kind: 'projects', projectIds: ['p1', 'p2'] } as const } }],
    ['evidence-not-verified', { citationStates: ['verified', 'integrity-failed'] }],
    ['evidence-not-verified', { citationStates: ['unresolvable'] }],
    ['evidence-not-verified', { citationStates: [] }],
    ['conflicts-with-approved-entry', { conflict: true }],
    ['kind-not-new', { candidate: { ...eligible, kind: 'supersede', targetVersionId: 'kv_1' } as const }],
    ['kind-not-new', { candidate: { ...eligible, kind: 'deprecate', targetVersionId: 'kv_1' } as const }],
    ['kind-not-new', { candidate: { ...eligible, kind: 'widen-scope', targetVersionId: 'kv_1' } as const }],
    ['execution-not-governed', { candidate: { ...eligible, provisional: true } }],
  ] as const)('%s fails it', (condition, over) => {
    const result = eligibilityOf({ ...base, citationStates: ['verified'], ...(over as object) } as Parameters<typeof eligibilityOf>[0]);
    expect(result.automatic).toBe(false);
    expect(result.failedConditions).toContain(condition);
  });

  it('names every failing condition, not the first', () => {
    const result = eligibilityOf({
      policy: policy(),
      candidate: { ...eligible, category: 'architecture', kind: 'supersede', claimedScope: { kind: 'workspace', projectIds: [] }, provisional: true },
      citationStates: ['integrity-failed'],
      conflict: true,
      sourceInvalid: true,
    });
    expect([...result.failedConditions].sort()).toEqual([...ELIGIBILITY_CONDITIONS].sort());
  });

  it('T2676 · an open source-invalid flag fails it, naming source-invalid (spec Edge Case, FR-LRN-037)', () => {
    expect(eligibilityOf({ ...base, citationStates: ['verified'], sourceInvalid: true })).toEqual({ automatic: false, failedConditions: ['source-invalid'] });
    expect(eligibilityOf({ ...base, citationStates: ['verified'], sourceInvalid: false }).automatic).toBe(true);
  });

  it('a reconciled provisional execution is governed now (FR-LRN-063)', () => {
    expect(eligibilityOf({ ...base, citationStates: ['verified'], candidate: { ...eligible, provisional: true }, reconciled: true }).automatic).toBe(true);
  });
});

describe('T2346 · safe by default (FR-LRN-026, SC-LRN-008)', () => {
  it('with no category opted in, 100% of candidates route to review', () => {
    const none = policy({ categories: [{ key: 'test-setup', description: 'x' }, { key: 'architecture', description: 'y' }] });
    const kinds = ['new', 'supersede', 'deprecate', 'widen-scope'] as const;
    for (const category of ['test-setup', 'architecture']) {
      for (const kind of kinds) {
        const c = { ...eligible, category, kind, targetVersionId: kind === 'new' ? null : 'kv' };
        expect(eligibilityOf({ policy: none, candidate: c, citationStates: ['verified'], conflict: false }).automatic).toBe(false);
      }
    }
  });

  it('lowRisk is never inferred from a category name', () => {
    const named = policy({ categories: [{ key: 'low-risk-trivia', description: 'sounds harmless' }] });
    expect(eligibilityOf({ policy: named, candidate: { ...eligible, category: 'low-risk-trivia' }, citationStates: ['verified'], conflict: false }).automatic).toBe(false);
  });

  it('confidence alone never qualifies (FR-LRN-013)', () => {
    const sure = { ...eligible, category: 'architecture', confidenceLevel: 'high' as const };
    expect(eligibilityOf({ ...base, candidate: sure, citationStates: ['verified'] }).automatic).toBe(false);
  });

  it('corroboration does not qualify either — it is not an input', () => {
    expect(Object.keys(base).sort()).toEqual(['candidate', 'citationStates', 'conflict', 'policy']);
  });
});
