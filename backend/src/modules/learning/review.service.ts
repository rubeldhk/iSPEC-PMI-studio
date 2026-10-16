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
import { isNarrowerOrEqual, isStrictlyWider, parseScope, type ClaimedScope } from '@pmi/learning-contract';
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

export interface RetrievabilityView {
  readonly outcome: 'retrievable' | 'not-yet-retrievable';
  readonly reason: string | null;
}

/** What the review route answers: the resolution, and — for an approval — whether it can be retrieved yet. */
export type ReviewResult = ApplyResult & { readonly retrievability?: RetrievabilityView };

/** `FR-LRN-053` — the latest attempt, or *not yet retrievable — indexing not attempted*; never retrievable by default. */
export async function retrievabilityOf(store: Pick<LearningStore, 'latestRetrievability'>, workspaceId: string, versionId: string): Promise<RetrievabilityView> {
  const latest = await store.latestRetrievability(workspaceId, versionId);
  return latest === null ? { outcome: 'not-yet-retrievable', reason: 'indexing not attempted' } : { outcome: latest.outcome, reason: latest.reason };
}

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
    const applied = await this.deps.materialiser.applyResolution(workspaceId, candidateId, resolution);
    if (applied.state !== 'approved' || applied.versionId === undefined) return applied;
    return { ...applied, retrievability: await retrievabilityOf(store, workspaceId, applied.versionId) };
  }

  /**
   * `FR-LRN-030` (T2361) — the submitter withdraws their own candidate. A pending
   * decision is closed first by the requesting automation (`A-031-1`, kind
   * `withdrawn`), so the item leaves the Inbox; then the candidate reads
   * `withdrawn`, attributed to the person. Only a person's own candidate: an
   * agent's is not a session user's to withdraw.
   */
  async withdraw(workspaceId: string, userId: string, candidateId: string): Promise<{ state: 'withdrawn' }> {
    const { store } = this.deps;
    const candidate = await store.candidate(workspaceId, candidateId);
    if (candidate === null) throw new NotFoundError('Not found.');
    const current = await store.currentTransition(workspaceId, candidateId);
    if (current === null || !['proposed', 'pending-review'].includes(current.state)) {
      throw new ConflictError(`Candidate ${candidateId} is ${current?.state ?? 'unknown'}; only an open candidate can be withdrawn.`);
    }
    if (candidate.sourceKind !== 'person' || candidate.sourcePrincipalId !== userId) {
      throw new ForbiddenError('Only the person who submitted a candidate may withdraw it.');
    }
    if (current.state === 'pending-review' && current.decisionId !== null) {
      await this.deps.ports.decisions.refuse({ workspaceId, decisionId: current.decisionId, by: { kind: 'automation', id: 'learning-intake' }, kind: 'withdrawn', reason: `withdrawn by the submitter ${userId}` });
    }
    await store.transaction((tx) =>
      tx.appendTransition({ workspaceId, candidateId, state: 'withdrawn', reason: 'withdrawn by the submitter', decisionId: current.decisionId, actorKind: 'human', actorId: userId, at: this.now() }),
    );
    return { state: 'withdrawn' };
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
    // T2682, FR-LRN-042 — a widen-scope approval must still widen: narrowing it back
    // to (or inside) the version it widens would record a widening that widens nothing.
    if (candidate.kind === 'widen-scope' && candidate.targetVersionId !== null) {
      const target = await this.deps.store.version(candidate.workspaceId, candidate.targetVersionId);
      if (target !== null && !isStrictlyWider(scope, target.scope)) {
        throw new ValidationFailedError('A widen-scope approval must be strictly wider than the version it widens (FR-LRN-042); narrow it less, or reject it.', {
          field: 'scope',
          currentScope: target.scope,
        });
      }
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
