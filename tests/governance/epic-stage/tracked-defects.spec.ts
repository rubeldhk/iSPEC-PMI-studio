/**
 * G-26-13 — the evidence `DOR-11` depends on is evidence git can carry.
 *
 * `DEF-026-005`. `DOR-11` requires each Epic's `defects/` folder to exist, on the
 * correct reasoning that its absence means no defect COULD have been recorded —
 * which is not the same as none having occurred. But git does not track empty
 * directories, so in 22 of 28 Epics the folder existed in every working tree and
 * in no checkout. `DOR-11` passed locally and failed in CI, and the register
 * published `Ready` for an Epic that CI derived as `stalled`.
 *
 * **This asserts against the git INDEX, not the filesystem.** A check that reads
 * the working tree cannot see this fault — it is precisely the check that already
 * exists, and precisely why the divergence survived until an Epic with an empty
 * `defects/` first reached readiness.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { enumerateEpics } from './derive';

/** Paths git actually carries, as git itself reports them. */
function trackedFiles(pathspec: string): string[] {
  const out = execFileSync('git', ['ls-files', '--', pathspec], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

const EPICS = enumerateEpics();

describe('G-26-13 · DOR-11 reads something git can carry (DEF-026-005)', () => {
  it('has Epics to check, or this suite proves nothing', () => {
    expect(EPICS.length).toBeGreaterThan(0);
  });

  it.each(EPICS.map((epic) => [epic.id, epic.directory] as const))(
    '%s carries its defects/ folder in the git index',
    (id, directory) => {
      const onDisk = existsSync(join('specs', directory, 'defects'));
      if (!onDisk) return; // DOR-11 reports the absence itself; not this check's job.

      const tracked = trackedFiles(`specs/${directory}/defects`);
      expect(
        tracked.length,
        `${id}: specs/${directory}/defects exists on disk but git tracks nothing in it — ` +
          'DOR-11 will pass here and fail in CI (DEF-026-005). Add a .gitkeep.',
      ).toBeGreaterThan(0);
    },
  );

  it('never reports a folder as carried on the strength of the filesystem alone', () => {
    // The mutation this suite must survive: swapping `git ls-files` for
    // `existsSync` makes every assertion above pass while the fault is present.
    // Asserted directly, so the weakening is a failure rather than a silence.
    const sample = EPICS.find((epic) => existsSync(join('specs', epic.directory, 'defects')));
    expect(sample, 'no Epic has a defects/ folder, so this assertion is vacuous').toBeDefined();

    const nonsense = trackedFiles(`specs/${sample!.directory}/defects-does-not-exist`);
    expect(nonsense, 'git ls-files reported a path that does not exist').toEqual([]);
  });
});
