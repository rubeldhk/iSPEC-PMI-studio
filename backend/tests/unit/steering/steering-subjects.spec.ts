/**
 * T234 — the ten steering subjects of FR-ENH-002, and nothing else.
 * Written to FAIL before T235 exists (Constitution V).
 */
import { describe, expect, it } from 'vitest';
import {
  STEERING_SUBJECTS,
  assertSteeringSubject,
} from '../../../src/modules/steering/steering.validation.js';

const THE_TEN = [
  'organization',
  'workspace',
  'product',
  'architecture',
  'coding_standards',
  'security',
  'ui_standards',
  'business_rules',
  'technology_stack',
  'ai_governance',
];

/**
 * EPIC-031 `R-031-1` — classification rules live in steering. The one subject
 * the source document does not name, added on purpose and recorded as
 * `DEF-031-001`; listed separately so the ten stay visibly the ten.
 */
const ADDED_BY_EPIC_031 = ['risk-classification'];

describe('T234 · FR-ENH-002 — exactly the ten named subjects, plus EPIC-031’s one', () => {
  it('the set is exactly the ten and risk-classification, no more, no fewer', () => {
    expect([...STEERING_SUBJECTS].sort()).toEqual([...THE_TEN, ...ADDED_BY_EPIC_031].sort());
  });

  it.each(THE_TEN)('accepts %s', (subject) => {
    expect(assertSteeringSubject(subject)).toBe(subject);
  });

  it('refuses any other subject BY NAME', () => {
    expect(() => assertSteeringSubject('galaxy_standards')).toThrow(/galaxy_standards/);
  });

  it('the refusal lists the ten valid subjects so the caller can act', () => {
    try {
      assertSteeringSubject('vibes');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Error).message).toMatch(/coding_standards/);
      expect((err as Error).message).toMatch(/ai_governance/);
    }
  });

  it('does not accept near-misses in other casings', () => {
    expect(() => assertSteeringSubject('Coding Standards')).toThrow();
    expect(() => assertSteeringSubject('coding-standards')).toThrow();
  });
});
