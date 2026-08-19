/**
 * T312 · Check G-01/G-02/G-03 — steering subject coverage and checkable standards.
 *
 * Satisfies SC-RGP-002. Asserts FR-RGP-001 (every named subject has a file),
 * FR-RGP-002 (standards state a condition an artifact can be held against, not an
 * aspiration) and contract rules SF-1, SF-2, SF-3, SF-4, SF-5.
 *
 * These checks fail the build: a missing or unowned steering file is a form defect,
 * and agent sessions load these files as context.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readConfig, steeringFiles, standardsOf, repoExists, parseFrontMatter, REPO_ROOT } from './helpers';

const config = readConfig();
const files = steeringFiles();

describe('G-01 · steering subject coverage (FR-RGP-001)', () => {
  it.each(config.steeringSubjects)('subject "%s" has a steering file', (subject) => {
    expect(repoExists(`governance/steering/${subject}.md`)).toBe(true);
  });

  it('declares no steering file outside the named subjects', () => {
    const unexpected = files.map((file) => file.subject).filter((s) => !config.steeringSubjects.includes(s));
    expect(unexpected).toEqual([]);
  });

  it('has an index at governance/steering/README.md', () => {
    expect(repoExists('governance/steering/README.md')).toBe(true);
  });

  it('has exactly one active file per subject', () => {
    const active = files.filter((file) => file.front.status === 'active').map((file) => file.subject);
    expect(new Set(active).size).toBe(active.length);
  });
});

describe('G-02 · front matter completeness (SF-1)', () => {
  it.each(files.map((file) => [file.subject, file] as const))('%s declares complete front matter', (_subject, file) => {
    for (const key of ['subject', 'scope', 'version', 'status', 'owner', 'last_reviewed']) {
      expect(file.front[key], `${file.relativePath} is missing front matter "${key}"`).toBeTruthy();
    }
    expect(file.front.subject).toBe(file.subject);
    expect(config.owners, `${file.relativePath} owner must be a programme role, not an individual`).toContain(
      file.front.owner,
    );
    expect(config.statuses).toContain(file.front.status);
    expect(file.front.version).toMatch(/^\d+$/);
  });
});

describe('G-03 · standards are checkable, not aspirational (FR-RGP-002, SF-2 to SF-5)', () => {
  const authored = files.filter((file) => file.front.status !== 'awaiting-input');

  it.each(authored.map((file) => [file.subject, file] as const))('%s states at least one standard', (_s, file) => {
    expect(standardsOf(file.body).length).toBeGreaterThan(0);
  });

  it.each(authored.map((file) => [file.subject, file] as const))(
    '%s gives every standard a check and a rationale',
    (_subject, file) => {
      for (const standard of standardsOf(file.body)) {
        const where = `${file.relativePath} ${standard.id}`;
        expect(standard.text, `${where} states no **Check**`).toMatch(/\*\*Check\*\*:\s*\S/);
        expect(standard.text, `${where} states no **Rationale**`).toMatch(/\*\*Rationale\*\*:\s*\S/);
        const check = /\*\*Check\*\*:\s*(.+)/.exec(standard.text)?.[1] ?? '';
        expect(check.trim(), `${where} has a placeholder check`).not.toMatch(/^(tbd|todo|n\/a|none)\b/i);
      }
    },
  );

  it.each(authored.map((file) => [file.subject, file] as const))(
    '%s states no standard in vague terms (FR-RGP-002)',
    (_subject, file) => {
      const offences: string[] = [];
      for (const standard of standardsOf(file.body)) {
        for (const term of config.vagueTerms) {
          if (standard.title.toLowerCase().includes(term)) {
            offences.push(`${standard.id} "${standard.title}" — vague term "${term}"`);
          }
        }
      }
      expect(offences, `${file.relativePath} states unfalsifiable standards`).toEqual([]);
    },
  );

  it('records a blocker and an owner for any subject awaiting input', () => {
    for (const file of files.filter((f) => f.front.status === 'awaiting-input')) {
      expect(file.front.blocked_by, `${file.relativePath} must name what it awaits`).toBeTruthy();
      expect(file.body, `${file.relativePath} must name a back-fill owner`).toMatch(/Back-fill owner/i);
    }
  });
});

describe('G-02b · a content change carries a version increment (FR-RGP-003)', () => {
  /**
   * Git retains the change history; `version` is what a citation refers to. If a standard is
   * edited in place while `version` stays put, every citation of "CS-004 as of version 2" now
   * points at different text and nothing says so.
   *
   * A file not yet committed has no previous state to compare against and is skipped — that is
   * the honest answer, not a pass.
   */
  it.each(files.map((file) => [file.subject, file] as const))('%s', (_subject, file) => {
    let committed: string;
    try {
      execSync(`git cat-file -e HEAD:"${file.relativePath}"`, { cwd: REPO_ROOT, stdio: 'ignore' });
      committed = execSync(`git show HEAD:"${file.relativePath}"`, { cwd: REPO_ROOT, encoding: 'utf8' });
    } catch {
      return; // untracked or not yet committed — no baseline to compare
    }

    const previous = parseFrontMatter(committed);

    // DEF-018-002 — compare line endings normalised, on both sides.
    //
    // `git show` returns the blob as stored, with LF. With `core.autocrlf=true`
    // and no `.gitattributes`, the working copy holds CRLF after any checkout,
    // so every steering file read as "changed" and demanded a version increment
    // nobody had earned. Nothing else is normalised: `.trim()` on the ends is
    // deliberate and pre-existing, and interior whitespace still counts as a
    // change, because it is one.
    const sameContent = (left: string, right: string): boolean =>
      left.replace(/\r\n/g, '\n').trim() === right.replace(/\r\n/g, '\n').trim();

    if (sameContent(previous.body, file.body)) return; // unchanged

    expect(
      Number(file.front.version),
      `${file.relativePath} changed since the last commit but version stayed at ` +
        `${previous.front.version}. Increment it, or citations of its standards go stale silently.`,
    ).toBeGreaterThan(Number(previous.front.version ?? 0));
  });
});

describe('G-03b · standard identifiers are unique and stable (SF-2)', () => {
  it('assigns no identifier twice across all steering files', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const file of files) {
      for (const standard of standardsOf(file.body)) {
        const previous = seen.get(standard.id);
        if (previous) collisions.push(`${standard.id} in both ${previous} and ${file.relativePath}`);
        else seen.set(standard.id, file.relativePath);
      }
    }
    expect(collisions).toEqual([]);
  });
});
