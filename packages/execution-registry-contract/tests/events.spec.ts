/**
 * T1024 (EPIC-037 Band A) — the event vocabulary is closed, classified and total.
 *
 * These are the assertions that stop the vocabulary drifting back into the
 * shape it was corrected out of: 29 names, four classes, every name in exactly
 * one, and three ambiguous names that must stay gone.
 */
import { describe, expect, it } from 'vitest';
import {
  ALL_EVENT_TYPES,
  CONTENT_EVENTS,
  EVENT_CLASSES,
  GOVERNANCE_EVENTS,
  LIFECYCLE_EVENTS,
  REGISTRATION_EVENTS,
  TERMINAL_LIFECYCLE_EVENTS,
  WITHDRAWN_EVENT_TYPES,
  classOf,
  isExecutionEventType,
  isTerminalLifecycleEvent,
  permittedAfterTerminal,
  type ExecutionEventType,
} from '../src/events.js';

describe('T1024 · exactly 29 events in four classes', () => {
  it('has 9 + 4 + 4 + 12 = 29', () => {
    expect(LIFECYCLE_EVENTS).toHaveLength(9);
    expect(CONTENT_EVENTS).toHaveLength(4);
    expect(REGISTRATION_EVENTS).toHaveLength(4);
    expect(GOVERNANCE_EVENTS).toHaveLength(12);
    expect(ALL_EVENT_TYPES).toHaveLength(29);
  });

  it('names no event twice', () => {
    expect(new Set(ALL_EVENT_TYPES).size).toBe(ALL_EVENT_TYPES.length);
  });

  it('classifies every event into exactly one class', () => {
    // Total and unambiguous: `classOf` is what terminality reads, so a name it
    // could not place would make terminality undecidable for that event.
    for (const type of ALL_EVENT_TYPES) {
      expect(EVENT_CLASSES).toContain(classOf(type));
    }
    const perClass = EVENT_CLASSES.map(
      (c) => ALL_EVENT_TYPES.filter((t) => classOf(t) === c).length,
    );
    expect(perClass).toEqual([9, 4, 4, 12]);
  });

  it('refuses a name outside the vocabulary', () => {
    expect(isExecutionEventType('not-an-event')).toBe(false);
    expect(() => classOf('not-an-event' as ExecutionEventType)).toThrow();
  });

  it('accepts every name inside it — the guard is not simply refusing everything', () => {
    for (const type of ALL_EVENT_TYPES) expect(isExecutionEventType(type)).toBe(true);
  });
});

describe('T1024 · the three withdrawn names stay withdrawn', () => {
  it.each(WITHDRAWN_EVENT_TYPES)('%s is not in the vocabulary', (name) => {
    // Each was ambiguous in the way that costs most later:
    // `validation-completed` could not tell pass from fail — the distinction
    // the whole adjudication turns on — and `reconciled` could not tell
    // accepted from conflicted.
    expect(isExecutionEventType(name)).toBe(false);
    expect(ALL_EVENT_TYPES as readonly string[]).not.toContain(name);
  });

  it('records why they are absent, rather than leaving it to memory', () => {
    // A name nobody wrote down as forbidden comes back the first time someone
    // wants "a general validation event".
    expect(WITHDRAWN_EVENT_TYPES).toHaveLength(3);
  });
});

describe('T1024 · terminality is class-aware (FR-EXR-018)', () => {
  it('treats the five outcomes as terminal', () => {
    expect([...TERMINAL_LIFECYCLE_EVENTS].sort()).toEqual(
      ['cancelled', 'completed', 'failed', 'partially-completed', 'timed-out'].sort(),
    );
  });

  it('does NOT treat `blocked` as terminal — a blocked run is waiting, not finished', () => {
    expect(isTerminalLifecycleEvent('blocked')).toBe(false);
  });

  it('DOES treat `partially-completed` as terminal — it is an outcome, not a pause', () => {
    expect(isTerminalLifecycleEvent('partially-completed')).toBe(true);
  });

  it('blocks every LIFECYCLE event after terminality', () => {
    for (const type of LIFECYCLE_EVENTS) {
      expect(permittedAfterTerminal(type), `${type} was permitted after terminal`).toBe(false);
    }
  });

  it('permits every OTHER class after terminality', () => {
    // The half that a flat "nothing after terminal" rule would lose: an
    // execution finishing does not settle everything about it. Comments,
    // redactions, reconciliation and governance all continue.
    for (const type of [...CONTENT_EVENTS, ...REGISTRATION_EVENTS, ...GOVERNANCE_EVENTS]) {
      expect(permittedAfterTerminal(type), `${type} was blocked after terminal`).toBe(true);
    }
  });
});
