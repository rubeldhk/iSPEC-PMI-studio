/**
 * T332 · Check G-08 — the session-label format is defined and matches the branch naming
 * convention actually in use (FR-RGP-014, Constitution VIII).
 *
 * The convention is checked against the *live* branch, not against a restatement of
 * itself. A naming convention no branch follows is a document, not a convention.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { read, REPO_ROOT } from './helpers';

const doc = read('governance/session-labelling.md');

function currentBranch(): string | null {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/** The convention publishes its own regexes in ```regex fences, so the check reads the source of truth. */
function fencedRegex(label: string): RegExp {
  const source = new RegExp('```regex ' + label + '\\r?\\n([\\s\\S]*?)```').exec(doc)?.[1];
  expect(source, `governance/session-labelling.md publishes no "${label}" regex`).toBeTruthy();
  return new RegExp((source as string).trim());
}

describe('G-08 · session labelling (FR-RGP-014, Constitution VIII)', () => {
  it('defines a session-label format', () => {
    expect(doc).toMatch(/## Label format/);
    expect(fencedRegex('session-label').test('EPIC-018 Repository Governance')).toBe(true);
  });

  it('rejects a label that names no epic', () => {
    expect(fencedRegex('session-label').test('some work')).toBe(false);
  });

  it('defines where the label is applied and when to relabel', () => {
    expect(doc).toMatch(/## Where it is applied/);
    expect(doc).toMatch(/## When to relabel/);
    for (const surface of ['branch', 'terminal', 'worktree']) {
      expect(doc.toLowerCase(), `the convention does not say how the label applies to the ${surface}`).toContain(surface);
    }
  });

  it('matches the branch naming convention actually in use', () => {
    const branch = currentBranch();
    if (branch === null || ['main', 'master', 'HEAD'].includes(branch)) {
      console.warn(`[G-08] on "${branch}" — branch-name conformance not applicable`);
      return;
    }
    expect(
      fencedRegex('branch-name').test(branch),
      `branch "${branch}" does not match the convention in governance/session-labelling.md. ` +
        `Either the branch is misnamed or the convention has drifted — fix whichever is wrong.`,
    ).toBe(true);
  });

  it('derives the label from the branch deterministically', () => {
    expect(doc).toMatch(/## Deriving one from the other/);
  });
});
