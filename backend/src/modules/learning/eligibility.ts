/**
 * `T2347` (EPIC-048, `FR-LRN-022`, `FR-LRN-026`, `FR-LRN-034`, `FR-LRN-036`,
 * `R-048-12`) — may this candidate take the automatic path?
 *
 * **`MP-2`'s target.** `EPIC-031` still assigns the band; this Epic decides
 * whether to *ask* for `learning.approve.<category>` at all. Every condition
 * must hold, and each one that does not is named — the inputs of *"why did this
 * wait for a human?"* are recorded, not reconstructed.
 *
 * Confidence and corroboration are not inputs, deliberately: confidence alone
 * never approves (`FR-LRN-013`), and corroboration never changes eligibility.
 *
 * Framework-free (PC-1).
 */
import type { LearningPolicy } from './learning-policy.js';
import type { ProducedState } from './evidence.view.js';
import type { CandidateRecord } from './learning.store.js';
import type { Eligibility } from './submission.service.js';

export const ELIGIBILITY_CONDITIONS = Object.freeze([
  'category-not-declared-low-risk',
  'scope-not-source-project',
  'evidence-not-verified',
  'conflicts-with-approved-entry',
  'kind-not-new',
  'execution-not-governed',
  'source-invalid',
] as const);
export type EligibilityCondition = (typeof ELIGIBILITY_CONDITIONS)[number];

export interface EligibilityInput {
  readonly policy: LearningPolicy;
  readonly candidate: Pick<CandidateRecord, 'category' | 'kind' | 'projectId' | 'claimedScope' | 'provisional'>;
  /** The **unfiltered** state of the candidate's own citations (`R-048-9`). */
  readonly citationStates: readonly ProducedState[];
  readonly conflict: boolean;
  /** A provisional execution later reconciled as governed (`FR-LRN-063`). */
  readonly reconciled?: boolean;
  /**
   * `T2677`, spec Edge Case *source execution later found invalid*, `FR-LRN-037`
   * — the candidate carries an open `source-invalid` flag. Never automatic.
   */
  readonly sourceInvalid?: boolean;
}

export function eligibilityOf(input: EligibilityInput): Eligibility {
  const failed: EligibilityCondition[] = [];
  const { candidate } = input;

  // FR-LRN-022 / FR-LRN-026 — the explicit category. Never inferred.
  const category = input.policy.category(candidate.category);
  if (category === null || category.lowRisk !== true) failed.push('category-not-declared-low-risk');

  // FR-LRN-022, US3-6 — exactly the source project.
  const scope = candidate.claimedScope;
  if (scope.kind !== 'project' || scope.projectIds[0] !== candidate.projectId) failed.push('scope-not-source-project');

  // FR-LRN-015 — every citation verified; none at all is not verified.
  if (input.citationStates.length === 0 || input.citationStates.some((s) => s !== 'verified')) failed.push('evidence-not-verified');

  // FR-LRN-036.
  if (input.conflict) failed.push('conflicts-with-approved-entry');

  // FR-LRN-034 — supersession, deprecation and widening always take review.
  if (candidate.kind !== 'new') failed.push('kind-not-new');

  // FR-LRN-063.
  if (candidate.provisional && input.reconciled !== true) failed.push('execution-not-governed');

  // T2677, FR-LRN-037 — its source was found invalid after it was submitted.
  if (input.sourceInvalid === true) failed.push('source-invalid');

  return { automatic: failed.length === 0, failedConditions: failed };
}
