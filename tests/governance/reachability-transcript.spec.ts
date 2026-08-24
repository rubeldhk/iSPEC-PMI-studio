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
const THEMES_CSS = join(ROOT, 'frontend/src/design/themes.css');

/**
 * T928 (Phase 9) — CURRENCY. Everything above tests that the transcript is
 * evidence; nothing tested that it is evidence of the CURRENT build, and
 * Phase 9 proved that gap is real: the 2026-08-21 run recorded a body
 * background of `rgb(255, 255, 255)` and stayed green for two days after the
 * page moved onto `--color-canvas`. A transcript that outlives its build is a
 * tick with timestamps on it.
 *
 * The mechanism: a run reads real computed values out of the live document,
 * so the transcript must contain the token values the theme files currently
 * declare. It cannot be satisfied by a hand — you would have to know them —
 * and it goes red the moment a palette changes without a re-run.
 */
export function stalenessProblems(transcript: string, themesCss: string): string[] {
  const themed = (selector: string): Map<string, string> => {
    const at = themesCss.indexOf(selector);
    if (at === -1) return new Map();
    const open = themesCss.indexOf('{', at);
    const close = themesCss.indexOf('}', open);
    return new Map(
      [...themesCss.slice(open, close).matchAll(/(--color-[a-z-]+)\s*:\s*(#[0-9a-f]{6})/gi)].map(
        (m) => [m[1] as string, (m[2] as string).toLowerCase()],
      ),
    );
  };

  const problems: string[] = [];
  // The grounds are what a run measures and what a restyle moves. Checking
  // every token would make an unrelated tweak fail the check; checking the
  // surfaces the body and cards are painted with is the load-bearing part.
  for (const [theme, selector] of [
    ['light', ":root[data-theme='light']"],
    ['dark', ":root[data-theme='dark']"],
  ] as const) {
    for (const token of ['--color-canvas', '--color-surface']) {
      const value = themed(selector).get(token);
      if (value === undefined) {
        problems.push(`themes.css declares no ${token} for ${theme}`);
        continue;
      }
      if (!transcript.toLowerCase().includes(value)) {
        problems.push(
          `records no ${theme} ${token} of ${value} — the transcript predates the current token layer; re-run T900a`,
        );
      }
    }
  }
  return problems;
}

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

describe('T928 · the transcript is evidence of the CURRENT build (currency)', () => {
  it('the staleness check can fail — a transcript from an older palette is caught', () => {
    // The literal shape of the miss Phase 9 produced: a run that recorded the
    // page as white after the page moved onto the canvas token.
    const stale = 'bodyBackground rgb(255, 255, 255) #ffffff';
    const themes = ":root[data-theme='light'] { --color-canvas: #f6f7f9; --color-surface: #ffffff; }";
    const problems = stalenessProblems(stale, themes);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(' ')).toContain('--color-canvas');
    expect(problems.join(' ')).toContain('re-run T900a');
  });

  it('a transcript carrying the current values passes', () => {
    const themes =
      ":root[data-theme='light'] { --color-canvas: #f6f7f9; --color-surface: #ffffff; }\n" +
      ":root[data-theme='dark'] { --color-canvas: #0b1120; --color-surface: #111827; }";
    expect(
      stalenessProblems('light #f6f7f9 #ffffff · dark #0b1120 #111827', themes),
    ).toEqual([]);
  });

  it('the committed transcript records the token values the build currently declares', () => {
    const text = existsSync(TRANSCRIPT) ? readFileSync(TRANSCRIPT, 'utf8') : '';
    const themesCss = readFileSync(THEMES_CSS, 'utf8');
    expect(stalenessProblems(text, themesCss)).toEqual([]);
  });
});
