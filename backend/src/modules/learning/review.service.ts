/**
 * `T2355` (EPIC-048, `FR-LRN-027`…`029`; `R-048-6` layer 1) — a person decides a
 * candidate through this Epic's review route.
 *
 * - **Who**: a human session only — never the connector guard — and never one
 *   of the candidate's AI source identities. `EPIC-028` says what an id is; an
 *   id it cannot place is not a human. A refused attempt is audited and leaves
 *   the decision pending.
 * - **Approve**: the reviewer's terms (statement, scope ⊆ claimed,
 *   classification) are written **before** `EPIC-031`'s `approve`, so a crash
 *   between the two loses nothing; the resolution then goes to the materialiser,
 *   whose approver guard judges it like any other.
 * - **Reject**: a reason is required; `EPIC-031` refuses the decision
 *   (`A-031-1`) and the candidate reads `rejected` with reviewer and reason.
 *
 * Separation of duties between people is `EPIC-031`'s (`selfApprovalAllowed`):
 * its refusal is passed through, not re-implemented.
 *
 * Framework-free (PC-1).
 */
import { isNarrowerOrEqual, parseScope, type ClaimedScope } from '@pmi/learning-contract';
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { aiSourceIdentities } from './approver.guard.js';
import type { LearningPolicyReader } from './learning-policy.js';
import { newLearningId, type CandidateRecord, type LearningStore } from './learning.store.js';
import type { LearningPorts } from './learning.tokens.js';
import type { ApplyResult, Materialiser } from './materialiser.js';

export interface ReviewDeps {
  readonly store: LearningStore;
  readonly ports: Pick<LearningPorts, 'principals' | 'decisions' | 'audit'>;
  readonly policy: LearningPolicyReader;
  readonly materialiser: Pick<Materialiser, 'applyResolution'>;
  readonly now?: () => Date;
}

export type ReviewResult = ApplyResult;

export class ReviewService {
  private readonly now: () => Date;

  constructor(private readonly deps: ReviewDeps) {
    this.now = deps.now ?? ((): Date => new Date());
  }

  async review(workspaceId: string, reviewerId: string, candidateId: string, body: unknown): Promise<ReviewResult> {
    const { store } = this.deps;
    const candidate = await store.candidate(workspaceId, candidateId);
    if (candidate === null) throw new NotFoundError('Not found.');
    const current = await store.currentTransition(workspaceId, candidateId);
    if (current?.state !== 'pending-review' || current.decisionId === null) {
      throw new ConflictError(`Candidate ${candidateId} is ${current?.state ?? 'unknown'}; only a candidate pending review can be decided.`, { state: current?.state ?? null });
    }
    const decisionId = current.decisionId;

    await this.assertHumanReviewer(candidate, reviewerId, decisionId);

    const raw = (body ?? {}) as Record<string, unknown>;
    if (raw['decision'] === 'reject') {
      const reason = raw['reason'];
      if (typeof reason !== 'string' || reason.trim() === '') {
        throw new ValidationFailedError('A rejection states its reason (FR-LRN-029).', { field: 'reason' });
      }
      const resolution = await this.deps.ports.decisions.refuse({ workspaceId, decisionId, by: { kind: 'human', id: reviewerId }, kind: 'rejected', reason: reason.trim() });
      return this.deps.materialiser.applyResolution(workspaceId, candidateId, resolution);
    }
    if (raw['decision'] !== 'approve') {
      throw new ValidationFailedError('decision must be "approve" or "reject".', { field: 'decision' });
    }

    const terms = await this.terms(candidate, raw);
    await this.recordTerms(candidate, decisionId, reviewerId, terms);
    // EPIC-031 decides whether this person may approve (incl. self-approval, FR-DPE-015).
    const resolution = await this.deps.ports.decisions.approve({ workspaceId, decisionId, approver: { kind: 'human', id: reviewerId } });
    return this.deps.materialiser.applyResolution(workspaceId, candidateId, resolution);
  }

