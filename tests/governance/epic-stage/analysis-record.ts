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
  for (const row of content.split(/\r?\n/)) {
    if (!/^\|\s*F\d+\s*\|/.test(row)) continue;
    const cells = row.split('|').map((cell) => cell.trim());
    const severity = cells[3] ?? '';
    if (!(ANALYSIS_SEVERITIES as readonly string[]).includes(severity)) {
      problems.push(
        `severity "${severity}" is outside the vocabulary (${ANALYSIS_SEVERITIES.join(', ')})`,
      );
    }
  }

  return { valid: problems.length === 0, problems };
}
