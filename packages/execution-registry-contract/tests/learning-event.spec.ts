/**
 * `T2324` (EPIC-048, `A-037-2`, `R-048-17`) — `learning-candidate-recorded`.
 *
 * One **content** event type. A learning submission is something said about an
 * execution, not a step of its progress — so it is recordable after the
 * execution's terminal event, which is what a late submission inside the grace
 * period needs (`FR-LRN-005`). The pattern is `EPIC-047`'s
 * `expert-governance-recorded`.
 */
import { describe, expect, it } from 'vitest';
import {
  ALL_EVENT_TYPES,
  CONTENT_EVENTS,
  classOf,
  isExecutionEventType,
  permittedAfterTerminal,
} from '../src/events.js';

describe('T2324 · learning-candidate-recorded is a content event', () => {
  it('is a member of the content class', () => {
    expect(CONTENT_EVENTS as readonly string[]).toContain('learning-candidate-recorded');
    expect(ALL_EVENT_TYPES as readonly string[]).toContain('learning-candidate-recorded');
  });

  it('isExecutionEventType accepts it', () => {
    expect(isExecutionEventType('learning-candidate-recorded')).toBe(true);
  });

  it('classOf is content', () => {
    expect(classOf('learning-candidate-recorded')).toBe('content');
  });

  it('is permitted after a terminal lifecycle event', () => {
    expect(permittedAfterTerminal('learning-candidate-recorded')).toBe(true);
  });
});
