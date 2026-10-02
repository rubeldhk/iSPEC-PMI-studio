/**
 * `T997j` (EPIC-035) — a passing reproduction test has three ways out, and none
 * of them is automatic.
 *
 * `FR-DFR-044`, `R-035-6`: *a passing reproduction test MUST route to an
 * evidence check with three available paths — refine the test, investigate
 * further, or reclassify — and MUST NOT reclassify automatically.*
 *
 * ## The inference this exists to refuse
 *
 * The reproduction test passes. The obvious reading is that the defect is not
 * real, so the system reclassifies it and everyone moves on. That reading is
 * wrong often enough to matter: the test may reproduce the wrong thing, the
 * defect may be intermittent (`FR-DFR-031`), or the environment may differ from
 * the one it was reported in.
 *
 * A system that reclassifies on a green run is not reasoning. It is guessing —
 * and guessing in the direction that closes work, which is the direction
 * nobody pushes back on.
 *
 * ## Required, with no default
 *
 * Not `path?: EvidenceCheckPath` defaulting to `reclassify`, and not a pair of
 * booleans where "neither set" means something. **A path taken by omission is a
 * decision nobody made**, and the whole requirement is that somebody makes it.
 *
 * This module exports types and a frozen vocabulary. It exports **no function**:
 * a verb here would be the automatic path arriving where nobody looks for it.
 */

export const EVIDENCE_CHECK_PATHS = Object.freeze([
  'refine-the-test',
  'investigate-further',
  'reclassify',
] as const);

export type EvidenceCheckPath = (typeof EVIDENCE_CHECK_PATHS)[number];

export interface EvidenceCheck {
  readonly id: string;
  readonly defectId: string;
  /** The test whose passing run raised this check. */
  readonly testId: string;
  /** One of three. Required — see the header. */
  readonly path: EvidenceCheckPath;
  /**
   * Who chose it.
   *
   * A path with no chooser is an automatic reclassification wearing a person's
   * clothes, which is exactly what `FR-DFR-044` forbids.
   */
  readonly chosenBy: string;
  /** What was weighed, so a later reader can tell whether it still holds. */
  readonly reason: string;
  readonly chosenAt: Date;
}
