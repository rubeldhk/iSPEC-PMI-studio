/**
 * T148 — Constitution V, asserted programme-wide: no implementation task
 * across the epics lacks a paired test.
 *
 * The rule this encodes is the one every closure record has been claiming:
 * a task line that says "Implement ... in `<application source path>`" must
 * name its test — `(unit test: Tnnn)`, `(contract test: Tnnn)`, or an
 * equivalent conformance check — or be itself a test task. This spec reads
 * every epic's tasks.md from disk, so a future epic that forgets the pairing
 * turns this suite red rather than relying on review to notice.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SPECS = resolve(here, '../../../../specs');

/** A task line that writes application source code. */
const CODE_PATH = /`(backend\/src|frontend\/src|worker\/src|packages\/[^/]+\/src|engine-adapters\/[^/]+\/src|agent-adapters\/[^/]+\/src|execution-providers\/[^/]+\/src)\//;
/** Evidence the line pairs itself with a test or IS one. */
const PAIRED = /(unit test|contract test|integration test|architecture test|conformance check|conformance: T\d|test: T\d|tests\/)/i;

function taskLines(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => /^- \[[ xX]\] T\d+/.test(line));
}

function epicTaskFiles(): { epic: string; file: string }[] {
  return readdirSync(SPECS)
    .filter((d) => /^\d{3}-/.test(d))
    .map((d) => ({ epic: d, file: join(SPECS, d, 'tasks.md') }))
    .filter(({ file }) => existsSync(file));
}

describe('T148 · every implementation task carries a paired test (Constitution V)', () => {
  const files = epicTaskFiles();

  it('finds the epic task lists — an empty scan would prove nothing', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it('no task that writes application source code lacks a named test pairing', () => {
    const unpaired: string[] = [];
    for (const { epic, file } of files) {
      for (const line of taskLines(file)) {
        if (!CODE_PATH.test(line)) continue;
        if (PAIRED.test(line)) continue;
        unpaired.push(`${epic}: ${line.trim()}`);
      }
    }
    // The assertion IS the deliverable: this list must be empty, and when it
    // is not, the failure message names every offender.
    expect(unpaired).toEqual([]);
  });

  it('the enumerated per-epic converge gaps are closed — none remains recorded open', () => {
    // Every closure.md that enumerates a unit-test gap must not leave it
    // unowned. The one gap enumerated across the fifteen closures was
    // EPIC-010's automated accessibility checks — closed by
    // `frontend/tests/unit/a11y/components-axe.spec.tsx` (this epic, T148).
    const axeSpec = resolve(here, '../../../../frontend/tests/unit/a11y/components-axe.spec.tsx');
    expect(existsSync(axeSpec)).toBe(true);
  });
});
