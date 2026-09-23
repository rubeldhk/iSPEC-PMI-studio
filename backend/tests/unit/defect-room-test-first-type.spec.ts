/**
 * `T997g`, `T997h` (EPIC-035) — a fix cannot be accepted without a test that
 * was seen to fail.
 *
 * `FR-DFR-040`, `FR-DFR-041`, `ADR-0016`.
 *
 * ## Two ways this requirement gets satisfied on paper
 *
 * **"Does a test exist?"** A test written after the fix, green from its first
 * run, passes that check and proves nothing: it demonstrates the code as
 * written, not the defect as reported. So `firstObservedFailingAt` is
 * **non-optional**. A nullable one would let a test that never failed satisfy a
 * naive existence check, and the null would read as "not recorded yet" rather
 * than "this never happened".
 *
 * **"The caller will pass the test in."** `FixAcceptance`'s accepted branch is
 * a discriminated union whose `true` arm **carries the `DefectTest`**. Not a
 * separate optional field checked at runtime — a field somebody forgets to
 * check. An acceptance without the test it rests on does not typecheck.
 *
 * The reason for building it this way rather than validating: a validator runs
 * where somebody remembered to call it, and this is the check most worth
 * skipping at 6pm on a Friday when the fix is obviously right.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  DefectTest,
  FixAcceptance,
} from '../../src/modules/defect-room/test-first.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  join(here, '..', '..', 'src', 'modules', 'defect-room', 'test-first.types.ts'),
  'utf8',
);
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const test1: DefectTest = {
  id: 'dt_1',
  defectId: 'df_1',
  // `FR-DFR-042` — linked to the defect AND to the behaviour it contests.
  contestedBehaviourRef: 'rv_1',
  reference: 'backend/tests/unit/regression.spec.ts::the window is one hour',
  firstObservedFailingAt: new Date('2026-08-31T09:00:00Z'),
};

describe('T997g · a test records when it was first seen to fail', () => {
  it('carries the instant', () => {
    expect(test1.firstObservedFailingAt.toISOString()).toBe('2026-08-31T09:00:00.000Z');
  });

  it('and the field is not optional', () => {
    // The structural half. A `?` here is the whole defect: a test written after
    // the fix would satisfy "does a test exist?" while proving only that the
    // code does what it does.
    expect(
      /firstObservedFailingAt\s*\?\s*:/.test(CODE),
      'firstObservedFailingAt is optional',
    ).toBe(false);
    expect(
      /firstObservedFailingAt\s*:\s*Date\s*\|\s*null/.test(CODE),
      'firstObservedFailingAt is nullable',
    ).toBe(false);
  });

  it('the optionality check can fire', () => {
    expect(/firstObservedFailingAt\s*\?\s*:/.test('  readonly firstObservedFailingAt?: Date;')).toBe(
      true,
    );
    expect(
      /firstObservedFailingAt\s*:\s*Date\s*\|\s*null/.test(
        '  readonly firstObservedFailingAt: Date | null;',
      ),
    ).toBe(true);
  });

  it('and it links the behaviour it contests, not only the defect', () => {
    // `FR-DFR-042`. A test linked to the defect alone cannot answer "what was
    // this supposed to do?", which is the question a later reader has.
    expect(test1.contestedBehaviourRef).toBe('rv_1');
    expect(/contestedBehaviourRef\s*\?\s*:/.test(CODE)).toBe(false);
  });
});

describe('T997g · acceptance carries its test, or does not exist', () => {
  it('an accepted fix holds the DefectTest', () => {
    const accepted: FixAcceptance = { accepted: true, test: test1, acceptedBy: 'u_1' };
    expect(accepted.accepted).toBe(true);
    expect(accepted.test.reference).toContain('regression.spec.ts');
  });

  it('a refused fix states why, and carries no test', () => {
    // The other arm. A refusal is a real outcome and needs its own shape:
    // reusing the accepted one with `test: null` is how the null becomes
    // "not recorded yet".
    const refused: FixAcceptance = {
      accepted: false,
      reason: 'no failing test is on record for this defect (FR-DFR-041)',
    };
    expect(refused.accepted).toBe(false);
    expect(refused.reason).toMatch(/FR-DFR-041/);
  });

  it('the accepted arm has no optional test field to forget', () => {
    // What makes this a type guarantee rather than a convention. `test?:`
    // anywhere in the accepted arm would put the check back in a validator
    // somebody has to remember to run.
    expect(/test\s*\?\s*:/.test(CODE), 'the acceptance has an optional test field').toBe(false);
    expect(/test\s*:\s*DefectTest\s*\|\s*null/.test(CODE)).toBe(false);
  });

  it('the acceptance-shape check can fire', () => {
    expect(/test\s*\?\s*:/.test('  readonly test?: DefectTest;')).toBe(true);
    expect(/test\s*:\s*DefectTest\s*\|\s*null/.test('  readonly test: DefectTest | null;')).toBe(
      true,
    );
  });

  it('and it is a discriminated union, so the two arms cannot be mixed', () => {
    expect(CODE).toMatch(/accepted:\s*true/);
    expect(CODE).toMatch(/accepted:\s*false/);
  });
});
