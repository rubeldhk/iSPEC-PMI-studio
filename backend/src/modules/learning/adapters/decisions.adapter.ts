/**
 * `T2391` (EPIC-048, Phase 9, `R-048-5`, `R-048-7`) — `LearningDecisions` over
 * `EPIC-031`'s `DecisionEngine`.
 *
 * `decide`, `approve`, `refuse` and `resolutionOf` (`A-031-3`) pass straight to
 * the engine. Nothing is classified, authorised or concluded here: this Epic's
 * own fences — eligibility and the approver guard — judge what the engine
 * answers, never instead of it.
 *
 * ## A refused attempt is not a resolution
 *
 * The engine answers an approval or closure it will not record (self-approval,
 * `FR-DPE-015`; an automation approving, `FR-DPE-010`; a requester rejecting,
 * `FR-DPE-017`) with outcome `refused` **and no resolving row** — the decision
 * stays pending for someone entitled to decide it. Handing that back as a
 * `refused` resolution would reject the candidate on the strength of an
 * unauthorised attempt. So the adapter reads the resolution back after every
 * approve and refuse: none recorded ⇒ `403` with the engine's own reason.
 *
 * ## Reading a resolution
 *
 * The resolving row if there is one; otherwise `null` while the request is
 * pending, or the request itself when it was concluded on the spot
 * (`auto-executed`, `refused`). A decision the engine does not hold is a
 * fault, never read as pending.
 *
 * Framework-free (PC-1).
 */
import type { DecisionRequest, DecisionResult, Explanation } from '@pmi/decision-contract';
import { ForbiddenError, NotFoundError } from '../../../core/errors.js';
import type { DecisionRecord } from '../../decision/decision.repository.js';
import type { DecisionEngine } from '../../decision/evaluator.js';
import type { DecisionExplanation, LearningDecisionRequest, LearningDecisionsPort, ResolutionView } from '../learning.tokens.js';

/** `EPIC-031`'s engine, as far as this Epic needs it. */
export type DecisionEnginePort = Pick<DecisionEngine, 'decide' | 'approve' | 'refuse' | 'resolutionOf'>;

/** `EPIC-031`'s repository, for the requested decision itself. */
export interface DecisionLookup {
  get(workspaceId: string, id: string): Promise<DecisionRecord | null>;
}

function explanationOf(explanation: Explanation): DecisionExplanation {
  const summary = explanation.constraintCited ?? explanation.closure?.reason;
  return {
    policyVersion: explanation.policyVersion,
    matchedRule: explanation.matchedRule === null ? null : `${explanation.matchedRule.lineageId}@v${explanation.matchedRule.version}`,
    riskClass: explanation.riskClass,
    authorityApplied: explanation.authorityApplied,
    ...(summary !== undefined ? { summary } : {}),
  };
}

function viewOf(requested: DecisionRecord, resolving: DecisionRecord | null): ResolutionView {
  const row = resolving ?? requested;
  if (row.outcome === 'pending') throw new Error(`decision ${row.id} is pending, not a resolution`);
  const closure = row.explanation.closure;
  return {
    decisionId: requested.id,
    resolvingDecisionId: resolving === null ? null : resolving.id,
    outcome: row.outcome,
    actorKind: row.actorKind,
    decidedBy: row.decidedBy ?? row.actorId,
    actionType: requested.actionType,
    requestedBy: requested.requestedBy,
    ...(closure !== undefined ? { closure: { kind: closure.kind, reason: closure.reason } } : {}),
    effectiveClass: row.effectiveClass,
    explanation: explanationOf(row.explanation),
  };
}

export function decisionsAdapter(engine: DecisionEnginePort, decisions: DecisionLookup): LearningDecisionsPort {
  const resolutionOf = async (workspaceId: string, decisionId: string): Promise<ResolutionView | null> => {
    const requested = await decisions.get(workspaceId, decisionId);
    if (requested === null) {
      throw new NotFoundError(`EPIC-031 holds no decision ${decisionId} in this workspace; it is not read as pending.`);
    }
    const resolving = await engine.resolutionOf(workspaceId, decisionId);
    if (resolving !== null) return viewOf(requested, resolving);
    return requested.outcome === 'pending' ? null : viewOf(requested, null);
  };

  /** The resolution an approve/refuse produced — or the engine's refusal of the attempt, as 403. */
  const recorded = async (workspaceId: string, decisionId: string, result: DecisionResult): Promise<ResolutionView> => {
    const resolution = await resolutionOf(workspaceId, decisionId);
    if (resolution === null) {
      throw new ForbiddenError(result.explanation.authorityApplied, { decisionId });
    }
    return resolution;
  };

  return {
    async decide(request: LearningDecisionRequest) {
      // The request is decision-contract's shape (asserted in T2390).
      const asked: DecisionRequest = request;
      const result = await engine.decide(asked);
      return {
        decisionId: result.decisionId,
        outcome: result.outcome,
        effectiveClass: result.effectiveClass,
        actionType: request.actionType,
        explanation: explanationOf(result.explanation),
      };
    },

    async approve(input) {
      const result = await engine.approve(input);
      return recorded(input.workspaceId, input.decisionId, result);
    },

    async refuse(input) {
      const result = await engine.refuse(input);
      return recorded(input.workspaceId, input.decisionId, result);
    },

    resolutionOf,
  };
}
