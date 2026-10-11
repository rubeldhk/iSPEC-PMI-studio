/**
 * `T1978` (EPIC-047) — `ContractApprovals` over `EPIC-031`'s decision engine.
 *
 * `R-047-5`, `FR-EXP-005`. Approval is `EPIC-031`'s decision; this module only
 * asks for one and reads it back.
 *
 * ## Submitting
 *
 * `decide` with the action type, the version as an opaque target, the version
 * number as `objectVersion` (`BR-0005`) and the contract's risk class as
 * `proposedClass` — a proposal, never an assignment (`FR-DPE-003`): policy
 * classifies, and an action no rule classifies takes the most restrictive band
 * and waits for an authorized human (`FR-DPE-004`, `FR-DPE-010`). The author is
 * `requestedBy`, so self-approval is refused unless policy names the class
 * (`FR-DPE-015`). No gates are required, so no gate exception can resolve one.
 *
 * ## Reading
 *
 * There is no callback, so nothing is cached. The resolution is the decision
 * that resolved this one if there is one, otherwise this decision itself:
 * concluded outright (`auto-executed`, `refused`) or still `pending`.
 *
 * Two readings fail closed rather than guess:
 *
 * - A decision this module recorded that `EPIC-031` cannot find is a fault.
 *   Reading it as *pending* would hide a lost record behind a plausible state.
 * - `exception` has no word in the approval vocabulary. It is unreachable here,
 *   since an exception resolves a refused decision with a required gate and
 *   these require none — so meeting it means the assumption broke, and it is
 *   never read as *approved*.
 *
 * ## The project a decision names
 *
 * Every `EPIC-031` decision names a project. An Expert belongs to its
 * workspace, not to a project (`FR-EXP-008`), so the decision is scoped
 * `workspace:<id>` — matched by no project-scoped steering rule, which is the
 * intended reading, and never mistaken for a real project id. `EPIC-031` has
 * no workspace-scoped decision; this is the gap, stated where it is crossed.
 *
 * ## Added by the Phase 16–17 convergence (`R-047-17`)
 *
 * - **Who approved it** (`T2573`). An approval that resolves a pending decision
 *   was given by a human — `EPIC-031`'s `approve` admits no other. One taken
 *   outright (`auto-executed`, or `approved` by gates alone) had no human, and
 *   reads `approved-unattended`: a contract version stands on it, a gated
 *   assignment (`FR-EXP-054`) does not.
 * - **A rejection is not a policy refusal** (`T2575`). A closure of kind
 *   `rejected` (`FR-DPE-017`) is a human's judgement and reads `rejected`; a
 *   version is resubmitted after a policy refusal or a withdrawal, never after
 *   one.
 * - **A refusal without evaluation is not a decision** (`T2575`). When a source
 *   cannot be read `EPIC-031` refuses fail-closed (`FR-DPE-050`), sometimes
 *   unable to store even that (`'unrecorded'`). Submission then fails with a
 *   503 naming why, and the caller stores nothing.
 * - **Withdrawal** (`T2577`, `T2602`) closes a pending decision through
 *   `refuse`: `withdrawn` when the requester takes it back, `rejected` when
 *   another human supersedes it (a reassignment by someone else).
 */
import type { ActorRef, ClosureKind, DecisionOutcome, DecisionRequest, DecisionResult } from '@pmi/decision-contract';
import { GovernanceSeamUnboundError } from '../../../core/errors.js';
import { FAIL_CLOSED, UNRECORDED_DECISION } from '../../decision/evaluator.js';
import type { ContractApprovals, Resolution } from '../experts.tokens.js';

/** The scope a workspace-level decision names in `EPIC-031`'s `projectId`. */
export const WORKSPACE_DECISION_SCOPE = (workspaceId: string): string => `workspace:${workspaceId}`;

/** `EPIC-031`'s `DecisionEngine`, as far as submitting and withdrawing need it. */
export interface DecisionMaker {
  decide(
    request: DecisionRequest,
  ): Promise<Pick<DecisionResult, 'decisionId'> & Partial<Pick<DecisionResult, 'outcome' | 'explanation'>>>;
  refuse?(input: {
    workspaceId: string;
    decisionId: string;
    by: ActorRef;
    kind: ClosureKind;
    reason: string;
  }): Promise<Pick<DecisionResult, 'explanation'>>;
}

