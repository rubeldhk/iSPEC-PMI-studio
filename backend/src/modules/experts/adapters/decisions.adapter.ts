/**
 * `T2543` (EPIC-047) — `ContractApprovals` over the merged `EPIC-031`
 * decision engine. Supersedes `T1978`.
 *
 * `R-047-5`, `R-047-16`, `FR-EXP-005`, `FR-EXP-054`.
 *
 * - **Submit** builds a real `DecisionRequest`. The project is the workspace
 *   scope (`R-047-16`) unless the caller names one: an Expert contract belongs
 *   to the workspace, so workspace-scoped steering classifies it and
 *   project-scoped steering does not. The submitter is a human `ActorRef` and
 *   also `requestedBy`, so `EPIC-031` refuses self-approval by default
 *   (`FR-DPE-015`). The risk class is **proposed**, never assigned
 *   (`FR-DPE-003`). No gates are required here; policy may still add them.
 * - **Resolution** is read through `DecisionService.standing`, which follows a
 *   decision along the records that resolved it. `approved`, `auto-executed`
 *   and `exception` (proceeded under an authorised gate exception) all mean it
 *   was approved; whether **a human** approved it is kept apart (`T2573`), so a
 *   gated assignment can insist on one (`FR-EXP-054`). A decision `EPIC-031`
 *   does not know is a fault, never read as pending.
 * - **A refusal without evaluation is not a decision** (`T2575`). When a source
 *   cannot be read `EPIC-031` refuses fail-closed (`FR-DPE-050`) — sometimes
 *   unable to store even that, answering `'unrecorded'`. Submission then fails
 *   with a 503 naming why, and the caller stores nothing.
 * - **Withdrawal** (`T2577`) resolves a pending decision whose subject is gone.
 */
import type { DecisionOutcome, DecisionRequest, DecisionResult } from '@pmi/decision-contract';
import { GovernanceSeamUnboundError } from '../../../core/errors.js';
import { refusedUnevaluated, UNRECORDED_DECISION } from '../../decision/evaluator.js';
import type { ContractApprovals, Resolution } from '../experts.tokens.js';

/**
 * `R-047-16` — the `projectId` a workspace-scoped decision is made against.
 * `policy_decisions.projectId` is required and carries no foreign key; steering
 * matches it against project-scoped documents, of which none has this id.
 */
export const WORKSPACE_SCOPE = '(workspace)';

export interface DecisionSubmitter {
  decide(request: DecisionRequest): Promise<Pick<DecisionResult, 'decisionId' | 'outcome' | 'explanation'>>;
}

export interface DecisionReads {
  standing(workspaceId: string, decisionId: string): Promise<{ outcome: DecisionOutcome; byHuman: boolean } | null>;
  withdraw(workspaceId: string, decisionId: string, by: string, reason: string): Promise<unknown>;
}

function resolution(outcome: DecisionOutcome, byHuman: boolean): Resolution {
  if (outcome === 'pending' || outcome === 'refused') return outcome;
  return byHuman ? 'approved' : 'approved-unattended';
}

export function decisionApprovals(decisions: DecisionSubmitter, reads: DecisionReads): ContractApprovals {
  return {
    async submit(input) {
      const result = await decisions.decide({
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? WORKSPACE_SCOPE,
        actionType: input.actionType,
        target: { type: input.targetType, id: input.targetId },
        objectVersion: String(input.objectVersion),
        actor: { kind: 'human', id: input.actorId },
        proposedClass: input.riskClass,
        requiredGates: [],
        requestedBy: input.actorId,
      });
      if (result.decisionId === UNRECORDED_DECISION || refusedUnevaluated(result)) {
        const unrecorded = result.decisionId === UNRECORDED_DECISION ? ' (the refusal itself could not be recorded)' : '';
        throw new GovernanceSeamUnboundError(
          `EPIC-031 refused without evaluating, so nothing was submitted — ` +
            `${result.explanation.constraintCited ?? 'no reason was given'}${unrecorded}. ` +
            `Submit again once it can be consulted (FR-DPE-050, R-047-5)`,
        );
      }
      return { decisionId: result.decisionId };
    },
    async resolutionOf(workspaceId, decisionId) {
      const standing = await reads.standing(workspaceId, decisionId);
      if (standing === null) {
        throw new Error(`EPIC-031 has no decision ${decisionId} in this workspace; it cannot be read as pending (R-047-5)`);
      }
      return resolution(standing.outcome, standing.byHuman);
    },
    async withdraw(input) {
      await reads.withdraw(input.workspaceId, input.decisionId, input.actorId, input.reason);
    },
  };
}
