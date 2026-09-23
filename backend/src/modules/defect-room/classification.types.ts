/**
 * `T997f` (EPIC-035) — triage has three outcomes, and each one has somewhere to
 * go.
 *
 * `FR-DFR-022`, `FR-DFR-077`, `ADR-0016`.
 *
 * ## The third outcome is the one that matters
 *
 * Two outcomes is the shape everybody builds: *is this a bug, or is it a change
 * somebody wants?* The third case — **nobody ever agreed what this should do** —
 * looks like one of the first two from close up, and gets filed as whichever
 * the triager finds less awkward.
 *
 * Filed as a defect it blames the implementation for a decision nobody took,
 * and somebody spends a day "fixing" code to match a behaviour that was never
 * specified. Filed as a change request it invents a baseline to change. Neither
 * is recoverable later, because the record no longer says what actually
 * happened: that the question had never been answered.
 *
 * ## `DESTINATIONS` is a `Record`, and that is `FR-DFR-077`
 *
 * *A `Classification` cannot exist without the destination its outcome maps
 * to.* A `switch` with a `default` compiles happily the day a fourth outcome
 * arrives and routes it wherever the default points — which is where a new
 * outcome goes to die quietly. A total `Record` over the union does not compile
 * until somebody decides where the new one goes, which is the decision the
 * `default` was avoiding.
 *
 * This module holds types and a mapping. It has no verb: routing is
 * `routing.service.ts`'s, and a classification that routed itself would be the
 * triage deciding its own destination.
 */

/** `FR-DFR-022`'s three, in its order. */
export const CLASSIFICATION_OUTCOMES = Object.freeze([
  'confirmed-defect',
  'change-request',
  'requirement-gap',
] as const);

export type ClassificationOutcome = (typeof CLASSIFICATION_OUTCOMES)[number];

/**
 * Where each outcome goes.
 *
 * A `Record` over the whole union, so an outcome without a destination is a
 * compile error rather than a runtime surprise. The strings name the Epic that
 * owns the destination, because a destination nobody can find is not one — the
 * same reasoning `BR-0042` applies to the Requirement Room's refusal.
 */
export const DESTINATIONS: Readonly<Record<ClassificationOutcome, string>> = Object.freeze({
  // Stays here. This Room owns confirmed defects through repair and closure.
  'confirmed-defect': 'EPIC-035 Defect Room',
  // `BR-0057` — the transfer this Room's `FR-DFR-074` hands to the Change Room.
  'change-request': 'EPIC-034 Change Room (POST /rooms/change/transfer-intake)',
  // `FR-DFR-021`'s "or record its absence", routed. A gap held here would be a
  // defect record standing in for a requirement nobody wrote.
  'requirement-gap': 'EPIC-033 Requirement Room (POST /rooms/requirement/gap-intake)',
});

export type Destination = (typeof DESTINATIONS)[ClassificationOutcome];

/**
 * `FR-DFR-020`, `FR-DFR-021`, `FR-DFR-024`, `FR-DFR-025`.
 *
 * `contestedBehaviourRef` is nullable rather than optional: `null` is
 * `FR-DFR-021`'s *"or record its absence"* — a stated finding that no approved
 * behaviour exists, which is precisely what makes the outcome a requirement
 * gap. An absent key would be a question nobody asked.
 */
export interface Classification {
  readonly id: string;
  readonly workspaceId: string;
  readonly defectId: string;
  readonly outcome: ClassificationOutcome;
  /**
   * `FR-DFR-077` — the destination the outcome maps to, stored.
   *
   * Denormalised deliberately, and CHECKed against the outcome in SQL. A
   * classification that had to be joined to a mapping to say where it goes
   * could rest with nowhere to go while looking complete.
   */
  readonly destination: string;
  /** `null` only when the outcome is a requirement gap — CHECKed. */
  readonly approvedBehaviourRef: string | null;
  /** `FR-DFR-021` — the absence is RECORDED, not left blank. */
  readonly absenceRecorded: boolean;
  readonly classifiedBy: string;
  /** `FR-DFR-023` — `human` for a confirmed defect, and the database agrees. */
  readonly classifiedByKind: string;
  /** `FR-DFR-023` — an agent may propose; the confirming actor must be human. */
  readonly proposedByAgent: boolean;
  /**
   * `FR-DFR-025` — set on the row this one replaced, when it is replaced.
   *
   * A forward pointer on the OLD row, matching the shape `EPIC-033` uses for a
   * superseded baseline: the row stands, and only this field moves. The
   * substance is never rewritten, because an updated row destroys the same
   * history a deleted one does, more quietly.
   */
  readonly supersededByClassificationId: string | null;
  readonly reclassifiedAt: Date | null;
  /**
   * `FR-DFR-024` — which version this classification judged.
   *
   * **`null` means the version reported on the defect**, which is where that
   * answer lives and the only place it lives. A value means this classification
   * deliberately judged a later version — the re-evaluation half of *"recorded
   * against the version reported and re-evaluated against current"*.
   *
   * Nullable rather than always-populated because the alternative is a copy of
   * `DefectRow.contestedArtifactVersion` on every first triage, and a copy is a
   * second place the same answer lives.
   */
  readonly evaluatedAgainstVersion: string | null;
  readonly rationale: string;
  readonly createdAt: Date;
}
