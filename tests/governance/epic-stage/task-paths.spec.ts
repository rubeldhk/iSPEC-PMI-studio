/**
 * G-26-14 — a completed task names an artifact that exists.
 *
 * `DEF-001-003`. Seven ticked tasks named files that were not there: the
 * observability work had moved to `packages/observability`, and `T506`'s single
 * spec had become two. Nothing was unbuilt — every artifact existed — but the
 * trace to it was broken, and a reader following `T158` to
 * `backend/src/core/observability/logger.ts` would have found an empty directory
 * and concluded the box was ticked without the work being done.
 *
 * **Why `DOR-08` could not see it.** `DOR-08` pairs a task with its test, and
 * those tasks carry explicit `(unit test: T157)` references — so pairing
 * succeeded on the reference while nobody resolved the path sitting beside it.
 * The check reads the claim, and the claim was well-formed. This resolves the
 * claim instead.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { enumerateEpics } from './derive';

/** Backticked strings that look like repository paths, not prose. */
const PATHISH = /`([A-Za-z0-9_@./-]+\/[A-Za-z0-9_@./-]+\.[A-Za-z0-9]+)`/g;

export interface NamedPath {
  readonly epic: string;
  readonly task: string;
  readonly path: string;
}

/**
 * Every repository path named by a COMPLETED task in this Epic.
 *
 * Two exclusions, both reachable and both load-bearing:
 *
 * - **Spec-relative paths** (`../_shared/schema.sql`) resolve from the Epic
 *   directory, not the repository root. Resolving them from the root reported
 *   two of these as missing on the first run, when both exist.
 * - **External citations** (`@vendor/widget/index.d.ts`) name a package, not a
 *   file in this tree. Reporting those makes the check noisy enough to be
 *   ignored, which is how a gate stops working. The example is a neutral scope
 *   on purpose: `G-26-11` scans this group's raw source for framework names, and
 *   a real one written in a comment reads exactly like a dependency to it.
 *
 * A glob exclusion was written here too and removed: `PATHISH` has no `*` in its
 * character class, so `path.includes('*')` could never be true. It read as a
 * guard while guarding nothing — the same shape as the faults this suite exists
 * to catch, which is why it is called out rather than quietly deleted.
 */
export function pathsNamedByCompletedTasks(epicPath: string, epicId: string): NamedPath[] {
  const tasksFile = join(epicPath, 'tasks.md');
  if (!existsSync(tasksFile)) return [];

  const found: NamedPath[] = [];
  for (const line of readFileSync(tasksFile, 'utf8').split(/\r?\n/)) {
    const done = /^\s*- \[[xX]\]\s*(T\d{3}[a-z]?)/.exec(line);
    if (!done) continue;
    const task = done[1];
    if (!task) continue;
    for (const match of line.matchAll(PATHISH)) {
      const path = match[1];
      if (!path) continue;
      const top = path.split('/')[0];
      if (!top || top === '..' || top === '.') continue;
      if (!existsSync(join(process.cwd(), top))) continue;
      found.push({ epic: epicId, task, path });
    }
  }
  return found;
}

const EPICS = enumerateEpics();
const NAMED = EPICS.flatMap((epic) => pathsNamedByCompletedTasks(epic.path, epic.id));

describe('G-26-14 · a ticked task names a file that exists (DEF-001-003)', () => {
  it('resolves a meaningful number of paths, or this check proves nothing', () => {
    // Guard against the regex silently matching nothing — the failure mode that
    // would make every assertion below pass over an empty list.
    expect(NAMED.length, 'no completed task named a repository path').toBeGreaterThan(50);
  });

  it('finds no completed task naming a path that is absent', () => {
    const missing = NAMED.filter(({ path }) => !existsSync(join(process.cwd(), path)));
    expect(
      missing,
      missing.map((m) => `${m.epic} ${m.task} → ${m.path}`).join('\n'),
    ).toEqual([]);
  });

  it('excludes spec-relative paths, which resolve from the Epic directory', () => {
    // Reachable and load-bearing: `../_shared/schema.sql` and
    // `../_shared/system-design.md` both exist, and both were reported missing
    // before this exclusion existed.
    const matched = [...'names `../_shared/schema.sql`'.matchAll(PATHISH)].map((m) => m[1]);
    expect(matched, 'the regex no longer matches a spec-relative path').toContain(
      '../_shared/schema.sql',
    );
    expect(existsSync(join(process.cwd(), '../_shared/schema.sql'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'specs/_shared/schema.sql'))).toBe(true);
  });

  it('excludes citations of packages that are not in this tree', () => {
    // The example is a deliberately neutral scope. Naming a real framework here
    // trips `G-26-11`, which scans this group for framework dependencies and
    // cannot tell a quoted string from an import — correctly, since telling them
    // apart is what a parser is for and the check is a scanner.
    const matched = [...'imports `@vendor/widget/index.d.ts`'.matchAll(PATHISH)].map((m) => m[1]);
    expect(matched, 'the regex no longer matches an external citation').toContain(
      '@vendor/widget/index.d.ts',
    );
    // The exclusion fires on the top-level segment, which is not a repo directory.
    expect(existsSync(join(process.cwd(), '@vendor'))).toBe(false);
  });
});
