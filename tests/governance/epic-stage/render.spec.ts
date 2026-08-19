/**
 * T478 — register rendering.
 * Written to FAIL before T482 exists (Constitution V).
 *
 * **`RF-2` is the rule everything here serves.** The register is generated *and*
 * committed, so it is read as a **diff** far more often than as a document. Two
 * consequences, both counter-intuitive until you have seen the diff:
 *
 * - **No timestamps.** A generation date makes every rebuild a change, and a
 *   reviewer stops reading the diff by the third one.
 * - **No totals or percentages.** A roll-up count means one Epic advancing
 *   rewrites a line about a different Epic. The register would report movement
 *   where none happened.
 *
 * And `RF-3`: one line per row. A wrapped row turns a one-Epic change into a
 * multi-line diff, which is the same failure wearing a different hat.
 */
import { describe, expect, it } from 'vitest';
import { renderRegister, type Finding, type StageRow, type Waiver } from './render';

const ROWS: StageRow[] = [
  {
    epic: 'EPIC-001',
    directory: '001-platform-foundation',
    title: 'Platform Foundation',
    kind: 'delivery',
    stage: 'Tasked',
    posture: null,
    readiness: 'Not ready',
    next: '/speckit-analyze',
  },
  {
    epic: 'EPIC-002',
    directory: '002-team-review-access-storage',
    title: 'Team Review, Access Control & External Storage',
    kind: 'parent-design',
    stage: 'Planned',
    posture: null,
    readiness: 'n/a',
    next: null,
  },
  {
    epic: 'EPIC-009',
    directory: '009-spec-lifecycle-versioning',
    title: 'Specification Lifecycle & Versioning',
    kind: 'delivery',
    stage: 'Tasked',
    posture: 'Held — awaiting `PMI-DOC-004`',
    readiness: 'Not ready',
    next: null,
  },
];

function render(rows: StageRow[] = ROWS, findings: Finding[] = [], waivers: Waiver[] = []): string {
  return renderRegister(rows, findings, waivers);
}

describe('T478 · RF-1 · the file says it is generated', () => {
  it('carries the do-not-edit header naming the rebuild command', () => {
    const text = render();
    expect(text).toContain('# Epic Stage Register');
    expect(text).toContain('**Generated — do not edit.**');
    // Naming the command is the difference between a warning and an
    // instruction. A reader who wants to change a row needs to know how.
    expect(text).toContain('pnpm register:update');
  });

  it('links back to the Epic that governs it', () => {
    expect(render()).toContain('specs/026-epic-stage-kanban/');
  });
});

describe('T478 · RF-2 · determinism', () => {
  it('produces byte-identical output for identical input', () => {
    expect(render()).toBe(render());
  });

  it('carries no date, timestamp or year', () => {
    // The single most common way a generated file becomes unreviewable.
    const text = render();
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).not.toMatch(/\b20\d{2}\b/);
    expect(text).not.toMatch(/generated (?:at|on)\b/i);
  });

  it('carries no totals, counts or percentages', () => {
    // A roll-up means one Epic's change rewrites a line about another Epic,
    // reporting movement that did not happen.
    const text = render();
    expect(text).not.toMatch(/\b\d+\s*%/);
    expect(text).not.toMatch(/\btotal\b/i);
    expect(text).not.toMatch(/\b\d+\s+of\s+\d+\b/);
  });

  it('orders rows by Epic identifier ascending regardless of input order', () => {
    // Filesystem order differs between machines; a register that inherited it
    // would fail the drift check on somebody else's checkout.
    const shuffled = [ROWS[2]!, ROWS[0]!, ROWS[1]!];
    const order = [...render(shuffled).matchAll(/\| \[(EPIC-\d{3})\]/g)].map((m) => m[1]);
    expect(order).toEqual(['EPIC-001', 'EPIC-002', 'EPIC-009']);
  });
});

describe('T478 · RF-3 · one row per Epic, one line per row', () => {
  it('emits the seven columns in the contracted order', () => {
    expect(render()).toContain('| Epic | Title | Kind | Stage | Posture | Readiness | Next |');
  });

  it('emits exactly one line per Epic', () => {
    const lines = render().split('\n').filter((line) => /^\| \[EPIC-\d{3}\]/.test(line));
    expect(lines).toHaveLength(ROWS.length);
  });

  it('never wraps a row', () => {
    // A wrapped row turns a one-Epic change into a multi-line diff.
    for (const line of render().split('\n')) {
      if (!/^\| \[EPIC-/.test(line)) continue;
      expect(line.endsWith('|'), `row does not terminate on its own line: ${line}`).toBe(true);
    }
  });

  it('links each Epic to its directory, relative from governance/', () => {
    expect(render()).toContain('[EPIC-001](../specs/001-platform-foundation/)');
  });

  it('uses the em dash as the SOLE empty marker', () => {
    // Never blank, never N/A, never null — one marker means a reader learns it
    // once. `n/a` for a parent design's readiness is a value, not an absence.
    const text = render();
    expect(text).toMatch(/\| — \|/);
    expect(text).not.toMatch(/\|\s{2,}\|/);
    expect(text).not.toContain('N/A');
    expect(text).not.toContain('null');
    expect(text).not.toContain('undefined');
  });

  it('renders the next command in backticks, and a terminal stage as an em dash', () => {
    const text = render();
    expect(text).toContain('`/speckit-analyze`');
    // EPIC-002 is a parent design at its terminal stage: nothing comes next.
    expect(text).toMatch(/\| parent-design \| Planned \| — \| n\/a \| — \|/);
  });

  it('renders a posture as "Kind — object", and none as an em dash', () => {
    const text = render();
    expect(text).toContain('Held — awaiting `PMI-DOC-004`');
    // EPIC-001 declares no posture, so its Posture cell is the em dash.
    const row = text.split('\n').find((line) => line.startsWith('| [EPIC-001]')) ?? '';
    expect(row.split('|').map((c) => c.trim())[5]).toBe('—');
  });

  it('never leaves a Stage cell blank', () => {
    // `FR-ESK-003` / `SC-ESK-003`: exactly one stage per Epic, always.
    for (const line of render().split('\n')) {
      if (!/^\| \[EPIC-/.test(line)) continue;
      const cells = line.split('|').map((cell) => cell.trim());
      expect(cells[4], `blank Stage in: ${line}`).toBeTruthy();
    }
  });
});

describe('T478 · RF-6 · nothing that is not derived', () => {
  it('carries no narrative, build order, module mapping or task count', () => {
    // The PP-002 defence. That content belongs to `specs/README.md`, which is
    // authored; the register can only contain what the generator produces.
    const text = render();
    expect(text).not.toMatch(/build order/i);
    expect(text).not.toMatch(/\bM-\d\d\b/);
    expect(text).not.toMatch(/\btasks?\b/i);
    expect(text).not.toMatch(/\bmodule\b/i);
  });
});
