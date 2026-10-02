/**
 * `T406k` (EPIC-034) — the re-plan obligation.
 *
 * **The entity `R-034-2` exists to create**, and the reason is worth stating in
 * full because the shortcut is so available.
 *
 * `FR-CHR-062` asks for re-planning after an approved change.
 * `TaskRegenerationService.regenerate()` exists and would satisfy its wording in
 * one call. It also **replaces** a task list — `replaced: boolean`, *"existing
 * when refused, the new list when replaced"* — and `BR-0154` requires revision
 * **without destroying completed-work history**. So calling it would satisfy the
 * sentence and violate the requirement the sentence cites.
 *
 * `FR-CHR-065` is the clause that forbids the shortcut outright: *re-plan MUST
 * NOT silently discard work already completed.*
 *
 * So this Room **records** what must be re-planned and surfaces it. Executing it
 * is `U-12`'s, and until `U-12` exists the obligation sits in `recorded` where
 * anyone can see it is outstanding.
 *
 * ## There is no execute path, and that is the design
 *
 * This module exports types and nothing callable. `change-room-independence`
 * (`T406l`) asserts the module never imports `TaskRegenerationService`, because
 * a boundary that depends on remembering is not a boundary.
 */

/**
 * `recorded` until `U-12` discharges it.
 *
 * Two states, and neither is `executed`: this Epic has no verb that would
 * produce one. A third state would imply a transition nothing here can make.
 */
export const REPLAN_STATES = Object.freeze(['recorded', 'discharged-by-U-12'] as const);

export type RePlanState = (typeof REPLAN_STATES)[number];

export interface RePlanObligation {
  readonly id: string;
  readonly changeDecisionId: string;
  readonly affectedSpecificationId: string;
  /** What a re-plan must address — prose, because `U-12` will read it. */
  readonly whatMustChange: string;
  readonly why: string;
  readonly state: RePlanState;
}
