/**
 * T589 · Check G-28-02 — every `preserved-elements.md` row carries all five
 * Native §28 fields, non-empty.
 *
 * `FR-AMD-015`: a proposed change to one of the sixteen preserved elements must
 * record the reason, the affected requirement or decision, the migration
 * impact, the compatibility impact, and the alternative considered.
 *
 * **Why five fields and not a prose paragraph.** Native §28 exists to stop an
 * evolutionary amendment quietly becoming a rewrite. Prose lets a change be
 * described without being weighed — the migration cost and the rejected
 * alternative are exactly the two a motivated author omits, and they are the two
 * that decide whether the change was worth it. A row with an empty field is a
 * change nobody weighed.
 *
 * This check reads the artifact and fails when it drifts, which is what makes
 * Constitution V satisfiable for a documentation output (constitution v1.2.0).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const RECORD = join(ROOT, 'specs/028-agent-execution-seam/preserved-elements.md');

/** The five fields Native §28 requires of every change. */
const REQUIRED_FIELDS = [
  'Change',
  'Reason',
  'Affected requirement / decision',
  'Migration impact',
  'Compatibility impact',
  'Alternative considered',
];

interface Row {
  readonly element: string;
  readonly fields: Map<string, string>;
}

function parse(content: string): Row[] {
  const rows: Row[] = [];
  // Each element is a `## PE-nn · <name>` section followed by a two-column table.
  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const heading = section.split(/\r?\n/)[0]?.trim() ?? '';
    if (!/^PE-\d+/.test(heading)) continue;

    const fields = new Map<string, string>();
    for (const line of section.split(/\r?\n/)) {
      if (!line.trim().startsWith('|')) continue;
      const cells = line.split('|').map((c) => c.trim());
      const key = (cells[1] ?? '').replace(/\*\*/g, '').trim();
      const value = (cells[2] ?? '').trim();
      if (key && key !== 'Field' && !/^-+$/.test(key)) fields.set(key, value);
    }
    rows.push({ element: heading, fields });
  }
  return rows;
}

const present = existsSync(RECORD);
const rows = present ? parse(readFileSync(RECORD, 'utf8')) : [];

describe('G-28-02 · preserved-elements record (FR-AMD-015, Native §28)', () => {
  it('exists', () => {
    expect(present, `${RECORD} is missing; T588 produces it`).toBe(true);
  });

  it('records at least one element', () => {
    // An epic that touched a preserved element and recorded none has not
    // discharged FR-AMD-015 — it has produced an empty document.
    expect(rows.length, 'no PE-nn rows found').toBeGreaterThan(0);
  });

  it.each(REQUIRED_FIELDS)('every row carries a "%s" field', (field) => {
    const missing = rows.filter((r) => !r.fields.has(field)).map((r) => r.element);
    expect(missing, `these rows omit "${field}" entirely`).toEqual([]);
  });

  it('no field is empty', () => {
    // The failure mode this check exists for: a table with the right headings
    // and nothing under two of them reads as complete at a glance.
    const empty: string[] = [];
    for (const row of rows) {
      for (const field of REQUIRED_FIELDS) {
        const value = row.fields.get(field);
        if (value !== undefined && value.replace(/\*\*/g, '').trim().length < 3) {
          empty.push(`${row.element} · ${field}`);
        }
      }
    }
    expect(empty, 'a change recorded without its consequences is a change nobody weighed').toEqual(
      [],
    );
  });

  it('names an alternative that was actually rejected, not "none"', () => {
    // "No alternative was considered" is a statement about the process, not
    // about the design, and Native §28 asks for the design one.
    const hollow = rows
      .filter((r) => /^(none|n\/a|not applicable)\b/i.test(r.fields.get('Alternative considered') ?? ''))
      .map((r) => r.element);
    expect(hollow, 'every preserved-element change has an alternative; naming it is the point').toEqual(
      [],
    );
  });
});
