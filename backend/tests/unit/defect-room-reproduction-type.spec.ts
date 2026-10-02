/**
 * `T997k`, `T997l` (EPIC-035) — intermittent is a kind of reproducible, not a
 * flag beside it.
 *
 * `FR-DFR-030`, `FR-DFR-031`: *intermittency MUST be representable; a single
 * passing run MUST NOT close or reclassify an intermittent defect.*
 *
 * ## Why a boolean plus a flag is the wrong shape
 *
 * `reproducible: boolean` with `intermittent: boolean` beside it has four
 * states and only three meanings. `{reproducible: false, intermittent: true}`
 * is the one nobody defines, and it is exactly the state an intermittent defect
 * lands in after a passing run — because the run said false and the flag says
 * it sometimes doesn't.
 *
 * So `intermittent` is a **member of the union**. A defect is `always`,
 * `intermittent`, `not-reproduced` or `not-automatable`, and a single passing
 * run cannot move an `intermittent` one anywhere, because the value already
 * says runs disagree.
 *
 * ## And why `not-automatable` carries its reason
 *
 * `FR-DFR-043`: where a defect is not automatable, the reason MUST be recorded
 * and **the exception MUST be visible and enumerable**. An optional reason
 * makes the exception invisible the moment somebody is in a hurry — and the
 * exception is the one thing about this that a reviewer needs to count.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REPRODUCIBILITY,
  type Reproduction,
} from '../../src/modules/defect-room/reproduction.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  join(here, '..', '..', 'src', 'modules', 'defect-room', 'reproduction.types.ts'),
  'utf8',
);
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('T997k · intermittent is a first-class value', () => {
  it('the vocabulary names it', () => {
    expect([...REPRODUCIBILITY]).toContain('intermittent');
  });

  it('alongside always, not-reproduced and not-automatable', () => {
    expect([...REPRODUCIBILITY]).toEqual([
      'always',
      'intermittent',
      'not-reproduced',
      'not-automatable',
    ]);
  });

  it('and there is no boolean flag beside it', () => {
    // The shape this exists to avoid: four states, three meanings, and the
    // fourth is where an intermittent defect lands after one green run.
    expect(/intermittent\s*:\s*boolean/.test(CODE), 'intermittent is a boolean flag').toBe(false);
    expect(/reproducible\s*:\s*boolean/.test(CODE), 'reproducible is a boolean').toBe(false);
  });

  it('the boolean check can fire', () => {
    expect(/intermittent\s*:\s*boolean/.test('  readonly intermittent: boolean;')).toBe(true);
    expect(/reproducible\s*:\s*boolean/.test('  readonly reproducible: boolean;')).toBe(true);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(REPRODUCIBILITY)).toBe(true);
  });
});

describe('T997k · what a reproduction records', () => {
  const base = {
    id: 'rp_1',
    defectId: 'df_1',
    environment: 'stage, Chrome 141, GB locale',
    // `FR-DFR-032` — through `EPIC-032`'s store, by reference. Never a
    // Room-local attachment.
    evidenceRefs: ['ev_har_1'],
    affectedBehaviourRef: 'rv_1',
    observedAt: new Date('2026-08-31T09:30:00Z'),
  };

  it('an always-reproducible defect needs no exception reason', () => {
    const r: Reproduction = { ...base, reproducible: 'always', notAutomatableReason: null };
    expect(r.reproducible).toBe('always');
    expect(r.notAutomatableReason).toBeNull();
  });

  it('an intermittent one is recorded as such', () => {
    const r: Reproduction = { ...base, reproducible: 'intermittent', notAutomatableReason: null };
    expect(r.reproducible).toBe('intermittent');
  });

  it('and a not-automatable one carries its reason', () => {
    // `FR-DFR-043`. The exception must be visible and enumerable, which means
    // it must be written down where somebody can count it.
    const r: Reproduction = {
      ...base,
      reproducible: 'not-automatable',
      notAutomatableReason: 'reproduction needs a card reader present at the till',
    };
    expect(r.notAutomatableReason).toContain('card reader');
  });

  it('the reason field exists and is never optional', () => {
    // Nullable, not optional: `null` is a stated "no exception here", and an
    // absent key is a question nobody answered. `FR-DFR-041`'s database CHECK
    // pairs with this.
    expect(/notAutomatableReason\s*\?\s*:/.test(CODE), 'the reason is optional').toBe(false);
    expect(CODE).toMatch(/notAutomatableReason\s*:\s*string\s*\|\s*null/);
  });

  it('the optionality check can fire', () => {
    expect(/notAutomatableReason\s*\?\s*:/.test('  readonly notAutomatableReason?: string;')).toBe(
      true,
    );
  });

  it('evidence is held by reference, never inline', () => {
    // `FR-DFR-032`, `FR-DFR-033`: through `EPIC-032`, readable only under the
    // access rules of the artifact it concerns. A payload field here would be
    // a Room-local attachment mechanism and a second copy of somebody's data.
    for (const field of ['payload', 'content', 'attachment', 'blob', 'base64']) {
      expect(
        new RegExp(`\\b${field}\\b`, 'i').test(CODE),
        `reproduction.types.ts carries ${field}`,
      ).toBe(false);
    }
    expect(CODE).toMatch(/evidenceRefs/);
  });

  it('the inline-evidence check can fire', () => {
    expect(/\bpayload\b/i.test('  readonly payload: Buffer;')).toBe(true);
  });
});
