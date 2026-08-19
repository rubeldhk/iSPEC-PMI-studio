/**
 * T622 · Check `G-27-06` — the §18 impact report exists in the form specified.
 *
 * Plan Amendment §18 names **twenty-five** sections and requires the report to
 * end with a proposed implementation sequence. `FR-AMD-009` adds the rule that
 * makes it honest: *"A section with nothing to report MUST say so with the
 * reason rather than be omitted."*
 *
 * That rule is why this check counts sections rather than measuring length. A
 * twenty-five section report where six sections are one line of "N/A" is
 * complete; a nineteen-section report is not, however long the nineteen are.
 *
 * The placeholder assertion is the other half. A report containing "TBD" is a
 * report that was outlined and not written, and it would otherwise pass a
 * section count perfectly.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './helpers';

const REPORT = join(REPO_ROOT, 'specs/027-ai-native-amendment/impact-report.md');
const PROJECTION = join(REPO_ROOT, 'specs/027-ai-native-amendment/register/register.json');

const EXPECTED_SECTIONS = 25;

const present = existsSync(REPORT);
const report = present ? readFileSync(REPORT, 'utf8') : '';

const projection = existsSync(PROJECTION)
  ? (JSON.parse(readFileSync(PROJECTION, 'utf8')) as {
      impact_report: { sections: number; empty_with_reason: string[]; placeholders: number };
    })
  : { impact_report: { sections: 0, empty_with_reason: [], placeholders: 0 } };

/** `## 1. Executive summary` … `## 25. Open decisions` */
const sectionHeadings = [...report.matchAll(/^## (\d+)\.\s+(.+)$/gm)].map((m) => ({
  number: Number(m[1]),
  title: String(m[2]).trim(),
}));

describe('G-27-06 · the report exists with all 25 sections (SC-AMD-006)', () => {
  it('impact-report.md exists', () => {
    expect(present, 'specs/027-ai-native-amendment/impact-report.md is missing').toBe(true);
  });

  it(`declares exactly ${EXPECTED_SECTIONS} numbered sections`, () => {
    expect(
      sectionHeadings.length,
      `Plan Amendment §18 names ${EXPECTED_SECTIONS} sections; the report has ${sectionHeadings.length}`,
    ).toBe(EXPECTED_SECTIONS);
  });

  it('numbers them 1 to 25 with none missing or repeated', () => {
    // A report with two §12s and no §13 counts to 25 and is still wrong.
    expect(sectionHeadings.map((s) => s.number)).toEqual(
      Array.from({ length: EXPECTED_SECTIONS }, (_, i) => i + 1),
    );
  });

  it('every section has a title', () => {
    const untitled = sectionHeadings.filter((s) => s.title.length < 3).map((s) => s.number);
    expect(untitled).toEqual([]);
  });

  it('no section is empty — each carries content or an explicit statement of why not', () => {
    // FR-AMD-009: a section with nothing to report says so with the reason.
    // Silence and "nothing to report" look identical in a table of contents and
    // are completely different claims.
    const bodies = report.split(/^## \d+\.\s+.+$/gm).slice(1);
    const thin: number[] = [];
    bodies.forEach((body, i) => {
      if (body.replace(/\s+/g, ' ').trim().length < 80) thin.push(i + 1);
    });
    expect(
      thin,
      'these sections are empty; §18 requires a reason rather than an omission',
    ).toEqual([]);
  });
});

describe('G-27-06 · zero placeholders', () => {
  it('contains no TBD, TODO or [NEEDS marker', () => {
    // A report that was outlined and not written passes a section count
    // perfectly, which is exactly why this assertion exists beside it.
    const markers = [...report.matchAll(/\bTBD\b|\bTODO\b|\[NEEDS[^\]]*\]/g)].map((m) => m[0]);
    expect(markers.slice(0, 10), 'the report contains placeholders').toEqual([]);
  });

  it('the projection agrees with the file', () => {
    // The projection is what the closure report will quote. If it disagrees
    // with the document, one of them is lying and nobody would know which.
    expect(projection.impact_report.sections).toBe(sectionHeadings.length);
    expect(projection.impact_report.placeholders).toBe(0);
  });
});

describe('G-27-06 · the report ends in a sequence (FR-AMD-011)', () => {
  it('separates immediate, near-term and later work', () => {
    // §17.11's three bands. A report that ends without them hands the reader an
    // inventory instead of a plan.
    expect(report).toMatch(/immediate/i);
    expect(report).toMatch(/near-term/i);
    expect(report).toMatch(/later/i);
  });

  it('names the open decisions section last, per §18.25', () => {
    const last = sectionHeadings[sectionHeadings.length - 1];
    expect(last?.number).toBe(25);
    expect(last?.title.toLowerCase()).toMatch(/open decision/);
  });

  it('cites the register rather than restating it (PP-002)', () => {
    // The report summarises; the register is authoritative. A report that
    // restates 599 verdicts creates a second answer that will drift.
    expect(report).toMatch(/register\//);
  });
});
