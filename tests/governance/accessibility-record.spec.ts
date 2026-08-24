/**
 * T884 (EPIC-029) — the manual accessibility record is a transcript, not a
 * tick (FR-DS-034, SC-DS-008). Its own file, per analysis `I1`.
 *
 * T885 is human work — automation cannot see focus ORDER or whether an
 * announcement is MEANINGFUL — so the evidence is a committed record, and
 * this check is what keeps that record honest: it must exist and must name a
 * screen reader, its version, and at least one journey. A file saying only
 * "passed" MUST fail. The validation is a pure function so its own mutations
 * are tested inline against fixtures — the record path stays singular.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const RECORD = join(ROOT, 'docs/accessibility/EPIC-029-manual-pass.md');

const SCREEN_READERS = /\b(NVDA|JAWS|VoiceOver|Narrator|TalkBack|Orca)\b/i;

/** Everything wrong with a record's content; empty means conformant. */
export function recordProblems(text: string): string[] {
  const problems: string[] = [];
  if (!SCREEN_READERS.test(text)) {
    problems.push('names no screen reader (NVDA, JAWS, VoiceOver, Narrator, TalkBack, Orca)');
  }
  if (!/version\s*[:=]?\s*\S*\d/i.test(text)) {
    problems.push("names no version — 'which build heard it' is half the evidence");
  }
  if (!/(journey|→|->)/i.test(text)) {
    problems.push('lists no journey — what was walked, start to finish');
  }
  if (!/\b(20\d{2}-\d{2}-\d{2})\b/.test(text)) {
    problems.push('carries no date');
  }
  return problems;
}

describe('T884 · the validation itself can fail (Constitution V)', () => {
  it("a record saying only 'passed' fails on every count", () => {
    expect(recordProblems('passed').length).toBeGreaterThanOrEqual(3);
  });

  it('a record missing only the version fails, naming the version', () => {
    const problems = recordProblems(
      'NVDA. Journey: sign-in → create project → capture requirement. 2026-08-21.',
    );
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain('version');
  });

  it('a complete record passes', () => {
    expect(
      recordProblems(
        'Tool: NVDA, version: 2025.2. Journey: sign-in → create project → capture requirement. Date: 2026-08-21.',
      ),
    ).toEqual([]);
  });
});

describe('T884 · the committed record conforms (SC-DS-008)', () => {
  it('docs/accessibility/EPIC-029-manual-pass.md exists', () => {
    expect(
      existsSync(RECORD),
      'the manual pass (T885) has not been recorded — this Epic cannot close without it',
    ).toBe(true);
  });

  it('and is a transcript, not a tick', () => {
    const text = existsSync(RECORD) ? readFileSync(RECORD, 'utf8') : '';
    expect(recordProblems(text)).toEqual([]);
  });
});
