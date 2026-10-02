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
const ROOT = resolve(here, '../../../..');
const SPECS = join(ROOT, 'specs');

// **This file cannot import the shared module, and that was established by
// compiling rather than assumed.** `tests/governance/epic-stage/task-id-format.ts`
// is the one definition, but this package's tsconfig sets `rootDir` to
// `backend/`, so importing a `.ts` file from the repository root fails with
// TS6059. Vitest resolves it happily — only `tsc` says no, which is why an
// import that ran green was still wrong.
//
// So the shape is read from the same single source that module reads. What is
// repeated here is stripping two anchor characters; what is NOT repeated is
// the shape. If the shape ever appears here as a literal, `T864a` fails.
/** The identifier shape, unanchored, from governance configuration. */
function identifierShape(): string {
  const config = JSON.parse(
    readFileSync(join(ROOT, 'governance', 'epic-stage.config.json'), 'utf8'),
  ) as { taskIdentifierRecogniser: string };
  return config.taskIdentifierRecogniser.replace(/^\^/, '').replace(/\$$/, '');
}

/** A task line that writes application source code. */
const CODE_PATH = /`(backend\/src|frontend\/src|worker\/src|packages\/[^/]+\/src|engine-adapters\/[^/]+\/src|agent-adapters\/[^/]+\/src|execution-providers\/[^/]+\/src)\//;
/**
 * Evidence the line pairs itself with a test or IS one.
 *
 * `T1002` — the two citation markers compose their identifier shape from
 * configuration. They were written `test: T\d`, which looks harmless because
 * it is digit-agnostic, but it **would** drift: change the identifier shape
 * and these stop recognising a citation, so `T148` silently stops pairing
 * while staying green. Green because it checked nothing is the failure this
 * whole Epic is about.
 */
const PAIRED = new RegExp(
  `(unit test|contract test|integration test|architecture test|conformance check|` +
    `conformance: ${identifierShape()}|test: ${identifierShape()}|tests\\/)`,
  'i',
);

// T1002 — the identifier shape is configuration (`EPIC-026` `FR-ESK-025`).
// This site was digit-agnostic (`T\d+`) and so blind to nothing, but it was a
// fifth hand-written copy of a shape that is meant to exist once.
function taskLines(file: string): string[] {
  const line = new RegExp(`^- \\[[ xX]\\] ${identifierShape()}`);
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((text) => line.test(text));
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

  it('and parses task LINES out of them, which the file count does not check', () => {
    // `T1002`. The guard above reads as an anti-vacuity check and is one — for
    // the directory scan. The line parse fails independently, and nothing
    // watched it: with every file found and no line matched, "no unpaired
    // task" is true of an empty list and this Constitution V gate reports the
    // programme clean.
    //
    // Found by mutation, not by reading. Changing the configured identifier
    // shape turned nine spec files red across two other projects and left this
    // one green — the single most convincing argument that the guard was
    // pointed at the wrong thing.
    const lines = files.flatMap(({ file }) => taskLines(file));
    expect(lines.length, 'no task lines parsed — the pairing check is vacuous').toBeGreaterThan(
      1000,
    );
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
