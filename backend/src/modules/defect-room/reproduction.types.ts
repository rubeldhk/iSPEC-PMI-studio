/**
 * `T997l` (EPIC-035) — intermittent is a kind of reproducible, not a flag
 * beside it.
 *
 * `FR-DFR-030`–`FR-DFR-033`, `ADR-0016`.
 *
 * ## Why a boolean and a flag is the wrong shape
 *
 * `reproducible: boolean` with `intermittent: boolean` next to it has four
 * states and three meanings. `{ reproducible: false, intermittent: true }` is
 * the one nobody defines — and it is exactly where an intermittent defect lands
 * after a passing run, because the run said false and the flag says it
 * sometimes does not.
 *
 * From there `FR-DFR-031` is unenforceable: the record no longer distinguishes
 * *"did not reproduce this time"* from *"does not reproduce"*, and the second
 * reading closes the defect.
 *
 * So `intermittent` is a **member of the union**. A single passing run cannot
 * move an `intermittent` defect anywhere, because the value already says runs
 * disagree — there is nothing for one more run to add.
 *
 * ## `not-automatable` carries its reason
 *
 * `FR-DFR-043`: the reason MUST be recorded and **the exception MUST be visible
 * and enumerable**. `notAutomatableReason` is nullable, never optional: `null`
 * is a stated *"no exception here"*, and an absent key is a question nobody
 * asked. The database CHECK pairs with it, so the exception can be counted.
 *
 * ## Evidence is held by reference
 *
 * `FR-DFR-032`, `FR-DFR-033`: through `EPIC-032`'s store, readable only under
 * the access rules of the artifact it concerns (`BR-0062`). There is no
 * payload, content or attachment field here — a Room-local attachment mechanism
 * would be a second copy of somebody's data under this Room's access rules
 * rather than the artifact's, which is how a reproduction HAR containing a
 * session token becomes readable by everyone who can see defects.
 */

export const REPRODUCIBILITY = Object.freeze([
  'always',
  'intermittent',
  'not-reproduced',
  'not-automatable',
] as const);

export type Reproducibility = (typeof REPRODUCIBILITY)[number];

export interface Reproduction {
  readonly id: string;
  readonly defectId: string;
  readonly reproducible: Reproducibility;
  /** `FR-DFR-030` — where it was observed. */
  readonly environment: string;
  /** `FR-DFR-032` — ids into `EPIC-032`. Never inline content. */
  readonly evidenceRefs: readonly string[];
  /** `FR-DFR-030` — the behaviour affected, so the report has a subject. */
  readonly affectedBehaviourRef: string;
  /**
   * `FR-DFR-043` — required exactly when `reproducible` is `not-automatable`.
   *
   * Nullable, never optional. The exception has to be countable.
   */
  readonly notAutomatableReason: string | null;
  readonly observedAt: Date;
}
