/**
 * T905 — `DOR-09` must see a blocking finding whatever its ID looks like
 * (`DEF-026-008`). Written to FAIL before T906 exists (Constitution V).
 *
 * ## What went wrong
 *
 * `DOR-09` counted only rows whose first cell matched `/^\|\s*F\d+\s*\|/`.
 * `/speckit-analyze`, in this same repository, instructs the opposite:
 *
 * > *"generate stable IDs prefixed by **category initial**"*
 *
 * and demonstrates `A1`. Following the command as written produced `D1`, `C1`,
 * `U1`, `O1`, `I1` — none of which the gate matched. EPIC-029's first analysis
 * recorded a **CRITICAL** Constitution V violation as `D1`, and `DOR-09`
 * reported *"analysis recorded, no blocking findings"*.
 *
 * `validateAnalysisRecord` shares the assumption, so those rows were never
 * checked for a valid severity either. Both halves went unenforced together.
 *
 * ## Why the assertions are shaped this way
 *
 * Widening a gate is how a gate becomes advice, so the cases below are written
 * in two halves and the second matters more:
 *
 * 1. a blocking finding is seen **whatever letters its ID starts with**; and
 * 2. **MEDIUM and LOW still do not block**, and prose records still pass —
 *    widening the ID pattern must not turn every finding into a blocker, nor
 *    break the clean-run record `FR-ESK-017` requires.
 *
 * If the second half ever starts failing, the widening went too far.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { join } from 'node:path';
import { evaluateCondition } from './dor';
import { validateAnalysisRecord } from './analysis-record';
import { buildEpicTree, DOR_READY_SPEC, MINIMAL_PLAN, MINIMAL_TASKS, RESOLVED_CHECKLIST, type FixtureTree } from './fixtures';

let tree: FixtureTree | undefined;

afterEach(() => {
  tree?.cleanup();
  tree = undefined;
});

/** An analysis record whose findings table carries exactly these rows. */
function analysisWith(...rows: string[]): string {
  return [
    '# Cross-Artifact Analysis: EPIC-999 Fixture',
    '',
    '**Session**: 2026-08-20',
    '',
    '## Findings',
    '',
    '| ID | Category | Severity | Location(s) | Summary | Recommendation |',
    '|----|----------|----------|-------------|---------|----------------|',
    ...rows,
    '',
  ].join('\n');
}

function dor09(analysis: string): { passed: boolean; detail: string } {
  tree = buildEpicTree({
    '999-fixture': {
      spec: DOR_READY_SPEC,
      plan: MINIMAL_PLAN,
      tasks: MINIMAL_TASKS,
      analysis,
      checklists: { 'requirements.md': RESOLVED_CHECKLIST },
    },
  });
  const result = evaluateCondition('DOR-09', {
    epicPath: join(tree.specsDir, '999-fixture'),
    directory: '999-fixture',
    declarations: {},
  });
  return { passed: result.passed, detail: result.detail };
}

