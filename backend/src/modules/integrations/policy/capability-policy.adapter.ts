/**
 * `T2212` (EPIC-039, `R-039-7`) — `CapabilityPolicy` over `EPIC-031`'s decision
 * engine. Unit test: `T2211`.
 *
 * ## When policy is asked
 *
 * `EPIC-031` has no non-recording query: every `decide()` writes a decision. So
 * the Hub asks **when a project configures an adapter** — one decision per
 * configuration version — and reads that decision back at every resolution.
 * Asking per resolution would make every build-status read an approvable
 * action.
 *
 * `decide` gets the action `integration.adapter.use.<Capability>`, the
 * configuration as an opaque target, its version as `objectVersion`
 * (`BR-0005`), and no gates. **No class is proposed**: policy classifies
 * (`FR-DPE-003`), and an action no rule classifies takes the most restrictive
 * band and waits for a person in the Decision Inbox (`FR-DPE-004`). The owner
 * who configured is the requester, so self-approval is refused unless policy
 * names the class (`FR-DPE-015`).
 *
 * ## Reading
 *
 * The status is the decision that resolved this one if there is one, otherwise
 * this decision itself. Nothing is cached, so a later refusal takes effect on
 * the next request. The deciding row's `Explanation` is returned verbatim
 * (`BR-0174`).
 *
 * Two readings fail closed rather than guess, as `EPIC-047`'s
 * `decisions.adapter.ts` does: a decision `EPIC-031` cannot find is a fault,
 * and any outcome that is not an approval — `exception` included, which no
 * gate-free decision can reach — is never read as permitted.
 */
import type { DecisionOutcome, DecisionRequest, DecisionResult, Explanation } from '@pmi/decision-contract';
import type { CapabilityPolicy, PolicyStatusView } from '../integrations.tokens.js';

export const CAPABILITY_ACTION_PREFIX = 'integration.adapter.use.';
export const CONFIGURATION_TARGET_TYPE = 'project-capability-configuration';

/** `EPIC-031`'s `DecisionEngine`, as far as asking needs it. */
export interface PolicyDecisionMaker {
  decide(request: DecisionRequest): Promise<Pick<DecisionResult, 'decisionId'>>;
}

/** `EPIC-031`'s `DecisionRepository`, as far as reading needs it. */
export interface PolicyDecisionReader {
  get(workspaceId: string, id: string): Promise<{ readonly outcome: DecisionOutcome; readonly explanation: Explanation } | null>;
  /** The decision that resolved `id`, if any. */
  resolutionOf(workspaceId: string, id: string): Promise<{ readonly outcome: DecisionOutcome; readonly explanation: Explanation } | null>;
}

function statusOfOutcome(outcome: DecisionOutcome): PolicyStatusView['status'] {
  switch (outcome) {
    case 'approved':
    case 'auto-executed':
      return 'permitted';
    case 'pending':
      return 'pending';
    default:
      // `refused`, `exception`, or an outcome added later: never permitted.
      return 'not-permitted';
  }
}

export function decisionCapabilityPolicy(engine: PolicyDecisionMaker, decisions: PolicyDecisionReader): CapabilityPolicy {
  return {
    async requestDecision(request) {
      const { decisionId } = await engine.decide({
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        actionType: `${CAPABILITY_ACTION_PREFIX}${request.capability}`,
        target: { type: CONFIGURATION_TARGET_TYPE, id: request.configurationId },
        objectVersion: String(request.configVersion),
        actor: { kind: 'human', id: request.actorId },
        requestedBy: request.actorId,
        requiredGates: [],
      });
      return { decisionId };
    },

    async statusOf(workspaceId, decisionId) {
      const decision = await decisions.get(workspaceId, decisionId);
      if (decision === null) {
        throw new Error(
          `EPIC-031 holds no decision ${decisionId} in workspace ${workspaceId}, though a capability configuration records it — ` +
            'a lost decision is a fault, never a pending one (R-039-7)',
        );
      }
      const deciding = (await decisions.resolutionOf(workspaceId, decisionId)) ?? decision;
      return { status: statusOfOutcome(deciding.outcome), explanation: deciding.explanation };
    },
  };
}
