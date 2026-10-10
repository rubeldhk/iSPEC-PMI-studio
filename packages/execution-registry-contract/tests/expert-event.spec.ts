/**
 * `T1915` (EPIC-047) — one additive event type for Expert governance.
 *
 * `R-047-4`, `FR-EXP-061`. Dispatch refusals, fallbacks, limit stops and
 * delegation refusals belong on the execution, not in a side log — so they are
 * events. One type with a `kind` keeps the change to another Epic's contract to
 * a single line, and the kinds are closed here so a twelfth-and-a-half cannot
 * be added by a typo.
 */
import { describe, expect, it } from 'vitest';
import {
  ALL_EVENT_TYPES,
  EXPERT_GOVERNANCE_KINDS,
  classOf,
  isExecutionEventType,
  isExpertGovernanceKind,
} from '../src/events.js';

describe('T1915 · expert-governance-recorded', () => {
  it('is in the vocabulary, as a content event', () => {
    expect(isExecutionEventType('expert-governance-recorded')).toBe(true);
    expect(ALL_EVENT_TYPES).toContain('expert-governance-recorded');
    expect(classOf('expert-governance-recorded')).toBe('content');
  });

  it('carries exactly the twelve kinds of R-047-4', () => {
    expect([...EXPERT_GOVERNANCE_KINDS].sort()).toEqual(
      [
        'dispatch-refused',
        'fallback-used',
        'limit-narrowed',
        'limit-unenforceable',
        'limit-reached',
        'limit-breach-detected-late',
        'tool-use-unobserved',
        'tool-call-breach',
        'delegation-refused',
        'stopped-by-parent',
        'outputs-incomplete',
        'review-required',
      ].sort(),
    );
    expect(isExpertGovernanceKind('review-required')).toBe(true);
    expect(isExpertGovernanceKind('approved-anyway')).toBe(false);
  });
});