describe('DOR-09 · a blocking finding is blocking whatever its ID looks like (DEF-026-008)', () => {
  // The exact shape that slipped through. `D1` is what /speckit-analyze's own
  // instruction produces for a Duplication finding.
  it('blocks on a category-initial ID carrying CRITICAL — the EPIC-029 case', () => {
    const result = dor09(
      analysisWith('| D1 | Constitution | CRITICAL | tasks.md T866 | changes main.tsx with no paired check | add the check |'),
    );
    expect(result.passed).toBe(false);
  });

  it.each([
    ['A1', 'Duplication', 'HIGH'],
    ['C2', 'Coverage gap', 'HIGH'],
    ['U1', 'Underspecification', 'CRITICAL'],
    ['I1', 'Inconsistency', 'HIGH'],
    ['F4', 'Constitution', 'HIGH'],
  ])('blocks on %s (%s) rated %s', (id, category, severity) => {
    const result = dor09(analysisWith(`| ${id} | ${category} | ${severity} | spec.md | a real problem | fix it |`));
    expect(result.passed).toBe(false);
  });

  it('counts every blocking row, not just the first', () => {
    const result = dor09(
      analysisWith(
        '| D1 | Constitution | CRITICAL | a | one | fix |',
        '| C2 | Coverage gap | HIGH | b | two | fix |',
        '| O1 | Ordering | MEDIUM | c | three | fix |',
      ),
    );
    expect(result.passed).toBe(false);
    expect(result.detail).toContain('2');
  });

  // The half that matters more: widening the ID pattern must not make
  // everything blocking.
  it.each([
    ['O1', 'MEDIUM'],
    ['I1', 'LOW'],
  ])('does NOT block on %s rated %s', (id, severity) => {
    const result = dor09(analysisWith(`| ${id} | Style | ${severity} | spec.md | a nit | tidy it |`));
    expect(result.passed).toBe(true);
  });

  it('still passes a record that found nothing (FR-ESK-017)', () => {
    tree = buildEpicTree({
      '999-fixture': {
        spec: DOR_READY_SPEC,
        plan: MINIMAL_PLAN,
        tasks: MINIMAL_TASKS,
        analysis: ['# Analysis: EPIC-999 Fixture', '', '**Session**: 2026-08-20', '', '## Findings', '', 'No findings.', ''].join('\n'),
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
      },
    });
    const result = evaluateCondition('DOR-09', {
      epicPath: join(tree.specsDir, '999-fixture'),
      directory: '999-fixture',
      declarations: {},
    });
    expect(result.passed).toBe(true);
  });

  // A table header must never be mistaken for a finding: "ID" is letters, and
  // a naive `[A-Za-z]+\d+` widening that forgot to require digits would match
  // stray prose rows.
  it('does not treat the table header or separator as a finding', () => {
    const result = dor09(analysisWith('| O1 | Style | LOW | spec.md | a nit | tidy it |'));
    expect(result.passed).toBe(true);
  });
});

/**
 * The third gap in the same condition, found by the sweep.
 *
 * `DOR-09` matched the severity with `/\|\s*(CRITICAL|HIGH)\s*\|/`, which does
 * not see `| **CRITICAL** |`. EPIC-029's `D1` was written that way, so it was
 * hidden **twice over** — a category-initial ID the row filter missed, and a
 * bolded severity the severity filter missed. Either alone would have sufficed.
 *
 * Emphasis is presentation. A finding is no less critical for being bold.
 */
describe('DOR-09 · severity is read through markdown emphasis (DEF-026-008)', () => {
  it.each([
    ['**CRITICAL**', 'bold'],
    ['*HIGH*', 'italic'],
    ['**HIGH**', 'bold'],
    ['`CRITICAL`', 'code'],
  ])('blocks on %s (%s)', (severity) => {
    const result = dor09(analysisWith(`| D1 | Constitution | ${severity} | spec.md | a real problem | fix it |`));
    expect(result.passed).toBe(false);
    // Assert WHY. Before the fix these passed for the wrong reason: an
    // emphasised severity was out-of-vocabulary, so the record was rejected as
    // malformed and DOR-09 failed on that instead of on the finding. A test
    // that cannot tell those apart is not testing this.
    expect(result.detail).toContain('blocking finding');
    expect(result.detail).not.toContain('malformed');
  });

  it('does not block on a bolded MEDIUM', () => {
    const result = dor09(analysisWith('| O1 | Style | **MEDIUM** | spec.md | a nit | tidy it |'));
    expect(result.passed).toBe(true);
  });

  it('accepts an emphasised severity as in-vocabulary', () => {
    const validation = validateAnalysisRecord(
      analysisWith('| D1 | Constitution | **CRITICAL** | tasks.md | something | fix it |'),
    );
    expect(validation.valid).toBe(true);
  });
});

/**
 * The second half of `DEF-026-008`, found by the sweep the fix required.
 *
 * Widening the ID pattern turned "the gate never fires" into "the gate fires
 * forever on history": a record that keeps its remediated findings in table
 * form blocks its Epic permanently. EPIC-026 — delivered and closed on
 * 2026-08-18 — flipped to `Not ready` on two findings resolved that same day.
 *
 * So a row needs a way to say it is closed, and `✅` after the ID says it.
 * Declared here rather than left to each author, because an undeclared prose
 * convention is the cause behind all nine defects in this Epic (`D-43`).
 */
