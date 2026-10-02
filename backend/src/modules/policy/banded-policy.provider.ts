/**
 * `T1199` (EPIC-031, scoped) — the `PolicyProvider` the loop and the Rooms call.
 *
 * `EPIC-030` declares this port and `ROOM_PORTS` marks it `absent: 'refuse'`.
 * Nothing had ever bound it, so `DecisionService.decide` threw before recording
 * anything and `SC-RQR-008` was unreachable — `DEF-033-002`.
 *
 * ## What each band means here
 *
 * `FR-DPE-010`, and no more than it says:
 *
 * - **low** — may proceed. The band a tenant declares for routine actions.
 * - **medium** — requires the required gates to be **satisfied**, and
 *   `FR-DPE-013` is explicit that *satisfied is not reachable by omission*: an
 *   unevaluated gate refuses exactly like a failed one.
 * - **high** — requires an authorized human. An automation is refused outright,
 *   whatever it holds.
 *
 * ## The unconfigured case is the important one
 *
 * With no rules declared, `classify` returns **high** (`FR-DPE-004`), so this
 * provider refuses every automated action and permits a human only where a human
 * is the authority the band asks for. An empty policy is therefore restrictive,
 * not permissive — the failure `FR-GEL-062` exists to prevent.
 *
 * ## What this slice does NOT do
 *
 * No approval queue, no Decision Inbox, no escalation, no auto-execution
 * (`FR-DPE-016` is not exercised because nothing here auto-executes), and no
 * risk *proposal* from an Engineering Expert (`FR-DPE-003`'s second half).
 * Those are the rest of `EPIC-031` and remain open.
 */
import { randomUUID } from 'node:crypto';
import { classify, type Band, type ClassificationRule } from './classification.js';

/** What the loop passes. Structural, so this module needs no `@pmi/loop-contract`. */
export interface PolicyDecisionRequest {
  readonly object: { readonly workflowType: string; readonly objectId: string };
  readonly toStage: string;
  readonly actor: { readonly kind: 'human' | 'automation'; readonly id: string };
}

export interface PolicyDecisionResult {
  readonly permitted: boolean;
  readonly decisionId: string;
  readonly explanation: string;
}

/** Where declared rules come from. Steering supplies these (`FR-DPE-005`). */
export interface ClassificationRuleSource {
  rulesFor(scopePath: string): Promise<readonly ClassificationRule[]>;
}

/** Whether the gates a medium-band action requires are satisfied. */
export interface GateSatisfactionSource {
  /** **`null` means unevaluated**, which `FR-DPE-013` treats as not satisfied. */
  satisfiedFor(objectId: string): Promise<boolean | null>;
}

export interface PolicyContext {
  /** The scope the action happens in, for rule resolution. */
  readonly scopePath: string;
  /** Who requested the thing being approved, when that is known. */
  readonly requestedBy?: string | undefined;
  /** `FR-DPE-015` — policy may permit self-approval for an action class. */
  readonly selfApprovalPermitted?: boolean | undefined;
}

export class BandedPolicyProvider {
  constructor(
    private readonly rules: ClassificationRuleSource,
    private readonly gates?: GateSatisfactionSource | undefined,
  ) {}

  async decide(
    request: PolicyDecisionRequest,
    context: PolicyContext,
  ): Promise<PolicyDecisionResult> {
    const decisionId = randomUUID();
    const actionType = `${request.object.workflowType}.${request.toStage.toLowerCase()}`;
    const declared = await this.rules.rulesFor(context.scopePath);
    const classification = classify(
      { actionType, scopePath: context.scopePath },
      declared,
    );

    // `FR-DPE-015`, checked before the band. An approver approving their own
    // request is refused unless policy permits it for this class — and where it
    // is permitted, the permission has to appear in the explanation, so a reader
    // of the record can see that it was deliberate.
    const isSelfApproval =
      context.requestedBy !== undefined && context.requestedBy === request.actor.id;
    if (isSelfApproval && context.selfApprovalPermitted !== true) {
      return {
        permitted: false,
        decisionId,
        explanation:
          `${request.actor.id} requested this and cannot approve it; policy does not permit ` +
          `self-approval for "${actionType}" (FR-DPE-015)`,
      };
    }
    const selfNote = isSelfApproval
      ? ' Policy explicitly permits self-approval for this action class (FR-DPE-015).'
      : '';

    const permitted = await this.#permits(classification.band, request, context);
    return {
      permitted: permitted.permitted,
      decisionId,
      explanation: `${classification.explanation}. ${permitted.because}${selfNote}`,
    };
  }

  async #permits(
    band: Band,
    request: PolicyDecisionRequest,
    context: PolicyContext,
  ): Promise<{ permitted: boolean; because: string }> {
    if (band === 'low') {
      return { permitted: true, because: 'Low band actions may proceed (FR-DPE-010).' };
    }

    if (band === 'medium') {
      // `FR-DPE-013` — an unevaluated gate is not a satisfied one. `null` and
      // `false` are the same answer here, and that is the whole point: the
      // absence of a result must not read as a pass.
      const satisfied = this.gates
        ? await this.gates.satisfiedFor(request.object.objectId)
        : null;
      if (satisfied === true) {
        return {
          permitted: true,
          because: 'Medium band, and the required gates are satisfied (FR-DPE-010).',
        };
      }
      return {
        permitted: false,
        because:
          satisfied === null
            ? 'Medium band, and the required gates are unevaluated — which is not satisfied (FR-DPE-013).'
            : 'Medium band, and a required gate is unsatisfied (FR-DPE-013).',
      };
    }

    // High. `FR-DPE-010` — authorized human approval.
    if (request.actor.kind !== 'human') {
      return {
        permitted: false,
        because:
          `High band requires authorized human approval, and ${request.actor.id} is ` +
          'automation (FR-DPE-010, RULE-03).',
      };
    }
    void context;
    return {
      permitted: true,
      because: 'High band, approved by an authorized human (FR-DPE-010).',
    };
  }
}
