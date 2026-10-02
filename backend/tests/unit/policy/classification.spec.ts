/**
 * `T1196`, `T1197` (EPIC-031, scoped) — risk classification and the three bands.
 *
 * The narrow slice the Requirement Room needs, and no more: `DEF-033-002` found
 * `PolicyProvider` unbound, so `decide` refused and `SC-RQR-008` was unreachable.
 *
 * Four requirements shape everything here, and three of them are about what
 * happens when nothing is configured:
 *
 * - **`FR-DPE-004`** an action with no matching rule gets the **most
 *   restrictive** band. This is the one that makes an empty policy safe rather
 *   than permissive, and it is the opposite of what a cache-miss usually does.
 * - **`FR-DPE-002`** classification is a property of the **action and its
 *   target**, never of the requester. *"Modifying an approved baseline is high
 *   risk regardless of who asks."*
 * - **`FR-DPE-003`** policy-declared, never model-inferred.
 * - **`FR-DPE-012`** the high band **cannot be configured away** for the actions
 *   `PMI-DOC-004` names.
 */
import { describe, expect, it } from 'vitest';
import {
  BANDS,
  IRREDUCIBLY_HIGH,
  classify,
  type ClassificationRule,
} from '../../../src/modules/policy/classification.js';

const rule = (over: Partial<ClassificationRule> = {}): ClassificationRule => ({
  actionType: 'requirement-room.decide',
  band: 'medium',
  scopePath: '/org',
  declaredBy: 'steering-doc-1',
  ...over,
});

describe('T1196 · the three bands', () => {
  it('names exactly low, medium and high', () => {
    // `FR-DPE-010` — exactly three. A fourth would need a rule for what it
    // means, and there is none.
    expect([...BANDS]).toEqual(['low', 'medium', 'high']);
  });
});

describe('T1196 · an unclassified action is HIGH', () => {
  it('classifies to high when no rule matches', () => {
    // `FR-DPE-004`. The whole safety of an unconfigured engine rests here.
    const result = classify({ actionType: 'anything.at.all', scopePath: '/org/ws' }, []);
    expect(result.band).toBe('high');
    expect(result.matchedRule).toBeNull();
  });

  it('says WHY it is high, so nobody reads it as a policy decision', () => {
    const result = classify({ actionType: 'anything.at.all', scopePath: '/org/ws' }, []);
    expect(result.explanation).toMatch(/no classification rule/i);
    expect(result.explanation).toMatch(/most restrictive/i);
  });

  it('is high even when rules exist but none match', () => {
    // The subtler case: a populated policy is not the same as a matching one,
    // and a near-miss must not fall through to the nearest band.
    const result = classify({ actionType: 'something.else', scopePath: '/org/ws' }, [rule()]);
    expect(result.band).toBe('high');
    expect(result.matchedRule).toBeNull();
  });
});

describe('T1196 · classification comes from the action and target, not the requester', () => {
  it('takes the band from a matching rule', () => {
    const result = classify(
      { actionType: 'requirement-room.decide', scopePath: '/org/ws' },
      [rule({ band: 'medium', scopePath: '/org' })],
    );
    expect(result.band).toBe('medium');
    expect(result.matchedRule?.declaredBy).toBe('steering-doc-1');
  });

  it('accepts no requester at all — there is nowhere to put one', () => {
    // `FR-DPE-002`, asserted structurally. A signature that took an actor could
    // classify by who asked, and someone eventually would.
    expect(classify.length).toBe(2);
  });

  it('prefers the NARROWER scope when two rules match', () => {
    // `FR-DPE-005` — composable at organization, workspace, project, repository
    // and path scope. The narrower declaration wins.
    const result = classify({ actionType: 'requirement-room.decide', scopePath: '/org/ws/proj' }, [
      rule({ band: 'high', scopePath: '/org' }),
      rule({ band: 'low', scopePath: '/org/ws/proj' }),
    ]);
    expect(result.band).toBe('low');
    expect(result.matchedRule?.scopePath).toBe('/org/ws/proj');
  });

  it('ignores a rule declared at a scope the action is not inside', () => {
    const result = classify({ actionType: 'requirement-room.decide', scopePath: '/org/ws_a' }, [
      rule({ band: 'low', scopePath: '/org/ws_b' }),
    ]);
    expect(result.band).toBe('high');
  });
});

describe('T1196 · the high band cannot be configured away', () => {
  it.each([...IRREDUCIBLY_HIGH])('keeps %s at high whatever policy says', (actionType) => {
    // `FR-DPE-012`. A tenant may tune the burden (`FR-DPE-011`) but not below
    // this floor, so the rule is applied AFTER the match rather than before.
    const result = classify({ actionType, scopePath: '/org/ws' }, [
      rule({ actionType, band: 'low', scopePath: '/org/ws' }),
    ]);
    expect(result.band).toBe('high');
    expect(result.explanation).toMatch(/cannot be configured away/i);
  });

  it('names the actions that are irreducibly high', () => {
    // Baseline changes, release promotion, loop configuration changes — the set
    // `FR-DPE-012` and `EPIC-030` `FR-GEL-016` name between them.
    expect(IRREDUCIBLY_HIGH).toContain('requirement-room.baseline');
    expect(IRREDUCIBLY_HIGH).toContain('release.promote');
    expect(IRREDUCIBLY_HIGH).toContain('loop.configuration.change');
  });

  it('a NON-listed action can still be lowered — or the floor means nothing', () => {
    // Anti-vacuity: without this, a `classify` that returned high for
    // everything would pass every assertion above.
    const result = classify({ actionType: 'requirement-room.decide', scopePath: '/org/ws' }, [
      rule({ band: 'low', scopePath: '/org/ws' }),
    ]);
    expect(result.band).toBe('low');
  });
});

describe('T1196 · a recorded classification does not move', () => {
  it('returns the rule it matched, so the decision can record it', () => {
    // `FR-DPE-006` — a later rule change must not alter the recorded class of a
    // decision already taken. The engine cannot enforce that alone; it makes it
    // possible by returning what it matched, for the caller to store.
    const declared = rule({ band: 'medium', scopePath: '/org' });
    const result = classify({ actionType: 'requirement-room.decide', scopePath: '/org/ws' }, [
      declared,
    ]);
    expect(result.matchedRule).toEqual(declared);
  });
});
