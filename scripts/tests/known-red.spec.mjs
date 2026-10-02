/**
 * The known-red gate's own logic (2026-10-01).
 *
 * `scripts/` is not on Constitution I's exempt list, so this is application
 * code and Constitution V is NON-NEGOTIABLE — the same argument `T600` makes
 * for the register generator.
 *
 * ## What the gate is for, and the trap it must not fall into
 *
 * Two checks are red because work is genuinely outstanding: `T884` waits on a
 * human screen-reader pass, `T999u` on a keyboard-only Tier 2 journey. They sat
 * in the Architecture and Governance steps, so CI stopped at the first of them
 * and the Contract, Integration and Governance steps never ran at all. Three
 * suites went unexecuted on every push to keep two obligations visible.
 *
 * The gate takes those two out of the failing path and runs them in a step of
 * their own, which **asserts they are still red**. That inversion is the whole
 * design: skipping a check trains people to ignore it, and deleting one throws
 * away the only record that the work is owed. This keeps the record and frees
 * the pipeline.
 *
 * The trap is a gate that cannot fail. Three ways it could pass while proving
 * nothing, each asserted below:
 *
 *   - the listed file is **gone** — renamed or deleted, and the gate would
 *     happily report "still red" about a check that no longer exists;
 *   - the file ran and **collected nothing** — a check that cannot run is not
 *     a check that is red, which is `T632`'s anti-vacuity argument;
 *   - the check **passes** — the evidence landed, and the entry must be retired
 *     so the check returns to the suite that gates merges. A gate that stayed
 *     quiet here would permanently exempt the check: a later malformed record
 *     would never fail CI again, which is exactly what `T884` exists to catch.
 *
 * So the gate exits non-zero on all three. It is designed to retire itself.
 */
import { describe, expect, it } from 'vitest';
import { gateVerdict, manifestProblems } from '../known-red.mjs';

const ENTRY = {
  id: 'T884',
  file: 'tests/governance/accessibility-record.spec.ts',
  project: 'governance',
  gatedScript: 'test:governance:gated',
  evidence: 'docs/accessibility/EPIC-029-manual-pass.md',
  owes: 'T885 — a manual keyboard and screen-reader pass',
  why: 'An agent cannot hear a screen reader.',
};

describe('gateVerdict · the gate holds only while the check is genuinely red', () => {
  it('holds when the check ran and failed — the obligation is still outstanding', () => {
    const verdict = gateVerdict(ENTRY, { fileMissing: false, numTotalTests: 2, numFailedTests: 2 });
    expect(verdict.ok).toBe(true);
    // The owed work is named in the reason, so the CI log says what is missing
    // rather than merely that something is.
    expect(verdict.reason).toContain('T885');
  });

  it('holds when only some of the file failed', () => {
    const verdict = gateVerdict(ENTRY, { fileMissing: false, numTotalTests: 5, numFailedTests: 1 });
    expect(verdict.ok).toBe(true);
  });

  it('BREAKS when the check now passes, and says to retire the entry', () => {
    // The evidence landed. The check must go back into the suite that gates
    // merges; leaving it listed exempts it forever.
    const verdict = gateVerdict(ENTRY, { fileMissing: false, numTotalTests: 2, numFailedTests: 0 });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/passes/i);
    expect(verdict.reason).toMatch(/retire|remove/i);
  });

  it('BREAKS when the file collected no tests — red for the wrong reason', () => {
    // A filter that matches nothing, or a suite that dies in setup, reports no
    // failures and no passes. Treating that as "still red" is the check that
    // cannot fail.
    const verdict = gateVerdict(ENTRY, { fileMissing: false, numTotalTests: 0, numFailedTests: 0 });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/no tests|collected nothing/i);
  });

  it('BREAKS when the listed file does not exist', () => {
    const verdict = gateVerdict(ENTRY, { fileMissing: true, numTotalTests: 0, numFailedTests: 0 });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/does not exist|missing/i);
  });

  it('names the check in every verdict, so a multi-entry run is readable', () => {
    for (const result of [
      { fileMissing: false, numTotalTests: 2, numFailedTests: 2 },
      { fileMissing: false, numTotalTests: 2, numFailedTests: 0 },
      { fileMissing: true, numTotalTests: 0, numFailedTests: 0 },
    ]) {
      expect(gateVerdict(ENTRY, result).reason).toContain('T884');
    }
  });
});

describe('manifestProblems · a malformed manifest is rejected loudly, never skipped', () => {
  it('accepts a well-formed manifest', () => {
    expect(manifestProblems({ checks: [ENTRY] })).toEqual([]);
  });

  it('rejects an empty list — an empty gate should be deleted, not run', () => {
    // `T600`'s lesson: a parser that silently yields nothing leaves every
    // completeness check green while examining an empty set.
    expect(manifestProblems({ checks: [] }).join(' ')).toMatch(/no checks|empty/i);
  });

  it('rejects a manifest that is not a list of checks at all', () => {
    expect(manifestProblems({}).length).toBeGreaterThan(0);
    expect(manifestProblems(null).length).toBeGreaterThan(0);
  });

  it.each(['id', 'file', 'project', 'gatedScript', 'evidence', 'owes'])(
    'rejects an entry missing %s',
    (field) => {
      const entry = { ...ENTRY };
      delete entry[field];
      expect(manifestProblems({ checks: [entry] }).join(' ')).toContain(field);
    },
  );

  it('rejects a duplicated id — two rows for one check hide whichever is wrong', () => {
    expect(manifestProblems({ checks: [ENTRY, { ...ENTRY }] }).join(' ')).toMatch(/duplicate/i);
  });
});
