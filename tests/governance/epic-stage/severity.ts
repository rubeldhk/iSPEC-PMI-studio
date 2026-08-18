/**
 * T524 — the severity split (`FR-ESK-016`).
 *
 * Not every finding should stop a build, and deciding that per call site is how
 * the decision drifts. One module, one table, applied everywhere.
 *
 * **What fails the build** — a claim that is wrong, and would be acted on:
 *
 * - a **false Ready**: an Epic shown as ready to implement when it is not;
 * - **register drift**: a committed register disagreeing with the repository,
 *   which is the hand-maintained status this epic exists to replace, returning;
 * - an **expired waiver**: an exception someone is still relying on past its
 *   agreed end.
 *
 * **What reports** — a condition worth seeing that stops nothing:
 *
 * - a **stalled** Epic — true of 25 of 28 today, and blocking on it would put
 *   every build red for a state the register exists to *show*;
 * - a **missing posture** — a governance gap, not a broken artifact;
 * - **out-of-order artifacts** — real, informative, and nobody's build to stop.
 *
 * The reasoning is `governance/README.md`'s: a check that blocks unrelated work
 * for a condition people cannot immediately fix trains them to silence it, and a
 * silenced check costs more than the signal it was giving.
 *
 * Not a `.spec.ts`, so vitest never collects it.
 */

export type Severity = 'report' | 'fail';

/** Every finding kind this epic produces, and what it costs. */
export const SEVERITY_BY_KIND = {
  /** An Epic directory with no spec.md — a mistake, but not a false claim. */
  invalidEpicDirectory: 'report',
  /** Evidence above a gap. Informative; the stage already refuses to count it. */
  outOfOrderArtifact: 'report',
  /** A declaration that names nothing, or points at a directory that is gone. */
  malformedDeclaration: 'report',
  /** A waiver missing an owner, a reason, or a valid condition. Grants nothing. */
  malformedWaiver: 'report',
  /** An exception past its agreed end, still being relied on. */
  expiredWaiver: 'fail',
} as const satisfies Record<string, Severity>;

export type FindingKind = keyof typeof SEVERITY_BY_KIND;

/**
 * The severity for a finding kind.
 *
 * Exhaustive by construction: `FindingKind` is derived from the table, so a new
 * kind cannot be raised without deciding what it costs.
 */
export function severityOf(kind: FindingKind): Severity {
  return SEVERITY_BY_KIND[kind];
}

/** Does anything here stop the build? */
export function hasBlocking(findings: readonly { severity: Severity }[]): boolean {
  return findings.some((finding) => finding.severity === 'fail');
}
