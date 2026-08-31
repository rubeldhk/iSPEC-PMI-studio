/**
 * `T997i`, `T997j` (EPIC-035) — a passing reproduction test has three ways out,
 * and none of them is automatic.
 *
 * `FR-DFR-044`, `R-035-6`: *a passing reproduction test MUST route to an
 * evidence check with three available paths — refine the test, investigate
 * further, or reclassify — and MUST NOT reclassify automatically.*
 *
 * ## The failure this prevents
 *
 * The reproduction test passes. The obvious inference is that the defect is not
 * real, so the system reclassifies it and everyone moves on. That inference is
 * wrong often enough to matter: the test may reproduce the wrong thing, the
 * defect may be intermittent (`FR-DFR-031`), or the environment may differ. A
 * system that reclassifies on a green run is not reasoning — it is guessing,
 * and it is guessing in the direction that closes work.
 *
 * So the path is **required with no default**. Not `path?: EvidenceCheckPath`
 * defaulting to `reclassify`, and not a boolean pair where "neither set" means
 * something. A path taken by omission is a decision nobody made.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_CHECK_PATHS,
  type EvidenceCheck,
} from '../../src/modules/defect-room/evidence-check.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  join(here, '..', '..', 'src', 'modules', 'defect-room', 'evidence-check.types.ts'),
  'utf8',
);
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('T997i · three paths, named', () => {
  it('exactly three', () => {
    expect(EVIDENCE_CHECK_PATHS).toHaveLength(3);
  });

  it('refine, investigate, reclassify', () => {
    expect([...EVIDENCE_CHECK_PATHS]).toEqual([
      'refine-the-test',
      'investigate-further',
      'reclassify',
    ]);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(EVIDENCE_CHECK_PATHS)).toBe(true);
  });

  it('and reclassify is one path of three, not the fallback', () => {
    // The distinction `FR-DFR-044` turns on. Reclassifying is available and it
    // is not what happens when nobody chooses.
    expect(EVIDENCE_CHECK_PATHS.indexOf('reclassify')).toBeGreaterThan(0);
  });
});

describe('T997i · the path is required, with no default', () => {
  it('is not optional', () => {
    expect(/path\s*\?\s*:/.test(CODE), 'the evidence check has an optional path').toBe(false);
  });

  it('and no default is assigned anywhere', () => {
    // `?? 'reclassify'` or `= 'reclassify'` would make the dangerous path the
    // one taken by omission.
    expect(/\?\?\s*'(refine-the-test|investigate-further|reclassify)'/.test(CODE)).toBe(false);
    expect(/=\s*'(refine-the-test|investigate-further|reclassify)'/.test(CODE)).toBe(false);
  });

  it('the default checks can fire', () => {
    expect(/path\s*\?\s*:/.test('  readonly path?: EvidenceCheckPath;')).toBe(true);
    expect(/\?\?\s*'reclassify'/.test("const p = input.path ?? 'reclassify';")).toBe(true);
    expect(/=\s*'reclassify'/.test("const path: EvidenceCheckPath = 'reclassify';")).toBe(true);
  });

  it('a check states its path and who chose it', () => {
    // A path with no chooser is an automatic reclassification wearing a
    // person's clothes.
    const check: EvidenceCheck = {
      id: 'ec_1',
      defectId: 'df_1',
      testId: 'dt_1',
      path: 'investigate-further',
      chosenBy: 'u_1',
      reason: 'the run passed on CI and fails locally; the environment differs',
      chosenAt: new Date('2026-08-31T10:00:00Z'),
    };
    expect(check.path).toBe('investigate-further');
    expect(check.chosenBy).toBe('u_1');
    expect(/chosenBy\s*\?\s*:/.test(CODE), 'chosenBy is optional').toBe(false);
  });

  it('and it states why, so a later reader knows what was weighed', () => {
    expect(/reason\s*\?\s*:/.test(CODE), 'the reason is optional').toBe(false);
  });
});

describe('T997i · nothing here reclassifies on its own', () => {
  it('the module exports no function at all', () => {
    // `FR-DFR-044`'s *MUST NOT reclassify automatically*, held structurally.
    // This file is types; a verb here would be the automatic path arriving
    // where nobody looks for it.
    expect(/export\s+(async\s+)?function/.test(CODE), 'evidence-check.types.ts exports a function').toBe(
      false,
    );
    expect(/export\s+class/.test(CODE)).toBe(false);
  });

  it('the export check can fire', () => {
    expect(/export\s+(async\s+)?function/.test('export function reclassify() {}')).toBe(true);
    expect(/export\s+class/.test('export class EvidenceChecker {}')).toBe(true);
  });
});
