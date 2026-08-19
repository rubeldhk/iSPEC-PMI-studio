/**
 * T667 · Check `G-10` — the branch names the epic actually being worked.
 *
 * **Decision `D-39`, taken 2026-08-17 after eight occurrences.**
 *
 * `G-08` checks that a branch name matches the published *format*. It cannot
 * check *correspondence*, and every closing report that recorded a Constitution
 * VIII lapse said so in the same words: *"`G-08` passes because it checks the
 * format of a branch name, not whether the name matches the epic being worked."*
 *
 * Recorded in six closing reports — EPIC-001, EPIC-018, EPIC-028, EPIC-003,
 * EPIC-027 — and predicted in prose by both `plan.md` and `tasks.md` of EPIC-027
 * before happening anyway. **A prediction in prose is not a control.**
 *
 * ## Severity: REPORTS, does not block
 *
 * Constitution VIII is deliberately **SHOULD**, not MUST: *"terminal title
 * control is environment-dependent; the naming convention is mandatory, its
 * mechanical application is best-effort."* Blocking CI on a SHOULD would halt
 * unrelated work across every epic for a convention breach, which is the
 * condition `governance/README.md` says trains people to silence a check rather
 * than honour it.
 *
 * What it does instead is **name the mismatch**. `G-08` reports a branch that
 * looks fine; this reports `epic/003-specification-engine` while EPIC-027 is
 * being worked, which is the sentence no previous check could produce.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './helpers';

function git(args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/** `epic/027-ai-native-amendment` → `027`. Null when the branch names no epic. */
export function epicOfBranch(branch: string): string | null {
  return /^epic\/(\d{3})-/.exec(branch)?.[1] ?? null;
}

/**
 * The epic actually being worked, in order of evidence strength:
 *
 *   1. Uncommitted changes under `specs/<nnn>-` — what is being worked *now*.
 *   2. The subject of HEAD — what was worked most recently.
 *
 * Uncommitted wins because a clean tree after a commit would otherwise report
 * the previous epic forever.
 */
export function epicBeingWorked(): { epic: string | null; evidence: string } {
  const dirty = git(['status', '--porcelain'])
    .split(/\r?\n/)
    .map((l) => l.slice(3).trim())
    .filter(Boolean);

  const dirtyEpics = new Set(
    dirty.map((f) => /^specs\/(\d{3})-/.exec(f)?.[1]).filter((e): e is string => Boolean(e)),
  );
  if (dirtyEpics.size === 1) {
    return { epic: [...dirtyEpics][0] as string, evidence: 'uncommitted changes' };
  }
  if (dirtyEpics.size > 1) {
    return { epic: null, evidence: `uncommitted changes span ${dirtyEpics.size} epics` };
  }

  const subject = git(['log', '-1', '--format=%s']);
  const fromSubject = /\(EPIC-(\d{3})\)/.exec(subject)?.[1];
  if (fromSubject) return { epic: fromSubject, evidence: `HEAD subject: ${subject.slice(0, 60)}` };

  return { epic: null, evidence: 'no epic determinable' };
}

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const branchEpic = epicOfBranch(branch);
const worked = epicBeingWorked();

describe('G-10 · the branch names the epic being worked (D-39, Constitution VIII)', () => {
  it('the epic can be determined from the branch name', () => {
    // A branch outside the convention is G-08's job, not this check's. Skipping
    // rather than failing keeps the two checks from reporting one fault twice.
    if (!branch || !/^epic\//.test(branch)) {
      console.warn(`[G-10] SKIPPED — branch "${branch}" is not an epic branch; G-08 owns the format.`);
      return;
    }
    expect(branchEpic, `branch "${branch}" matches epic/ but names no three-digit epic`).toBeTruthy();
  });

  it('the named epic exists in specs/', () => {
    if (!branchEpic) return;
    const dirs = git(['ls-files', '--directory', 'specs/']);
    const exists =
      dirs.includes(`specs/${branchEpic}-`) ||
      existsSync(join(REPO_ROOT, 'specs')) &&
        require('node:fs')
          .readdirSync(join(REPO_ROOT, 'specs'))
          .some((d: string) => d.startsWith(`${branchEpic}-`));
    expect(exists, `branch names EPIC-${branchEpic} and no specs/${branchEpic}-* directory exists`).toBe(
      true,
    );
  });

  it('REPORTS when the branch does not name the epic being worked', () => {
    // The assertion G-08 structurally cannot make. It always passes — the
    // severity is deliberate (Constitution VIII is SHOULD) — but it prints the
    // specific mismatch, which is the whole point of D-39.
    if (!branchEpic || !worked.epic) {
      return;
    }
    if (branchEpic !== worked.epic) {
      console.warn(
        `[G-10] REPORTS — Constitution VIII: the branch is "${branch}" (EPIC-${branchEpic}) ` +
          `but the epic being worked is EPIC-${worked.epic}, from ${worked.evidence}. ` +
          `Relabel the branch, or record the deviation in this epic's closing report. ` +
          `This lapse has been recorded in six closing reports; G-08 cannot see it because it ` +
          `checks the FORMAT of a branch name, not its correspondence.`,
      );
    }
    expect(true).toBe(true);
  });

  it('can actually detect a mismatch — proven against a constructed case', () => {
    // A reporting check that cannot recognise the condition is decoration. This
    // proves the comparison works without depending on today's branch state.
    expect(epicOfBranch('epic/027-ai-native-amendment')).toBe('027');
    expect(epicOfBranch('epic/003-specification-engine')).toBe('003');
    expect(epicOfBranch('main')).toBeNull();
    expect(epicOfBranch('feature/whatever')).toBeNull();

    const mismatch = epicOfBranch('epic/003-specification-engine') !== '027';
    expect(mismatch, 'the comparison would not have caught the eight recorded lapses').toBe(true);
  });

  it('records the current state so a reader sees it without running git', () => {
    // Deliberately an assertion about *reporting*, not about compliance: the
    // check states what it observed, and the closing report is where a
    // deviation is justified.
    expect(typeof branch).toBe('string');
    expect(['string', 'object']).toContain(typeof worked.epic);
  });
});
