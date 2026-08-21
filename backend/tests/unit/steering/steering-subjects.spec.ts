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

describe('T234 · FR-ENH-002 — exactly the ten named subjects', () => {
  it('the set is exactly the ten, no more, no fewer', () => {
    expect([...STEERING_SUBJECTS].sort()).toEqual([...THE_TEN].sort());
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
