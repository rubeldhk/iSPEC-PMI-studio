/**
 * T486 — validating an analysis record (`FR-ESK-019`).
 *
 * A pure function, so `T480` can test the rules against fixtures rather than
 * against whatever records happen to exist. Zero `analysis.md` files exist in
 * this repository today, and a check written as "for each record, assert X"
 * would pass vacuously — reporting green while proving nothing, and continuing
 * to do so if the recording instruction were never followed.
 *
 * Not a `.spec.ts`, so vitest never collects it.
 */

/**
 * The severities the DOR reads.
 *
 * `DOR-09` requires *zero blocking findings*, so it has to distinguish blocking
 * from non-blocking. An unrecognised word would be silently treated as
 * non-blocking, and "silently non-blocking" is the wrong default for a word
 * nobody defined.
 */
export const ANALYSIS_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

/**
 * A findings-table row: first cell is an identifier of one or more letters
 * followed by digits — `F1`, `A1`, `D1`, `C2`, `US3`.
 *
 * `DEF-026-008` — this was `F\d+`, matching only one of the two ID conventions
 * this repository actually uses. `/speckit-analyze` instructs authors to
 * "generate stable IDs prefixed by category initial" and demonstrates `A1`, so
 * a record written to the command's own template was invisible to the gate
 * reading it: EPIC-029's CRITICAL `D1` was reported as no blocking findings.
 *
 * Exported and shared with `DOR-09` deliberately. The producer/consumer split
 * is the recurring cause behind nine defects in this Epic (`D-43`); two
 * consumers of one table should not each carry their own idea of its shape.
 *
 * Digits are REQUIRED, so a header row (`| ID | Category | ...`) is not a
 * finding.
 *
 * A trailing `✅` marks the finding RESOLVED — see {@link RESOLVED_FINDING}. It
 * matches here too: a resolved finding is still a finding, and its severity is
 * still validated.
 */
export const FINDING_ROW = /^\|\s*[A-Za-z]+\d+\s*✅?\s*\|/;

/**
 * A findings row marked resolved — `| D1 ✅ | …`.
 *
 * `DEF-026-008`, second half. Widening {@link FINDING_ROW} turned "the gate
 * never fires" into "the gate fires forever on history": a record that keeps
 * its remediated findings in table form would block its Epic permanently.
 * EPIC-026 — delivered and closed 2026-08-18 — flipped to `Not ready` on two
 * findings resolved that same day.
 *
 * `DOR-09` needs to distinguish open from closed, and had no way to. The marker
 * is declared **here**, once, rather than left to each author to invent: an
 * undeclared prose convention is the cause behind all nine defects in this Epic
 * (`D-43`).
 *
 * Note this is a real convention, not a regex accident. Before it existed,
 * `| D1 ✅ |` happened not to match `FINDING_ROW` — so resolved rows were
 * skipped for the right outcome by the wrong mechanism, and their severities
 * went unvalidated as a side effect.
 */
export const RESOLVED_FINDING = /^\|\s*[A-Za-z]+\d+\s*✅/;

/**
 * The severity a findings row declares, read through markdown emphasis, or
 * `null` if the row is not a finding.
 *
 * `DEF-026-008`, third gap. `DOR-09` matched severity with
 * `/\|\s*(CRITICAL|HIGH)\s*\|/`, which does not see `| **CRITICAL** |` — and
 * `validateAnalysisRecord` compared the raw cell against the vocabulary, so an
 * emphasised severity was *also* reported as out-of-vocabulary. EPIC-029's `D1`
 * was hidden twice over: a category-initial ID the row filter missed, and a
 * bolded severity this filter missed. Either alone would have sufficed.
 *
 * Emphasis is presentation. A finding is no less critical for being bold, and
 * authors bold the severities that matter — so the formatting most likely to
 * appear on a CRITICAL was exactly the formatting that hid it.
 *
 * Shared by both consumers on purpose: two readers of one cell should not each
 * carry their own idea of what it says (`D-43`).
 */
export function findingSeverity(row: string): string | null {
  if (!FINDING_ROW.test(row)) return null;
  const cells = row.split('|').map((cell) => cell.trim());
  const raw = cells[3] ?? '';
  // Strip bold, italic and code emphasis; keep the word.
  return raw.replace(/[*_`]/g, '').trim();
}

/**
 * The rows of the findings table, and only those.
 *
 * `DEF-026-008`, fourth gap — found by the regression the widening caused
 * rather than by reading. Records also carry **remediation** tables, and those
 * reuse the same identifiers with different columns:
 *
 *     | B1 | ✅ Closed | T823, T824 and T825 added; T347 repointed |
 *
 * Column 3 there is prose. Once {@link FINDING_ROW} matched any letter prefix
 * it reached those rows too, and EPIC-023's seven remediation entries were
 * reported as seven invalid severities.
 *
 * Scoping to the section is the same fix `DOR-06` needed for the Constitution
 * Check table, and for the same reason: **an identifier shape is not a table
 * identity.** Position-based parsing of prose cannot tell two tables apart when
 * their first columns agree — which is the whole of `D-43`.
 */
export function findingRows(content: string): string[] {
  const rows: string[] = [];
  let inFindings = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^#{2,3}\s/.test(line)) {
      inFindings = /findings/i.test(line);
      continue;
    }
    if (inFindings && FINDING_ROW.test(line)) rows.push(line);
  }
  return rows;
}

export interface AnalysisValidation {
  readonly valid: boolean;
  readonly problems: string[];
}

export function validateAnalysisRecord(content: string): AnalysisValidation {
  const problems: string[] = [];

  if (!/\bEPIC-\d{3}\b/.test(content)) {
    problems.push('names no Epic — the record cannot be attributed');
  }

  if (!/\b\d{4}-\d{2}-\d{2}\b/.test(content) || !/session/i.test(content)) {
    // Without a dated session two runs are indistinguishable, and nobody can
    // tell whether the analysis predates the spec it analysed.
    problems.push('records no dated session');
  }

  if (!/^##\s+Findings\s*$/m.test(content)) {
    problems.push('has no Findings section');
  }

  // Severity vocabulary, checked only where a findings TABLE is present. A run
  // that found nothing writes prose, and rejecting that would push a clean
  // analysis to invent a finding (`FR-ESK-017`).
  for (const row of findingRows(content)) {
    const severity = findingSeverity(row);
    if (severity === null) continue;
    if (!(ANALYSIS_SEVERITIES as readonly string[]).includes(severity)) {
      problems.push(
        `severity "${severity}" is outside the vocabulary (${ANALYSIS_SEVERITIES.join(', ')})`,
      );
    }
  }

  return { valid: problems.length === 0, problems };
}
