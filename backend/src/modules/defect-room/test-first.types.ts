/**
 * `T997h` (EPIC-035) — a fix cannot be accepted without a test that was seen to
 * fail.
 *
 * `FR-DFR-040`, `FR-DFR-041`, `FR-DFR-042`, `ADR-0016`.
 *
 * ## Two ways the requirement gets satisfied on paper
 *
 * **"Does a test exist?"** A test written after the fix, green from its first
 * run, passes that check and demonstrates nothing: it shows the code as
 * written, not the defect as reported. So `firstObservedFailingAt` is
 * **non-optional and non-nullable**. A nullable one would let a test that never
 * failed satisfy a naive existence check, and the `null` would read as *"not
 * recorded yet"* rather than *"this never happened"* — the reading that lets it
 * through.
 *
 * **"The caller will pass the test in."** `FixAcceptance` is a discriminated
 * union whose `accepted: true` arm **carries the `DefectTest`**. Not an
 * optional field checked at runtime — a field somebody forgets to check. An
 * acceptance without the test it rests on does not typecheck.
 *
 * The reason for a type rather than a validator: a validator runs where
 * somebody remembered to call it, and this is the check most worth skipping at
 * six on a Friday when the fix is obviously right. It usually is obviously
 * right. `BR-0054` exists for the times it is not.
 */

export interface DefectTest {
  readonly id: string;
  readonly defectId: string;
  /**
   * `FR-DFR-042` — the behaviour this test contests.
   *
   * Linked to the defect **and** to the behaviour. A test linked only to the
   * defect cannot answer *"what was this supposed to do?"*, which is the
   * question a reader has a year later.
   */
  readonly contestedBehaviourRef: string;
  /** Where the test lives, so a reader can run the thing being cited. */
  readonly reference: string;
  /**
   * When it was **first observed failing**.
   *
   * Required, and not nullable. This is the field the whole requirement rests
   * on: a test that has never been seen to fail proves the code does what it
   * does.
   */
  readonly firstObservedFailingAt: Date;
}

/**
 * `FR-DFR-041` — accepted with its test, or refused with a reason.
 *
 * A discriminated union rather than one shape with optional members, so the two
 * outcomes cannot be mixed and neither can be half-filled.
 */
export type FixAcceptance =
  | {
      readonly accepted: true;
      /** Carried, not referenced. There is no acceptance without it. */
      readonly test: DefectTest;
      readonly acceptedBy: string;
    }
  | {
      readonly accepted: false;
      /**
       * Why it was refused.
       *
       * A refusal is a real outcome and needs its own shape. Reusing the
       * accepted arm with `test: null` is how the null becomes "not recorded
       * yet" and the refusal becomes indistinguishable from an unfinished
       * acceptance.
       */
      readonly reason: string;
    };
