/**
 * T480 · Check `G-26-05` — an analysis record, wherever one exists, is shaped
 * so the stage derivation and the DOR can read it.
 * Written to FAIL before T486 exists (Constitution V).
 *
 * **`FR-ESK-019`.** The analysis step used to print its findings and leave
 * nothing behind, which would have made `Analyzed` the one stage in the journey
 * with no artifact — a hole in `FR-ESK-003` on the day it was written. The
 * clarification session recorded the reasoning: *"every other stage already
 * leaves an artifact; making this one the sole hand-declared exception would
 * carve a hole in FR-ESK-003."*
 *
 * ## The trap this check has to avoid
 *
 * **Zero `analysis.md` files exist in this repository today.** A check written as
 * "for each analysis.md, assert X" passes vacuously — it would report green
 * while proving nothing, and would keep doing so if `T486` were never finished.
 *
 * So the validator is a **pure function tested against fixtures**, and the
 * corpus pass applies it to whatever is really there. The fixture tests cannot
 * pass vacuously; the corpus pass reports how many records it actually saw.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateAnalysisRecord } from './analysis-record';
import { enumerateEpics } from './derive';

const WELL_FORMED = [
  '# Analysis: Epic Stage Register & Definition of Ready',
  '',
  '**Epic**: `EPIC-026` · **Session**: 2026-08-18',
  '',
  '## Findings',
  '',
  '| ID | Category | Severity | Summary |',
  '|---|---|---|---|',
  '| F1 | Inconsistency | HIGH | counts drifted |',
  '| F2 | Coverage Gap | MEDIUM | SC-ESK-003 untested |',
  '',
].join('\n');

describe('T480 · a well-formed analysis record', () => {
  it('is accepted', () => {
    expect(validateAnalysisRecord(WELL_FORMED).valid).toBe(true);
  });

  it('is accepted when the run found nothing', () => {
    // FR-ESK-017 in one assertion: the artifact records that the step RAN, not
    // that it found something. A record rejected for having no findings would
    // push a clean analysis to write a fake one.
    const clean = [
      '# Analysis: Fixture',
      '',
      '**Epic**: `EPIC-999` · **Session**: 2026-08-18',
      '',
      '## Findings',
      '',
      'No findings.',
      '',
    ].join('\n');
    expect(validateAnalysisRecord(clean).valid).toBe(true);
  });
});

describe('T480 · what is rejected, and why', () => {
  it('rejects a record with no dated session', () => {
    // Without a date, two runs are indistinguishable and nobody can tell
    // whether the analysis predates the spec it analysed.
    const undated = '# Analysis: Fixture\n\n**Epic**: `EPIC-999`\n\n## Findings\n\nNone.\n';
    const result = validateAnalysisRecord(undated);
    expect(result.valid).toBe(false);
    expect(result.problems.join(' ')).toMatch(/session/i);
  });

  it('rejects a record naming no Epic', () => {
    const anonymous = '# Analysis\n\n**Session**: 2026-08-18\n\n## Findings\n\nNone.\n';
    const result = validateAnalysisRecord(anonymous);
    expect(result.valid).toBe(false);
    expect(result.problems.join(' ')).toMatch(/epic/i);
  });

  it('rejects a record with no Findings section at all', () => {
    // "The analysis ran" and "the analysis reported" are the same claim here.
    const headless = '# Analysis: Fixture\n\n**Epic**: `EPIC-999` · **Session**: 2026-08-18\n';
    const result = validateAnalysisRecord(headless);
    expect(result.valid).toBe(false);
    expect(result.problems.join(' ')).toMatch(/findings/i);
  });

  it('rejects a severity outside the vocabulary', () => {
    // The DOR reads severities to decide whether findings are blocking
    // (`DOR-09`). An unrecognised word would be silently treated as
    // non-blocking, which is the wrong default for a word nobody defined.
    const wrong = WELL_FORMED.replace('| F1 | Inconsistency | HIGH |', '| F1 | Inconsistency | SEVERE |');
    const result = validateAnalysisRecord(wrong);
    expect(result.valid).toBe(false);
    expect(result.problems.join(' ')).toMatch(/SEVERE/);
  });

  it('accepts every severity in the vocabulary', () => {
    for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      const text = WELL_FORMED.replace('| HIGH |', `| ${severity} |`);
      expect(validateAnalysisRecord(text).valid, `${severity} was rejected`).toBe(true);
    }
  });
});

describe('T480 · the corpus, and how many records it actually holds', () => {
  it('accepts every analysis.md present in the repository', () => {
    const records = enumerateEpics()
      .map((epic) => ({ epic: epic.id, path: join(epic.path, 'analysis.md') }))
      .filter((record) => existsSync(record.path));

    for (const record of records) {
      const result = validateAnalysisRecord(readFileSync(record.path, 'utf8'));
      expect(result.valid, `${record.epic}: ${result.problems.join('; ')}`).toBe(true);
    }

    // Stated out loud so a vacuous pass cannot masquerade as coverage. Until
    // T486 lands and analyses are re-run, this is legitimately zero — and the
    // number appearing in the output is what keeps that honest.
    console.info(`[G-26-05] validated ${records.length} analysis record(s) across the corpus.`);
  });
});
