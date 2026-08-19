/**
 * T477 / T483 · Check `G-26-03` — the committed register, and the entry point
 * that rebuilds it.
 * Written to FAIL before T482 and T485 exist (Constitution V).
 *
 * **This file is both the check and the generator** (`R-026-5`). Under
 * `UPDATE_REGISTER=1` — set by `pnpm register:update` — it writes the register
 * instead of comparing it. One code path produces the file and verifies it,
 * so the two can never disagree about what a correct register looks like.
 *
 * A separate generator script would be a second implementation of the format,
 * and the first divergence between them would surface as a drift failure nobody
 * could explain.
 *
 * `RF-7`: comparison is **exact text**, after normalising line endings only. No
 * fuzzy matching. A generated file that tolerates near-misses drifts, and the
 * drift check is the only thing standing between a committed register and the
 * hand-maintained status this epic exists to replace.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../helpers';
import { buildRegister } from './build';
import { enumerateEpics } from './derive';

const REGISTER_PATH = join(REPO_ROOT, 'governance/epic-stage-register.md');
const UPDATING = process.env['UPDATE_REGISTER'] === '1';

/** Line endings only — see `RF-7`. Nothing else is normalised. */
function normalise(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

const generated = buildRegister();

if (UPDATING) {
  writeFileSync(REGISTER_PATH, generated, 'utf8');
  console.info('[G-26-03] UPDATE_REGISTER=1 — register rewritten from the repository.');
}

const committed = existsSync(REGISTER_PATH) ? normalise(readFileSync(REGISTER_PATH, 'utf8')) : '';

describe('G-26-03 · the committed register (FR-ESK-007, FR-ESK-021)', () => {
  it('exists', () => {
    expect(
      existsSync(REGISTER_PATH),
      'governance/epic-stage-register.md is absent — run `pnpm register:update`',
    ).toBe(true);
  });

  it('carries the generated-do-not-edit header naming the rebuild command (RF-1)', () => {
    expect(committed).toContain('**Generated — do not edit.**');
    expect(committed).toContain('pnpm register:update');
  });

  it('lists exactly one row per Epic directory (FR-ESK-008)', () => {
    // No registration step: an Epic appears because its directory matches the
    // pattern. A count mismatch means either a new Epic nobody regenerated for,
    // or a row for a directory that no longer exists.
    const rows = committed.split('\n').filter((line) => /^\| \[EPIC-\d{3}\]/.test(line));
    const epics = enumerateEpics();
    expect(rows).toHaveLength(epics.length);
  });

  it('names every Epic on disk, and no Epic that is not', () => {
    const listed = [...committed.matchAll(/^\| \[(EPIC-\d{3})\]/gm)].map((match) => match[1]);
    const actual = enumerateEpics().map((epic) => epic.id);
    expect(listed).toEqual(actual);
  });

  it('orders rows by Epic identifier ascending (RF-2)', () => {
    const listed = [...committed.matchAll(/^\| \[(EPIC-\d{3})\]/gm)].map((match) => match[1]);
    expect(listed).toEqual([...listed].sort());
  });

  it('excludes _shared and any non-Epic directory (FR-ESK-008)', () => {
    expect(committed).not.toContain('_shared');
  });

  it('includes EPIC-026 itself', () => {
    // Self-inclusion is deliberate: the register is not a special case in its
    // own output. The alternative is a document with a footnote explaining why
    // one row is missing.
    expect(committed).toContain('[EPIC-026]');
  });

  it('gives every row a stage — no Epic is unstaged (SC-ESK-003)', () => {
    for (const line of committed.split('\n')) {
      if (!/^\| \[EPIC-/.test(line)) continue;
      const cells = line.split('|').map((cell) => cell.trim());
      expect(cells[4], `blank Stage in: ${line}`).toBeTruthy();
      expect(cells[4], `em dash Stage in: ${line}`).not.toBe('—');
    }
  });

  it('agrees byte-for-byte with a fresh generation (RF-7, FR-ESK-021)', () => {
    // The assertion the whole epic turns on. A stale committed copy cannot
    // survive a CI run, which is what reconciles SC-ESK-001 (readable in one
    // document) with SC-ESK-004 (no drift).
    expect(
      committed,
      'the committed register disagrees with the repository — run `pnpm register:update`',
    ).toBe(normalise(generated));
  });
});
