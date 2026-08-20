/**
 * T489 / T492 · Check `G-26-04` — a stale committed register cannot survive CI,
 * and a hand edit is overwritten rather than adopted.
 * Written to FAIL before T492 exists (Constitution V).
 *
 * **This is the check that reconciles the two success criteria that pull against
 * each other.** `SC-ESK-001` wants the register readable in one document — which
 * means committing it, so it shows up in a pull request and on GitHub.
 * `SC-ESK-004` wants zero drift — which a committed file invites, because a
 * committed file can be edited. The clarification session chose "generated file,
 * committed, with the check failing when the copy disagrees" precisely because
 * *"a board nobody can see without running a command is not the board that was
 * asked for."*
 *
 * ## `RF-7` — comparison is exact
 *
 * Exact text, after normalising **line endings only**. No fuzzy matching, no
 * "close enough", no ignoring whitespace. A generated file that tolerates
 * near-misses is a generated file that drifts, and this comparison is the only
 * thing standing between a committed register and the hand-maintained status
 * this epic exists to replace.
 *
 * Line endings are the one exception because they are decided by git's
 * `core.autocrlf` and the checkout platform, not by anything a person wrote —
 * this repository checks out CRLF on Windows and would otherwise fail every run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../helpers';
import { buildRegister } from './build';
import { compareRegister, normaliseLineEndings } from './drift';

const REGISTER_PATH = join(REPO_ROOT, 'governance/epic-stage-register.md');

describe('G-26-04 · exact-text comparison (RF-7)', () => {
  it('accepts a byte-identical copy', () => {
    const generated = buildRegister();
    expect(compareRegister(generated, generated).matches).toBe(true);
  });

  it('accepts a copy differing ONLY in line endings', () => {
    // The one tolerated difference, and only because git decides it.
    const generated = buildRegister();
    const asCrlf = generated.replace(/\n/g, '\r\n');
    expect(compareRegister(asCrlf, generated).matches).toBe(true);
  });

  it('rejects a single changed character', () => {
    // The assertion that makes "exact" mean exact. A hand edit changing one
    // word must not survive.
    //
    // The mutation target is the document heading, which the renderer ALWAYS
    // emits — not a status word whose presence depends on the programme's
    // current state. The original target was `Not ready`, and the day the last
    // not-ready Epic cleared (DEF-026-007's own remediation), the replace
    // matched nothing, `edited === generated`, and this test failed with the
    // register perfectly healthy — the zero-held lesson of `build.spec`
    // repeating one file over.
    const generated = buildRegister();
    expect(generated).toContain('# Epic Stage Register');
    const edited = generated.replace('# Epic Stage Register', '# Epic Stage Regster');
    expect(edited).not.toBe(generated);
    expect(compareRegister(edited, generated).matches).toBe(false);
  });

  it('rejects a difference in trailing whitespace', () => {
    // Explicitly NOT forgiven. Whitespace tolerance is how a comparison starts
    // being approximate, and an approximate comparison is not a guarantee.
    const generated = buildRegister();
    expect(compareRegister(`${generated}\n`, generated).matches).toBe(false);
    expect(compareRegister(generated.replace(' |\n', '  |\n'), generated).matches).toBe(false);
  });

  it('rejects an added row, and rejects a removed one', () => {
    const generated = buildRegister();
    const added = generated.replace(
      '\n## Findings',
      '\n| [EPIC-099](../specs/099-phantom/) | Phantom | delivery | Ready | — | Ready | — |\n\n## Findings',
    );
    expect(compareRegister(added, generated).matches).toBe(false);

    const lines = generated.split('\n');
    const rowIndex = lines.findIndex((line) => /^\| \[EPIC-/.test(line));
    lines.splice(rowIndex, 1);
    expect(compareRegister(lines.join('\n'), generated).matches).toBe(false);
  });

  it('names what to run when it fails, rather than only that it failed', () => {
    // A drift failure with no remedy is a failure people learn to skip.
    // Heading mutation for the same reason as above: always present.
    const generated = buildRegister();
    const result = compareRegister(
      generated.replace('# Epic Stage Register', '# Epic Stage Regster'),
      generated,
    );
    expect(result.message).toMatch(/pnpm register:update/);
  });

  it('does no fuzzy matching whatsoever', () => {
    // Written as its own test because "close enough" is the failure mode that
    // arrives later, added by someone tired of a red build.
    const generated = buildRegister();
    expect(compareRegister(generated.toLowerCase(), generated).matches).toBe(false);
    expect(compareRegister(generated.replace(/\|/g, ' | '), generated).matches).toBe(false);
  });
});

describe('G-26-04 · normaliseLineEndings does exactly one thing', () => {
  it('converts CRLF to LF', () => {
    expect(normaliseLineEndings('a\r\nb')).toBe('a\nb');
  });

  it('changes nothing else — not spaces, not tabs, not case', () => {
    // A "normaliser" that quietly trims is a fuzzy comparison wearing a
    // different name.
    const text = '  A\tB  \n\n  c  ';
    expect(normaliseLineEndings(text)).toBe(text);
  });
});

describe('G-26-04 · the committed register in this repository', () => {
  it('is present and agrees with the repository', () => {
    // The live guarantee. `register.spec.ts` asserts the same thing from the
    // generator's side; this asserts it from the comparison's side, so removing
    // either one leaves the other standing.
    expect(existsSync(REGISTER_PATH)).toBe(true);
    const result = compareRegister(readFileSync(REGISTER_PATH, 'utf8'), buildRegister());
    expect(result.matches, result.message).toBe(true);
  });
});
