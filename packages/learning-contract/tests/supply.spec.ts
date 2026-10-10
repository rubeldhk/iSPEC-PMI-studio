/**
 * `T2309` (EPIC-048) — what `EPIC-038` calls, and what goes on the execution.
 *
 * `R-048-11`: admission answers with **existing** `EPIC-038` exclusion reasons,
 * so 038's enum and CHECK do not change. `R-048-17`: the event payload kinds are
 * exactly six and carry no statement text — the candidate holds it.
 */
import { describe, expect, it } from 'vitest';
import { ADMISSION_DETAIL_PREFIXES, ADMISSION_REASONS } from '../src/supply.js';
import { LEARNING_EVENT_KINDS, LEARNING_EVENT_TYPE, learningEventPayload } from '../src/events.js';

/** EPIC-038's `EXCLUSION_REASONS` (`retrieval/outcome.types.ts:32`), as merged. */
const CONTEXT_EXCLUSION_REASONS = ['permission', 'classification', 'budget', 'boundary', 'stale'];

describe('T2309 · AdmissionVerdict.reason ⊆ EPIC-038 exclusion reasons', () => {
  it('is exactly boundary | classification | stale | permission', () => {
    expect([...ADMISSION_REASONS].sort()).toEqual(['boundary', 'classification', 'permission', 'stale']);
    for (const r of ADMISSION_REASONS) expect(CONTEXT_EXCLUSION_REASONS).toContain(r);
  });

  it('names the rule in a detail prefix for every R-048-11 row', () => {
    expect([...ADMISSION_DETAIL_PREFIXES].sort()).toEqual(
      ['archived:', 'classification:', 'deprecated:', 'memory-policy:', 'reuse-policy:', 'scope:', 'superseded:', 'workspace:'].sort(),
    );
  });
});

describe('T2309 · learning-candidate-recorded (R-048-17)', () => {
  it('has exactly six kinds', () => {
    expect([...LEARNING_EVENT_KINDS]).toEqual([
      'submitted',
      'late-submitted',
      'corroborated',
      'refused',
      'bound-exceeded',
      'memory-policy-refused',
    ]);
    expect(LEARNING_EVENT_TYPE).toBe('learning-candidate-recorded');
  });

  it('builds a payload with no statement text — kind, candidateId and reason only', () => {
    const payload = learningEventPayload({ kind: 'submitted', candidateId: 'lc_1' });
    expect(Object.keys(payload).sort()).toEqual(['candidateId', 'kind']);
    const refused = learningEventPayload({ kind: 'refused', reason: 'evidence missing' });
    expect(Object.keys(refused).sort()).toEqual(['kind', 'reason']);
  });

  it('drops anything else it is handed, statement included', () => {
    const smuggled = { kind: 'submitted', candidateId: 'lc_1', statement: 'secret knowledge', subject: 's' } as unknown as Parameters<
      typeof learningEventPayload
    >[0];
    const payload = learningEventPayload(smuggled);
    expect(payload).not.toHaveProperty('statement');
    expect(payload).not.toHaveProperty('subject');
  });

  it('refuses a kind outside the six', () => {
    expect(() => learningEventPayload({ kind: 'approved' as never })).toThrow();
  });
});
