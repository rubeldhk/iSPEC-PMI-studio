/**
 * `T997m`, `T997n` (EPIC-035) — four boundaries this Room must not cross.
 *
 * - **No test runner, executor, scheduler or CI adapter** (`R-035-1`,
 *   `FR-DFR-062`). **The load-bearing clause.** This Epic needs a failing test
 *   to exist before a fix is accepted, and *nobody has built a callable
 *   test-execution surface*. The port it needs is the one that does not exist,
 *   which makes writing a small runner "just to unblock" the single most likely
 *   thing to happen here — and a Room that runs tests is a CI system with a
 *   governance record attached.
 * - **No `GenerateTasksService`, no `TaskRegenerationService`** (`R-035-3`).
 *   `EPIC-034` recorded what the second one costs: it **replaces** a task list,
 *   and `BR-0154` requires revision without destroying completed work. This
 *   Room creates repair tasks; a generator here would regenerate them.
 * - **No region vocabulary of its own** (`UX-0035`). `ROOM_REGIONS` is
 *   `packages/room-contract`'s, imported by three Rooms. A fourth copy would
 *   make the compile-time guarantee decorative.
 * - **No Room-local attachment mechanism** (`FR-DFR-032`, `FR-DFR-033`).
 *   Reproduction evidence goes through `EPIC-032` and is readable only under
 *   the access rules of the artifact it concerns. A payload field here is how a
 *   HAR containing a session token becomes readable by everyone who can see
 *   defects.
 *
 * Comments are stripped before every check. This module's headers quote the
 * requirements they implement, and a matcher run over prose reports the
 * requirement as the violation — `EPIC-034` tripped that way four times.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = resolve(here, '../../src/modules/defect-room');

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function sourcesUnder(dir: string): { path: string; code: string }[] {
  const out: { path: string; code: string }[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourcesUnder(full));
      continue;
    }
    if (!entry.endsWith('.ts')) continue;
    out.push({ path: entry, code: stripComments(readFileSync(full, 'utf8')) });
  }
  return out;
}

const SOURCES = sourcesUnder(MODULE_DIR);

describe('T997m · there are sources to examine', () => {
  it('finds them, or every check below is vacuous', () => {
    expect(SOURCES.length).toBeGreaterThan(3);
  });

  it('the comment stripper does not eat code', () => {
    expect(stripComments('const a = 1; // note\n/* block */ const b = 2;')).toContain('const a = 1;');
    expect(stripComments('/* spawn */ const c = 3;')).not.toContain('spawn');
  });
});

describe('T997m · no test runner, executor, scheduler or CI adapter', () => {
  it.each([
    ['a process spawn', /\bspawn(Sync)?\s*\(/],
    ['an exec', /\bexec(Sync|File)?\s*\(/],
    ['a child process import', /child_process/],
    ['a vitest import', /from\s+'vitest'/],
    ['a runner class', /class\s+\w*(Runner|Executor|Scheduler)\b/],
    ['a CI adapter', /\b(githubActions|gitlabCi|jenkins|circleCi)\b/i],
  ])('never contains %s', (_what, pattern) => {
    // The port this Epic needs is the one nobody built. That is exactly why a
    // small runner "just to unblock" is the most likely thing to appear here.
    for (const source of SOURCES) {
      expect(pattern.test(source.code), `${source.path} contains ${pattern}`).toBe(false);
    }
  });

  it('the runner checks can fire', () => {
    // Anti-tautology across the whole set: six absence assertions are worth
    // nothing unless the matchers are shown catching what they look for.
    expect(/\bspawn(Sync)?\s*\(/.test("spawn('vitest', ['run'])")).toBe(true);
    expect(/child_process/.test("import { execFile } from 'node:child_process';")).toBe(true);
    expect(/class\s+\w*(Runner|Executor|Scheduler)\b/.test('class TestRunner {}')).toBe(true);
  });
});

describe('T997m · neither task generator is imported', () => {
  it.each(['GenerateTasksService', 'TaskRegenerationService'])('never imports %s', (service) => {
    // `R-035-3`. `EPIC-034` mutation-proved what the second costs: it replaces
    // a task list, and `BR-0154` requires revision without destroying
    // completed work.
    for (const source of SOURCES) {
      expect(source.code.includes(service), `${source.path} imports ${service}`).toBe(false);
    }
  });

  it('the import check can fire', () => {
    expect("import { TaskRegenerationService } from '../tasks';".includes('TaskRegenerationService')).toBe(
      true,
    );
  });
});

describe('T997m · no region vocabulary of its own', () => {
  it('declares neither ROOM_REGIONS nor a RoomRegion type', () => {
    // `UX-0035`: if one Room needs a seventh region, the pattern changes for
    // all three. A fourth copy makes the compile-time guarantee decorative.
    for (const source of SOURCES) {
      expect(/\b(ROOM_REGIONS|REGIONS)\s*(=|:)/.test(source.code), `${source.path}`).toBe(false);
      expect(/\bRoomRegion\b\s*=/.test(source.code), `${source.path}`).toBe(false);
    }
  });

  it('the vocabulary check can fire', () => {
    expect(/\b(ROOM_REGIONS|REGIONS)\s*(=|:)/.test("const ROOM_REGIONS = ['objectState'];")).toBe(
      true,
    );
  });
});

describe('T997m · no Room-local attachment mechanism', () => {
  it.each(['payload', 'attachment', 'blob', 'base64', 'fileContent'])(
    'stores no %s',
    (field) => {
      // `FR-DFR-032`, `FR-DFR-033`, `BR-0062`. Evidence lives in `EPIC-032` and
      // is readable under the access rules of the artifact it concerns. A copy
      // here would be readable under this Room's rules instead — which is how a
      // reproduction HAR carrying a session token reaches everyone who can see
      // defects.
      for (const source of SOURCES) {
        expect(
          new RegExp(`\\b${field}\\b`, 'i').test(source.code),
          `${source.path} carries ${field}`,
        ).toBe(false);
      }
    },
  );

  it('the attachment check can fire', () => {
    expect(/\bpayload\b/i.test('  readonly payload: Buffer;')).toBe(true);
  });

  it('and evidence IS referenced, so the absence is not the absence of the concept', () => {
    // The positive half. A Room that stored no evidence reference at all would
    // pass every assertion above and fail `FR-DFR-032`.
    const anyRefs = SOURCES.some((source) => /evidenceRefs?/.test(source.code));
    expect(anyRefs, 'no source references evidence at all').toBe(true);
  });
});
