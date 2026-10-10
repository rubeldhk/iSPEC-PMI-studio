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
 */
import type { DecisionOutcome, DecisionRequest, DecisionResult } from '@pmi/decision-contract';
import type { ContractApprovals, Resolution } from '../experts.tokens.js';

/** The scope a workspace-level decision names in `EPIC-031`'s `projectId`. */
export const WORKSPACE_DECISION_SCOPE = (workspaceId: string): string => `workspace:${workspaceId}`;

/** `EPIC-031`'s `DecisionEngine`, as far as submitting needs it. */
export interface DecisionMaker {
  decide(request: DecisionRequest): Promise<Pick<DecisionResult, 'decisionId'>>;
}

/** `EPIC-031`'s `DecisionRepository`, as far as reading a resolution needs it. */
export interface DecisionReader {
  get(workspaceId: string, id: string): Promise<{ readonly outcome: DecisionOutcome } | null>;
  /** The decision that resolved `id`, if any. */
  resolutionOf(workspaceId: string, id: string): Promise<{ readonly outcome: DecisionOutcome } | null>;
}

function asResolution(outcome: DecisionOutcome, decisionId: string): Resolution {
  switch (outcome) {
    case 'pending':
      return 'pending';
    case 'approved':
    case 'auto-executed':
      return 'approved';
    case 'refused':
      return 'refused';
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
      const { decisionId } = await engine.decide({
        workspaceId: input.workspaceId,
        projectId: WORKSPACE_DECISION_SCOPE(input.workspaceId),
        actionType: input.actionType,
        target: { type: input.targetType, id: input.targetId },
        objectVersion: String(input.objectVersion),
        actor: { kind: 'human', id: input.actorId },
        requestedBy: input.actorId,
        proposedClass: input.riskClass,
        requiredGates: [],
      });
      return { decisionId };
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
      return asResolution((resolved ?? decision).outcome, decisionId);
    },
  };
}
