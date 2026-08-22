/**
 * T900b (EPIC-029) — the reachability transcript is machine evidence, not a
 * tick (SC-DS-005, Constitution XI Tier 2). The same standard T884 holds the
 * manual accessibility record to: a file saying only "passed" MUST fail.
 *
 * What Tier 2 requires of docs/accessibility/EPIC-029-reachability-transcript.md:
 * it exists, names each delivered page exercised, names BOTH themes, names
 * the 360×640 viewport and 200% zoom conditions, and carries evidence it was
 * produced by a run — machine-recorded timestamps, the URL driven, and
 * measured values a hand would not invent. Hand-writing it is a constitution
 * violation (G-28-02, enforced against T709's first attempt).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const TRANSCRIPT = join(ROOT, 'docs/accessibility/EPIC-029-reachability-transcript.md');

/** Everything wrong with a transcript's content; empty means conformant. */
export function transcriptProblems(text: string): string[] {
  const problems: string[] = [];
  for (const page of ['SignIn', 'Projects', 'Requirements']) {
    if (!new RegExp(page, 'i').test(text)) problems.push(`does not name the ${page} page`);
  }
  for (const theme of ['light', 'dark']) {
    if (!new RegExp(`\\b${theme}\\b`, 'i').test(text)) problems.push(`does not name the ${theme} theme`);
  }
  if (!/360\s*[×x]\s*640/.test(text)) problems.push('does not name the 360×640 viewport');
  if (!/200\s*%/.test(text)) problems.push('does not name 200% zoom');
  if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    problems.push('carries no machine timestamp (ISO-8601, produced by the run)');
  }
  if (!/https?:\/\/\S+/.test(text)) problems.push('names no URL that was driven');
  if (!/--color-surface|getComputedStyle|resolved/i.test(text)) {
    problems.push('carries no measured value — evidence a hand would not invent');
  }
  return problems;
}

describe('T900b · the validation itself can fail (Constitution V)', () => {
  it("a transcript saying only 'passed' fails on every count", () => {
    expect(transcriptProblems('passed').length).toBeGreaterThanOrEqual(5);
  });

  it('a transcript missing one theme fails, naming it', () => {
    const problems = transcriptProblems(
      '2026-08-21T10:00:00Z http://localhost:5173 SignIn Projects Requirements light 360×640 200% getComputedStyle',
    );
    expect(problems).toEqual(['does not name the dark theme']);
  });
});

describe('T900b · the committed transcript conforms (XI Tier 2)', () => {
  it('docs/accessibility/EPIC-029-reachability-transcript.md exists', () => {
    expect(
      existsSync(TRANSCRIPT),
      'the reachability run (T900a) has not been recorded — this Epic cannot close without it',
    ).toBe(true);
  });

  it('and is run-generated evidence, not an assertion of one', () => {
    const text = existsSync(TRANSCRIPT) ? readFileSync(TRANSCRIPT, 'utf8') : '';
    expect(transcriptProblems(text)).toEqual([]);
  });
});
