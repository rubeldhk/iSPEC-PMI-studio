/**
 * T492 — exact-text drift comparison (`RF-7`, `FR-ESK-021`).
 *
 * The committed register is compared to a freshly generated one as **exact
 * text**, after normalising line endings only.
 *
 * **Why nothing else is normalised.** A generated file that tolerates
 * near-misses is a generated file that drifts. Trim trailing spaces and a row
 * can gain a column's worth of padding unnoticed; ignore case and `Ready`
 * matches `ready`; collapse whitespace and a wrapped row passes. Each
 * concession is individually reasonable and collectively removes the guarantee.
 * This comparison is the only thing standing between a committed register and
 * the hand-maintained status this epic exists to replace.
 *
 * **Why line endings are the exception.** They are decided by git's
 * `core.autocrlf` and the checkout platform, not by anything a person wrote.
 * This repository checks out CRLF on Windows — every run would fail, on a
 * difference no author introduced and no author can fix.
 *
 * Not a `.spec.ts`, so vitest never collects it.
 */

/** The single tolerated normalisation. Deliberately does nothing else. */
export function normaliseLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

export interface DriftResult {
  readonly matches: boolean;
  /** Empty when they match; otherwise names the remedy, not just the fault. */
  readonly message: string;
}

/** First line that differs, so a failure points somewhere rather than everywhere. */
function firstDifference(committed: string, generated: string): string {
  const left = committed.split('\n');
  const right = generated.split('\n');
  const limit = Math.max(left.length, right.length);

  for (let index = 0; index < limit; index += 1) {
    if (left[index] === right[index]) continue;
    return [
      `first difference at line ${index + 1}:`,
      `  committed:  ${left[index] ?? '(absent — the committed file ends here)'}`,
      `  generated:  ${right[index] ?? '(absent — the generated file ends here)'}`,
    ].join('\n');
  }
  // Reachable when the files differ only in trailing content the line split
  // collapses — reported rather than swallowed.
  return 'the files differ in trailing content';
}

/**
 * Does the committed register still agree with the repository?
 *
 * A failure names `pnpm register:update`, because a drift failure with no
 * remedy is a failure people learn to skip rather than fix.
 */
export function compareRegister(committed: string, generated: string): DriftResult {
  const left = normaliseLineEndings(committed);
  const right = normaliseLineEndings(generated);

  if (left === right) return { matches: true, message: '' };

  return {
    matches: false,
    message: [
      'The committed epic-stage register disagrees with the repository.',
      'A hand edit is overwritten and reported, never adopted — the tree is the source of truth.',
      'Run `pnpm register:update` and commit the result.',
      '',
      firstDifference(left, right),
    ].join('\n'),
  };
}