describe('DOR-09 · a resolved finding does not block (DEF-026-008)', () => {
  it('does not block on a CRITICAL finding marked resolved', () => {
    const result = dor09(
      analysisWith('| D1 ✅ | Constitution | CRITICAL | tasks.md | fixed the day it was found | T866a added |'),
    );
    expect(result.passed).toBe(true);
  });

  it('still blocks when one row is resolved and another is not', () => {
    const result = dor09(
      analysisWith(
        '| R1 ✅ | Inconsistency | HIGH | a | closed | done |',
        '| R2 | Coverage gap | HIGH | b | still open | do it |',
      ),
    );
    expect(result.passed).toBe(false);
    expect(result.detail).toContain('1');
  });

  it('validates the severity vocabulary on a resolved row too — it is still a finding', () => {
    const validation = validateAnalysisRecord(
      analysisWith('| D1 ✅ | Constitution | BLOCKER | tasks.md | something | fixed |'),
    );
    expect(validation.valid).toBe(false);
  });
});

/**
 * The fourth gap, caught by the regression the widening caused rather than by
 * reading — which is the honest way to record how it was found.
 *
 * Records carry **remediation** tables as well as findings tables, and they
 * reuse the same identifiers with different columns:
 *
 *     | B1 | ✅ Closed | T823, T824 and T825 added; T347 repointed |
 *
 * Column 3 is prose there. Once the row filter matched any letter prefix it
 * reached those rows too, and EPIC-023's seven remediation entries were
 * reported as seven invalid severities. An identifier shape is not a table
 * identity (`D-43`).
 */
describe('DOR-09 · only the findings table is a findings table (DEF-026-008)', () => {
  const withRemediation = [
    '# Cross-Artifact Analysis: EPIC-999 Fixture',
    '',
    '**Session**: 2026-08-20',
    '',
    '## Findings',
    '',
    '| ID | Category | Severity | Location | Summary | Recommendation |',
    '|----|----------|----------|----------|---------|----------------|',
    '| B1 | Style | LOW | spec.md | a nit | tidy it |',
    '',
    '## Remediation — 2026-08-19',
    '',
    '| ID | Status | Applied |',
    '|----|--------|---------|',
    '| B1 | ✅ Closed | `T823` and `T824` added; `T347` repointed |',
    '| B2 | ✅ Closed | the spec header task count removed rather than corrected |',
    '',
  ].join('\n');

  it('does not read a remediation row as a finding with an invalid severity', () => {
    expect(validateAnalysisRecord(withRemediation).valid).toBe(true);
  });

  it('does not let a remediation row block readiness', () => {
    tree = buildEpicTree({
      '999-fixture': {
        spec: DOR_READY_SPEC,
        plan: MINIMAL_PLAN,
        tasks: MINIMAL_TASKS,
        analysis: withRemediation,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
      },
    });
    const result = evaluateCondition('DOR-09', {
      epicPath: join(tree.specsDir, '999-fixture'),
      directory: '999-fixture',
      declarations: {},
    });
    expect(result.passed).toBe(true);
  });

  it('still sees a blocking finding in the findings table above it', () => {
    const blocking = withRemediation.replace(
      '| B1 | Style | LOW | spec.md | a nit | tidy it |',
      '| B1 | Coverage gap | HIGH | spec.md | a real problem | fix it |',
    );
    tree = buildEpicTree({
      '999-fixture': {
        spec: DOR_READY_SPEC,
        plan: MINIMAL_PLAN,
        tasks: MINIMAL_TASKS,
        analysis: blocking,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
      },
    });
    const result = evaluateCondition('DOR-09', {
      epicPath: join(tree.specsDir, '999-fixture'),
      directory: '999-fixture',
      declarations: {},
    });
    expect(result.passed).toBe(false);
  });
});

describe('validateAnalysisRecord · severity vocabulary reaches the same rows (DEF-026-008)', () => {
  it('rejects an out-of-vocabulary severity on a category-initial ID', () => {
    const validation = validateAnalysisRecord(
      analysisWith('| D1 | Constitution | BLOCKER | tasks.md | something | fix it |'),
    );
    expect(validation.valid).toBe(false);
    expect(validation.problems.join(' ')).toContain('BLOCKER');
  });

  it('accepts a valid severity on a category-initial ID', () => {
    const validation = validateAnalysisRecord(
      analysisWith('| D1 | Constitution | CRITICAL | tasks.md | something | fix it |'),
    );
    expect(validation.valid).toBe(true);
  });
});
