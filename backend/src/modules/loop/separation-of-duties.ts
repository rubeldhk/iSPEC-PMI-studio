/**
 * T1085 (EPIC-030 Phase C2A) — separation of duties.
 *
 * `FR-GEL-067`. Two rules that look alike and are not:
 *
 * 1. **An AI agent or service may never approve its own proposal.** Absolute.
 *    No tenant policy relaxes it. An agent that can approve its own work is
 *    unsupervised, and a configuration flag that permits it is a hole with a
 *    switch on it.
 * 2. **A human approving their own is organisational policy.** Rev 2 proposed
 *    the blanket rule `approverId !== proposerId`; the project owner rejected
 *    it because it makes a single-approver team unworkable. The default here is
 *    the safe one — a distinct approver — and only humans may be exempted.
 *
 * **Identity is read from the frozen snapshot, never from the actor id alone.**
 * Ids are reassignable and display metadata is mutable; a principal
 * re-registered under a new id must not thereby become a distinct approver.
 *
 * Unit tests: `backend/tests/unit/loop/separation-of-duties.spec.ts` (T1084).
 */
import type {
  AdjudicationProposal,
  ApprovalAttempt,
  RefusalReasonCode,
} from '@pmi/loop-contract';

/** Tenant or project policy. Only the human rule is configurable. */
export interface SeparationPolicy {
  /**
   * Whether a **human** proposer may approve their own proposal.
   *
   * Defaults to `false` everywhere it is not set. There is deliberately no
   * equivalent for agents: see {@link evaluateSeparationOfDuties}.
   */
  readonly humanSelfApprovalPermitted: boolean;
}

export type SeparationVerdict =
  | { readonly permitted: true }
  | {
      readonly permitted: false;
      readonly reason: string;
      /**
       * The typed cause (`X1`). Every separation refusal is stage `approval`;
       * the code distinguishes an absolute agent refusal from a policy one.
       */
      readonly reasonCode: RefusalReasonCode;
    };

/** The policy applied when a tenant has expressed none. */
export const DEFAULT_SEPARATION_POLICY: SeparationPolicy = Object.freeze({
  humanSelfApprovalPermitted: false,
});

/**
 * Decide whether this approval may stand against this proposal.
 *
 * Order matters: the agent rule is evaluated **before** policy is consulted, so
 * no policy value can reach the agent case.
 */
export function evaluateSeparationOfDuties(
  proposal: AdjudicationProposal,
  approval: ApprovalAttempt,
  policy: SeparationPolicy = DEFAULT_SEPARATION_POLICY,
): SeparationVerdict {
  const sameIdentity =
    approval.approverIdentitySnapshotId === proposal.proposerIdentitySnapshotId;
  const sameActor = approval.approverId === proposal.proposerId;

  if (!sameIdentity && !sameActor) return { permitted: true };

  // --- Rule 1: absolute for non-humans. Policy is not consulted. ---
  const nonHuman = proposal.proposerType !== 'human' || approval.approverType !== 'human';
  if (nonHuman) {
    return {
      permitted: false,
      reason:
        `A ${approval.approverType} may not approve its own proposal. This holds under every ` +
        'policy: an agent that can approve its own work is unsupervised.',
      reasonCode: 'self_approval_prohibited',
    };
  }

  // --- Rule 2: human self-approval is policy. ---
  if (policy.humanSelfApprovalPermitted) return { permitted: true };

  if (sameIdentity && !sameActor) {
    return {
      permitted: false,
      reason:
        'The approver holds the same identity as the proposer, under a different actor id. ' +
        'Separation of duties reads the frozen identity snapshot, so re-registering under a ' +
        'new id does not make a principal a distinct approver.',
      reasonCode: 'distinct_approver_required',
    };
  }

  return {
    permitted: false,
    reason: 'Policy requires a distinct approver; the proposer may not approve their own proposal.',
    reasonCode: 'distinct_approver_required',
  };
}
