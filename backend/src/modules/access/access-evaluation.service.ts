/**
 * T814 — open-time grant evaluation for review session content
 * (FR-ACC-028a, SC-018).
 *
 * The run snapshot is consistency for MINUTES; a review session sits open
 * for DAYS. Session content is therefore evaluated against the grants held
 * at the moment the session is OPENED — so a revocation takes effect on the
 * reviewer's next open of an already-open session, and the run's snapshot
 * can never re-admit a revoked reviewer.
 */
import type { AccessEnforcementService, QuestionVisibility, RestrictableQuestion } from './access-enforcement.service.js';

export class AccessEvaluationService {
  constructor(private readonly enforcement: AccessEnforcementService) {}

  /**
   * Evaluate what THIS reviewer sees, NOW. Called on every session open —
   * never cached across opens, which is the whole point.
   */
  async visibilityAtOpen(
    workspaceId: string,
    reviewerId: string,
    questions: RestrictableQuestion[],
  ): Promise<QuestionVisibility[]> {
    // Marked restricted rather than omitted (T816): a reviewer must be able
    // to tell a question exists that they cannot act on.
    return this.enforcement.restrictQuestions(workspaceId, reviewerId, questions);
  }
}