/** What this adapter reads of a decision record. */
interface DecisionRow {
  readonly outcome: DecisionOutcome;
  readonly resolvesDecisionId?: string | null;
  readonly requestedBy?: string | null;
  readonly actorId?: string;
  readonly explanation?: { readonly closure?: { readonly kind: string } };
}

/** `EPIC-031`'s `DecisionRepository`, as far as reading a resolution needs it. */
export interface DecisionReader {
  get(workspaceId: string, id: string): Promise<DecisionRow | null>;
  /** The decision that resolved `id`, if any. */
  resolutionOf(workspaceId: string, id: string): Promise<DecisionRow | null>;
}

function asResolution(standing: DecisionRow, resolved: boolean, decisionId: string): Resolution {
  const { outcome } = standing;
  switch (outcome) {
    case 'pending':
      return 'pending';
    case 'approved':
      // Only `approve` resolves a pending decision as approved, and it admits only a human.
      return resolved ? 'approved' : 'approved-unattended';
    case 'auto-executed':
      return 'approved-unattended';
    case 'refused':
      return standing.explanation?.closure?.kind === 'rejected' ? 'rejected' : 'refused';
    default:
      // `exception`, or any outcome added later: never approval by default.
      throw new Error(
        `decision ${decisionId} ended '${outcome}', which is not an approval of an Expert contract — ` +
          'read as neither approved nor refused (FR-EXP-005)',
      );
  }
}

export function decisionApprovals(engine: DecisionMaker, decisions: DecisionReader): ContractApprovals {
  return {
    async submit(input) {
      const result = await engine.decide({
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? WORKSPACE_DECISION_SCOPE(input.workspaceId),
        actionType: input.actionType,
        target: { type: input.targetType, id: input.targetId },
        objectVersion: String(input.objectVersion),
        actor: { kind: 'human', id: input.actorId },
        requestedBy: input.actorId,
        proposedClass: input.riskClass,
        requiredGates: [],
      });
      const cited = result.explanation?.constraintCited ?? '';
      const unrecorded = result.decisionId === UNRECORDED_DECISION;
      if (unrecorded || (result.outcome === 'refused' && cited.startsWith(FAIL_CLOSED))) {
        throw new GovernanceSeamUnboundError(
          `EPIC-031 refused without evaluating, so nothing was submitted — ${cited || 'no reason was given'}` +
            `${unrecorded ? ' (the refusal itself could not be recorded)' : ''}. ` +
            'Submit again once it can be consulted (FR-DPE-050, R-047-5)',
        );
      }
      return { decisionId: result.decisionId };
    },

    async resolutionOf(workspaceId, decisionId) {
      const decision = await decisions.get(workspaceId, decisionId);
      if (decision === null) {
        throw new Error(
          `EPIC-031 holds no decision ${decisionId} in workspace ${workspaceId}, though a contract version records it — ` +
            'a lost decision is a fault, never a pending one (R-047-5)',
        );
      }
      const resolved = await decisions.resolutionOf(workspaceId, decisionId);
      return asResolution(resolved ?? decision, resolved !== null, decisionId);
    },

    async withdraw(input) {
      if (engine.refuse === undefined) throw new Error('EPIC-031 offers no way to close a decision here');
      const decision = await decisions.get(input.workspaceId, input.decisionId);
      if (decision === null) throw new Error(`EPIC-031 holds no decision ${input.decisionId}`);
      const requester = decision.requestedBy ?? decision.actorId;
      const closed = await engine.refuse({
        workspaceId: input.workspaceId,
        decisionId: input.decisionId,
        by: { kind: 'human', id: input.actorId },
        kind: requester === input.actorId ? 'withdrawn' : 'rejected',
        reason: input.reason,
      });
      if (closed.explanation.closure === undefined) {
        throw new Error(`EPIC-031 did not close ${input.decisionId}: ${closed.explanation.authorityApplied}`);
      }
    },
  };
}
