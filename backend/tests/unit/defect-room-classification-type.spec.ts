/**
 * `T997e`, `T997f` (EPIC-035) — three outcomes, and every one has a destination.
 *
 * `FR-DFR-022`, `FR-DFR-077`, `ADR-0016`. Triage has **three** outcomes:
 * Confirmed Defect, Change Request, and **Requirement Gap** where no approved
 * behaviour exists at all.
 *
 * ## Why the third one is the whole point
 *
 * Two outcomes is the shape everybody builds: *is this a bug, or is it a change
 * somebody wants?* The third case — **nobody ever agreed what this should do** —
 * looks like one of the first two from close up, and gets recorded as whichever
 * the triager finds less awkward. Filed as a defect it blames the
 * implementation for a decision nobody took; filed as a change request it
 * invents a baseline to change.
 *
 * ## And why `DESTINATIONS` is a `Record`, not a `switch`
 *
 * `FR-DFR-077`: a classification cannot exist without the destination its
 * outcome maps to. A `switch` with a `default` compiles happily when a fourth
 * outcome arrives and sends it wherever the default points — which is where a
 * new outcome goes to die quietly. A total `Record` over the union does not
 * compile until somebody decides where the new one goes.
 *
 * The names are read from `FR-DFR-022`'s own sentence rather than restated
 * here: `EPIC-034`'s `DEF-034-001` is what restating costs — a constant and the
 * test that checked it were written from one misreading and agreed with each
 * other.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CLASSIFICATION_OUTCOMES,
  DESTINATIONS,
  type ClassificationOutcome,
} from '../../src/modules/defect-room/classification.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const SPEC = readFileSync(
  resolve(here, '..', '..', '..', 'specs', '035-defect-room', 'spec.md'),
  'utf8',
);
const FR_DFR_022 = SPEC.split('\n').find((line) => line.includes('**FR-DFR-022**')) ?? '';
const SOURCE = readFileSync(
  join(here, '..', '..', 'src', 'modules', 'defect-room', 'classification.types.ts'),
  'utf8',
);
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('T997e · exactly three outcomes', () => {
  it('names three', () => {
    expect(CLASSIFICATION_OUTCOMES).toHaveLength(3);
  });

  it('and the requirement says three, in the spec rather than in this test', () => {
    // Anti-vacuity first: the line must be found before it can be trusted.
    expect(FR_DFR_022).toContain('three outcomes');
    expect(FR_DFR_022.length).toBeGreaterThan(80);
  });

  it('each one is spoken for in FR-DFR-022', () => {
    // `DEF-034-001`'s lesson, applied before the mistake rather than after it.
    const spoken: Readonly<Record<ClassificationOutcome, string>> = {
      'confirmed-defect': 'confirmed defect',
      'change-request': 'change request',
      'requirement-gap': 'requirement gap',
    };
    for (const outcome of CLASSIFICATION_OUTCOMES) {
      expect(
        FR_DFR_022.toLowerCase().includes(spoken[outcome]),
        `FR-DFR-022 does not mention "${spoken[outcome]}"`,
      ).toBe(true);
    }
  });

  it('the spec check can fail', () => {
    expect('classification supports two outcomes'.includes('requirement gap')).toBe(false);
  });

  it('is frozen, so a fourth cannot be added at runtime', () => {
    expect(Object.isFrozen(CLASSIFICATION_OUTCOMES)).toBe(true);
  });
});

describe('T997e · every outcome has a destination', () => {
  it('DESTINATIONS covers all three', () => {
    expect(Object.keys(DESTINATIONS).sort()).toEqual([...CLASSIFICATION_OUTCOMES].sort());
  });

  it('and each destination is a real one, not a placeholder', () => {
    for (const outcome of CLASSIFICATION_OUTCOMES) {
      expect(DESTINATIONS[outcome].length, `${outcome} has no destination`).toBeGreaterThan(0);
    }
  });

  it('a requirement gap goes to EPIC-033, not to this Room', () => {
    // The routing that makes the third outcome worth having. A gap held here
    // would be a defect record standing in for a requirement nobody wrote.
    expect(DESTINATIONS['requirement-gap']).toContain('EPIC-033');
  });

  it('a change request goes to EPIC-034', () => {
    expect(DESTINATIONS['change-request']).toContain('EPIC-034');
  });

  it('and a confirmed defect stays here', () => {
    // The control: if every outcome routed elsewhere, the mapping would be
    // saying this Room does nothing.
    expect(DESTINATIONS['confirmed-defect']).toMatch(/EPIC-035|this Room|defect-room/i);
  });
});

describe('T997e · the mapping is total by construction', () => {
  it('is a Record over the union, never a switch with a default', () => {
    // `FR-DFR-077`. A `default` compiles when a fourth outcome arrives and
    // sends it wherever the default points — which is where a new outcome goes
    // to die quietly.
    expect(/switch\s*\(/.test(CODE), 'classification.types.ts branches with a switch').toBe(false);
    expect(/default\s*:/.test(CODE), 'classification.types.ts has a default arm').toBe(false);
  });

  it('the switch check can fire', () => {
    // Anti-tautology for both absence assertions.
    expect(/switch\s*\(/.test('switch (outcome) { default: return here; }')).toBe(true);
    expect(/default\s*:/.test('  default: return DEFECT_ROOM;')).toBe(true);
  });

  it('and `destination` is not nullable on the Classification itself', () => {
    // The other half of the hole `T999n(a)` found. A total `Record` guarantees
    // every OUTCOME has a destination; it says nothing about whether a stored
    // classification must carry one. `string | null` satisfies every other
    // assertion in this file while letting a row rest with nowhere to go.
    expect(CODE).toMatch(/readonly destination: string;/);
    expect(CODE).not.toMatch(/readonly destination: string \| null/);
  });

  it('the nullable-destination check can fire', () => {
    expect(/readonly destination: string \| null/.test('  readonly destination: string | null;')).toBe(
      true,
    );
  });

  it('and the Record is declared over the outcome type', () => {
    // The positive half: absence of a switch is not the same as presence of a
    // total mapping.
    expect(CODE).toMatch(/Record<\s*ClassificationOutcome/);
  });
});
