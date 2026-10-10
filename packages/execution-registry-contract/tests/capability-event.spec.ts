/**
 * `T2131` (EPIC-039, `FR-HUB-038`, `R-039-12`) — a capability resolution made
 * inside a registered execution is an event ON that execution, not only a row
 * in the Hub's own log (Constitution XII).
 *
 * `governance`, not `content`: it may follow a terminal lifecycle event, because
 * an execution finishing is not the end of what is decided about it. Written to
 * FAIL before `T2132`. `EPIC-047` merged first with a content event
 * (`expert-governance-recorded`), so the totals are 9 + 5 + 4 + 13 = 31.
 */
import { describe, expect, it } from 'vitest';
import { ALL_EVENT_TYPES, GOVERNANCE_EVENTS, classOf, isExecutionEventType, permittedAfterTerminal } from '../src/events.js';

describe('T2131 · capability-resolved', () => {
  it('is a governance event', () => {
    expect(GOVERNANCE_EVENTS).toContain('capability-resolved');
    expect(isExecutionEventType('capability-resolved')).toBe(true);
    expect(classOf('capability-resolved')).toBe('governance');
  });

  it('appears exactly once in the vocabulary', () => {
    expect(ALL_EVENT_TYPES.filter((t) => t === 'capability-resolved')).toHaveLength(1);
  });

  it('may follow a terminal lifecycle event', () => {
    expect(permittedAfterTerminal('capability-resolved')).toBe(true);
  });
});
