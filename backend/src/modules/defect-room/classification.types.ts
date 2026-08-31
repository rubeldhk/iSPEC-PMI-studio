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
  /** `null` records that no approved behaviour exists — `FR-DFR-021`. */
  readonly contestedBehaviourRef: string | null;
  /**
   * `FR-DFR-024` — the version the defect was reported against.
   *
   * Kept even when the artifact has moved on. A defect re-targeted at current
   * silently would be answering a question about behaviour nobody reported.
   */
  readonly reportedAgainstVersion: string;
  /** `FR-DFR-023` — a human. An agent may propose; it may not confirm. */
  readonly classifiedBy: string;
  readonly classifiedByKind: string;
  readonly rationale: string;
  /**
   * `FR-DFR-025` — set when this classification supersedes an earlier one.
   *
   * A reclassification is recorded, never a deletion (`ADR-0016`): that a
   * defect was once read differently is part of how the current reading earned
   * its standing.
   */
  readonly reclassifiedFrom: string | null;
  readonly classifiedAt: Date;
}