  /** `R-048-6` layer 1 — a person, and not one of the candidate's AI sources. Refusals are audited. */
  private async assertHumanReviewer(candidate: CandidateRecord, reviewerId: string, decisionId: string): Promise<void> {
    // 503 naming Principals while unbound: an approver whose kind is unknown is not a human.
    const kind = await this.deps.ports.principals.kindOf(candidate.workspaceId, reviewerId);
    const corroborations = await this.deps.store.corroborations(candidate.workspaceId, candidate.id);
    let why: string | null = null;
    if (kind !== 'human') why = `the reviewer ${reviewerId} is ${kind === null ? 'not a user of this workspace' : `a ${kind} principal`}`;
    else if (aiSourceIdentities(candidate, corroborations).has(reviewerId)) why = `the reviewer ${reviewerId} is one of the candidate's own AI sources`;
    if (why === null) return;
    await this.deps.ports.audit.record({
      workspaceId: candidate.workspaceId,
      actorId: reviewerId,
      action: 'access_refused',
      targetType: 'learning_candidate',
      targetId: candidate.id,
      outcome: 'refused',
      detail: { decisionId, reason: why },
    });
    throw new ForbiddenError(`Refused: ${why}. An AI never approves or rejects a learning candidate (FR-LRN-027); the decision stays pending.`);
  }

  private async terms(candidate: CandidateRecord, raw: Record<string, unknown>): Promise<{ statement: string; scope: ClaimedScope; classification: string }> {
    let statement = candidate.statement;
    if (raw['statement'] !== undefined) {
      if (typeof raw['statement'] !== 'string' || raw['statement'].trim() === '') throw new ValidationFailedError('statement, when edited, may not be empty.', { field: 'statement' });
      statement = raw['statement'];
    }
    let scope = candidate.claimedScope;
    if (raw['scope'] !== undefined) {
      const parsed = parseScope(raw['scope']);
      if (!parsed.ok) throw new ValidationFailedError(`scope: ${parsed.problem}.`, { field: 'scope' });
      if (!isNarrowerOrEqual(parsed.value, candidate.claimedScope)) {
        throw new ValidationFailedError('The approved scope may narrow the claimed scope and never widen it (FR-LRN-028); widening is its own candidate (FR-LRN-042).', {
          field: 'scope',
          claimedScope: candidate.claimedScope,
        });
      }
      scope = parsed.value;
    }
    let classification: string | undefined;
    if (raw['classification'] !== undefined) {
      if (typeof raw['classification'] !== 'string' || raw['classification'].trim() === '') throw new ValidationFailedError('classification, when set, may not be empty.', { field: 'classification' });
      classification = raw['classification'];
    }
    if (classification === undefined) {
      const policy = await this.deps.policy.current(candidate.workspaceId);
      classification = (policy.state === 'ok' ? policy.policy.category(candidate.category)?.defaultClassification : undefined) ?? 'undetermined';
    }
    return { statement, scope, classification };
  }

  /** Written before `approve`. An identical retry reuses them; different terms for one decision are a conflict. */
  private async recordTerms(candidate: CandidateRecord, decisionId: string, reviewerId: string, t: { statement: string; scope: ClaimedScope; classification: string }): Promise<void> {
    const existing = await this.deps.store.reviewTerms(candidate.workspaceId, candidate.id, decisionId);
    if (existing !== null) {
      const same = existing.reviewerId === reviewerId && existing.approvedStatement === t.statement && existing.classification === t.classification && JSON.stringify(existing.approvedScope) === JSON.stringify(t.scope);
      if (same) return;
      throw new ConflictError('Different review terms are already recorded for this decision.', { decisionId });
    }
    await this.deps.store.transaction((tx) =>
      tx.insertReviewTerms({
        id: newLearningId('lrt'),
        workspaceId: candidate.workspaceId,
        candidateId: candidate.id,
        decisionId,
        approvedStatement: t.statement,
        approvedScope: t.scope,
        classification: t.classification,
        reviewerId,
        at: this.now(),
      }),
    );
  }
}
