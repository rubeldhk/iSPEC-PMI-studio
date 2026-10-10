/**
 * T856g — the gate result, written to fail first.
 *
 * `FR-EVS-032`: a refused completion names what is missing, so the failure
 * branch carries a non-empty `unmet` list — a refusal with an empty list is not
 * representable. `FR-EVS-014`/`FR-EVS-034`: four item states, three of them not
 * `met`. A reader can tell "nobody produced it" from "it cannot be trusted"; the
 * gate treats all three the same.
 */
import { describe, expect, it } from 'vitest';
import { ITEM_STATES, isMet, refuse, type CompletionResult } from '../src/gate.js';

describe('T856g · four item states, and three are not met', () => {
  it('names exactly met, unmet, unresolvable and integrity-failed', () => {
    expect(ITEM_STATES).toEqual(['met', 'unmet', 'unresolvable', 'integrity-failed']);
    expect(Object.isFrozen(ITEM_STATES)).toBe(true);
  });

  it('counts only met as met', () => {
    expect(ITEM_STATES.filter(isMet)).toEqual(['met']);
  });
});

describe('T856g · FR-EVS-032 — a refusal names what is missing', () => {
  it('cannot be built with an empty unmet list at compile time', () => {
    // @ts-expect-error — the failure branch's `unmet` is a non-empty tuple.
    const bad: CompletionResult = { ok: false, unmet: [] };
    expect(bad).toBeDefined();
  });

  it('refuses at runtime too, for lists built from data', () => {
    expect(() => refuse([])).toThrow(/non-empty/);
    expect(refuse(['tests-pass'])).toEqual({ ok: false, unmet: ['tests-pass'] });
  });
});
