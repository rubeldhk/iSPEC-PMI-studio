/**
 * `T2349` (EPIC-048, `FR-LRN-020`…`025`, `FR-LRN-030`; `R-048-5`, `R-048-12`) —
 * ask `EPIC-031` for a decision on a candidate.
 *
 * The decision is `EPIC-031`'s, including its band, its explanation and its
 * record (`FR-LRN-021`): this Epic keeps no second approval record. It chooses
 * only **which action** to ask about:
 * - `learning.approve.<category>` — the automatic path, only when
 *   `eligibility.ts` finds every condition true;
 * - `learning.review.<kind>` — everything else (`kind` ∈ `candidate`,
 *   `supersede`, `deprecate`, `widen-scope`).
 *
 * **Nothing here approves.** An `auto-executed` answer is handed to the
 * resolution path (`materialiser.ts`), where the approver guard judges it like
 * any other. A refused request stays `proposed` with `EPIC-031`'s explanation;
 * an unreachable engine stays `proposed` with `decision-path-unavailable`
 * (`FR-LRN-030`).
 *
 * Framework-free (PC-1).
 */
import { eligibilityOf } from './eligibility.js';
import { EvidenceView } from './evidence.view.js';
import type { LearningPolicyReader } from './learning-policy.js';
import type { CandidateRecord, LearningStore } from './learning.store.js';
import type { LearningDecisionRequest, LearningPorts, ResolutionView } from './learning.tokens.js';
import { findConflict, type DecisionRequestOutcome, type Eligibility } from './submission.service.js';

export const INTAKE_AUTOMATION = 'learning-intake' as const;
export const INTAKE_RULE = 'learning.candidate-submitted' as const;

/** `R-048-6` as amended for analysis finding `I1`: at most three decisions per candidate. */
export const MAX_DECISION_ATTEMPTS = 3;

export function actionTypeFor(candidate: Pick<CandidateRecord, 'kind' | 'category'>, automatic: boolean): string {
  if (automatic) return `learning.approve.${candidate.category}`;
  return `learning.review.${candidate.kind === 'new' ? 'candidate' : candidate.kind}`;
}

export interface DecisionRequesterDeps {
  readonly store: LearningStore;
  readonly ports: LearningPorts;
  readonly policy: LearningPolicyReader;
  readonly now?: () => Date;
  /** The resolution path (`Materialiser.applyResolution`), for a decision settled on the spot. */
  readonly applyResolution?: (candidate: CandidateRecord, resolution: ResolutionView) => Promise<{ readonly state: string }>;
}

export class DecisionRequester {
  private readonly now: () => Date;
  private readonly evidence: EvidenceView;

  constructor(private readonly deps: DecisionRequesterDeps) {
    this.now = deps.now ?? ((): Date => new Date());
    this.evidence = new EvidenceView(deps.ports);
  }

  /** Eligibility from the record: the policy now, the unfiltered evidence, the conflict. */
  async eligibility(candidate: CandidateRecord, options: { reconciled?: boolean } = {}): Promise<Eligibility> {
    const policy = await this.deps.policy.require(candidate.workspaceId);
    const own = (await this.deps.store.citations(candidate.workspaceId, candidate.id)).filter((c) => c.corroborationId === null);
    const states = (await this.evidence.unfiltered(candidate.workspaceId, own)).map((s) => s.state);
    const conflict = (await findConflict(this.deps.store, candidate)) !== null;
    return eligibilityOf({ policy, candidate, citationStates: states, conflict, ...(options.reconciled ? { reconciled: true } : {}) });
  }

  /** Distinct decisions requested for the candidate so far. */
  async attempts(candidate: CandidateRecord): Promise<number> {
    const transitions = await this.deps.store.transitions(candidate.workspaceId, candidate.id);
    return new Set(transitions.map((t) => t.decisionId).filter((id): id is string => id !== null)).size;
  }

  async request(candidate: CandidateRecord, options: { reconciled?: boolean } = {}): Promise<DecisionRequestOutcome> {
    const ws = candidate.workspaceId;
    const eligibility = await this.eligibility(candidate, options);
    const request: LearningDecisionRequest = {
      workspaceId: ws,
      projectId: candidate.projectId,
      actionType: actionTypeFor(candidate, eligibility.automatic),
      target: { type: 'learning-candidate', id: candidate.id },
      objectVersion: candidate.objectDigest,
      actor: { kind: 'automation', id: INTAKE_AUTOMATION },
      requiredGates: [],
      requestedBy: candidate.sourcePrincipalId,
      triggeredBy: { ruleId: INTAKE_RULE, eventId: candidate.id },
      ...(candidate.proposedBand !== null ? { proposedClass: candidate.proposedBand } : {}),
    };

    let decision;
    try {
      decision = await this.deps.ports.decisions.decide(request);
    } catch {
      // FR-LRN-030 — an unreachable (or unbound) decision path is never an approval.
      await this.transition(candidate, 'proposed', 'decision-path-unavailable', null);
      return { state: 'proposed', reason: 'decision-path-unavailable', eligibility };
    }

    if (decision.outcome === 'refused' || decision.outcome === 'exception') {
      await this.transition(candidate, 'proposed', decision.outcome === 'refused' ? 'decision-refused-by-policy' : 'decision-exception', decision.decisionId);
      return {
        state: 'proposed',
        decisionId: decision.decisionId,
        reason: decision.explanation.summary ?? `refused by policy ${decision.explanation.policyVersion} (${decision.explanation.authorityApplied})`,
        eligibility,
      };
    }

    await this.transition(candidate, 'pending-review', null, decision.decisionId);
    if (decision.outcome === 'pending' || this.deps.applyResolution === undefined) {
      return { state: 'pending-review', decisionId: decision.decisionId, eligibility };
    }

    // Settled on the spot (auto-executed): judged by the approver guard on the
    // resolution path, exactly as a decision resolved in EPIC-031's Inbox is.
    const resolution = await this.deps.ports.decisions.resolutionOf(ws, decision.decisionId);
    if (resolution === null) return { state: 'pending-review', decisionId: decision.decisionId, eligibility };
    const applied = await this.deps.applyResolution(candidate, resolution);
    return { state: applied.state as DecisionRequestOutcome['state'], decisionId: decision.decisionId, eligibility };
  }

  private async transition(candidate: CandidateRecord, state: 'proposed' | 'pending-review', reason: string | null, decisionId: string | null): Promise<void> {
    await this.deps.store.transaction((tx) =>
      tx.appendTransition({ workspaceId: candidate.workspaceId, candidateId: candidate.id, state, reason, decisionId, actorKind: 'platform', actorId: INTAKE_AUTOMATION, at: this.now() }),
    );
  }
}
