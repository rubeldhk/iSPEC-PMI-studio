/**
 * T327 · Check G-06 — every repository template is measured against PMI-DOC-000 §4, and
 * every absent section carries a recorded reason.
 * T330 / T331 · The document-structure and traceability conventions exist and are checkable.
 *
 * Satisfies SC-RGP-006 and SC-RGP-008. A deviation without a reason is a defect, not a
 * deviation — the whole value of the record is that it makes decision D-4 answerable.
 *
 * Note what this does NOT assert: that the templates *have* the thirteen sections. Per
 * R-018-5 and D-16 this epic produces the record, not the migration.
 */
import { describe, it, expect } from 'vitest';
import { readConfig, read, repoExists } from './helpers';

const config = readConfig();
const record = read('governance/template-conformance.md');

/** Parse | Section | spec | plan | tasks | checklist | rows into a per-template verdict map. */
function verdicts(): Map<string, Map<string, string>> {
  const table = record.split('## Conformance against `PMI-DOC-000` §4')[1]?.split('\n## ')[0] ?? '';
  const rows = table
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))
    .map((line) => line.split('|').map((cell) => cell.trim()));
  const header = rows.find((cells) => cells.some((cell) => cell.includes('spec-template')));
  const result = new Map<string, Map<string, string>>();
  if (!header) return result;
  const templateColumns = header
    .map((cell, index) => ({ cell, index }))
    .filter((entry) => entry.cell.includes('-template.md'));
  for (const cells of rows) {
    const section = cells[1]?.replace(/\*\*/g, '').trim();
    if (!section || !config.pmiDoc000Sections.includes(section)) continue;
    const perTemplate = new Map<string, string>();
    for (const column of templateColumns) {
      perTemplate.set(/`([^`]+)`/.exec(column.cell)?.[1] ?? column.cell, cells[column.index] ?? '');
    }
    result.set(section, perTemplate);
  }
  return result;
}

const parsed = verdicts();

describe('G-06 · template conformance record (FR-RGP-010, FR-RGP-011)', () => {
  it('exists and names the governing standard', () => {
    expect(record).toContain('PMI-DOC-000');
    expect(record).toMatch(/\bD-16\b/);
  });

  it.each(config.templates)('measures %s', (template) => {
    expect(repoExists(template), `${template} is recorded but absent from the repository`).toBe(true);
    expect(record, `${template} is not measured in the conformance record`).toContain(
      template.split('/').pop() as string,
    );
  });

  it.each(config.pmiDoc000Sections)('records a verdict for the "%s" section', (section) => {
    expect(parsed.has(section), `no row for PMI-DOC-000 §4 section "${section}"`).toBe(true);
  });

  it('records a reason for every absence', () => {
    const unreasoned: string[] = [];
    for (const [section, perTemplate] of parsed) {
      for (const [template, verdict] of perTemplate) {
        const absent = /absent|✗|❌|no\b/i.test(verdict) && !/present/i.test(verdict);
        const hasReason = /—|D-\d+|see /i.test(verdict);
        if (absent && !hasReason) unreasoned.push(`${template} · ${section}`);
      }
    }
    expect(unreasoned, 'an absence without a reason is a defect, not a deviation').toEqual([]);
  });

  it('leaves decision D-4 open rather than settling it', () => {
    expect(record).toMatch(/\bD-4\b/);
    expect(record).toMatch(/open|unsettled|does not settle|remains/i);
  });
});

describe('G-06b · document structure convention (FR-RGP-012)', () => {
  const structure = read('governance/document-structure.md');

  it('defines the structure for plans and task documents', () => {
    expect(structure).toMatch(/plan/i);
    expect(structure).toMatch(/task/i);
  });

  it('states required sections as an enumerable list', () => {
    const required = structure.split('## Required sections')[1]?.split('\n## ')[0] ?? '';
    expect(required.split(/\r?\n/).filter((line) => line.trim().startsWith('|')).length).toBeGreaterThan(3);
  });

  it('links to the governing standard rather than restating it', () => {
    expect(structure).toContain('PMI-DOC-000');
    expect(structure).toContain('template-conformance.md');
  });
});

describe('G-06c · traceability convention (FR-RGP-013, SC-RGP-008)', () => {
  const traceability = read('governance/traceability-convention.md');

  it('states link rules as a table with a required column', () => {
    const rules = traceability.split('## Link rules')[1]?.split('\n## ')[0] ?? '';
    const rows = rules.split(/\r?\n/).filter((line) => line.trim().startsWith('|') && line.includes('→'));
    expect(rows.length, 'no link rules are stated').toBeGreaterThanOrEqual(4);
    for (const row of rows) {
      expect(row, `link rule states no obligation: ${row.trim()}`).toMatch(/\b(mandatory|optional)\b/i);
    }
  });

  it('declares cross-epic links explicitly', () => {
    expect(traceability).toMatch(/cross-epic/i);
  });

  it('records that the full chain awaits decision D-2', () => {
    expect(traceability).toMatch(/\bD-2\b/);
  });
});
