/**
 * T1087 (EPIC-030 Phase C2A) — specification status-transition adjudication.
 *
 * `FR-GEL-063`–`FR-GEL-072`. This is the capability `EPIC-037` Band A stopped
 * for: it needed to consume adjudication and there was nothing to consume.
 *
 * ## What this service does NOT own
 *
 * - **Transition validity** is `EPIC-009`'s. This service asks; it holds no
 *   table of permitted transitions (`FR-GEL-065`). Duplicating that table would
 *   create a second lifecycle engine, which the authorisation forbids.
 * - **Gate outcomes** are `EPIC-021`'s. Roles run there, humans decide there,
 *   and this service consumes the result rather than re-deciding it.
 * - **Applying the transition** is `EPIC-009`'s. This service asks through
 *   {@link LifecycleApplicationPort} and reports what came back.
 * - **Authorisation scope** is `EPIC-024`'s, applied at intake (`T1095`).
 *
 * ## Order of evaluation, and why it is this order
 *
 * Consistency is checked **first**. A stale proposal reported as
 * `approval_required` would send a human to approve a transition that no longer
 * makes sense; reported as `refused` it would look like a policy decision.
 * Neither is true — the world moved. So `inconsistent` precedes everything.
 *
 * Unit tests: `backend/tests/unit/loop/adjudicator.spec.ts` (T1086).
 */
import {
  REFUSAL_STAGE_OF,
  type AdjudicationProposal,
  type AdjudicationVerdict,
  type ApprovalAttempt,
  type LifecycleApplicationPort,
  type ProposalAdjudicator,
  type ReconciliationCause,
  type RefusalReasonCode,
  type RefusalStage,
} from '@pmi/loop-contract';
import { evaluateSeparationOfDuties, type SeparationPolicy } from './separation-of-duties.js';

/** EPIC-009 — the authoritative lifecycle. Asked, never duplicated. */
export interface LifecycleValidationPort {
  currentStatus(workspaceId: string, specificationId: string): Promise<string>;
  isPermitted(from: string, to: string): Promise<boolean>;
}

/**
 * What EPIC-021 says about the gates declared on a transition.
 *
 * A boolean cannot carry this. `failed` is a **decision** — the gate ran and
 * turned the proposal down. `unavailable`, `stale` and `pending` are the
 * **absence** of a decision, and reporting any of them as a refusal would claim
 * a gate examined this proposal when nothing did.
 */
export type GateDisposition = 'passed' | 'failed' | 'pending' | 'unavailable' | 'stale';

/** EPIC-021 — gate outcomes on a specification. Consumed, never re-decided. */
export interface GateOutcomePort {
  outcomesFor(
    workspaceId: string,
    specificationId: string,
    requestedTransition: string,
  ): Promise<{
    disposition: GateDisposition;
    /** The gate that decided, or the reason no outcome could be obtained. */
    blocking: string | undefined;
  }>;
}

/** Transition policy: who may, and whether application is automatic. */
export interface AuthorityPolicyPort {
  requiredAuthorities(from: string, to: string): Promise<readonly string[]>;
  actorAuthorities(workspaceId: string, actorId: string): Promise<readonly string[]>;
  autoApplyPermitted(from: string, to: string): Promise<boolean>;
}

/**
 * EPIC-024 authorisation, applied at intake (`T1095`).
 *
 * Deliberately a **port onto the existing service**, not a new model. EPIC-024
 * already owns tenant, workspace and artifact scope; a second authorisation
 * model here would be a second answer to one question, and the two would
 * eventually disagree.
 *
 * It **throws** rather than returning a verdict. A verdict would write an
 * adjudication record on behalf of a caller with no standing, and would tell
 * that caller whether the specification exists.
 */
export interface IntakeAuthorizationPort {
  /** Refuses (throws) when the actor may not act on this specification. */
  requireEditable(workspaceId: string, actorId: string, specificationId: string): Promise<void>;
}

/** Everything a verdict contributes to its immutable evidence row. */
export interface AdjudicationEvidenceInput {
  proposal: AdjudicationProposal;
  verdict: string;
  reason: string;
  appliedTransitionId?: string;
  refusalStage?: RefusalStage;
  refusalReasonCode?: RefusalReasonCode;
  requiredApproverRole?: string;
  observedStatus?: string;
  reconciliationCause?: string;
  reconciliationDetail?: string;
}

/**
 * Immutable adjudication evidence (`FR-GEL-072`) and the idempotency oracle
 * (`FR-GEL-071`).
 *
 * `findByIdempotency` is what makes a retry safe. Without it, a client that
 * retries after a lost response adjudicates twice — and if the first attempt
 * applied a transition, the second could apply another, or approve twice.
 */
export interface AdjudicationRecordPort {
  record(input: AdjudicationEvidenceInput): Promise<string>;
  /** The verdict already decided for this proposal and key, if any. */
  findByIdempotency(
    workspaceId: string,
    proposalId: string,
    idempotencyKey: string,
  ): Promise<AdjudicationVerdict | null>;
}

/**
 * A verdict as the adjudicator builds it, before evidence is written.
 *
 * `Omit` over a union collapses to the shared keys, which would erase exactly
 * the per-variant fields the union exists to enforce. Distributing preserves
 * them.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type VerdictDraft = DistributiveOmit<AdjudicationVerdict, 'proposalId' | 'adjudicationRecordId'>;

/**
 * Non-decision dispositions and the reconciliation each one needs.
 *
 * Total over everything except `passed` and `failed`, which are handled before
 * this is consulted — so a new disposition cannot silently fall through.
 */
const GATE_RECONCILIATION_CAUSE: Readonly<
  Record<Exclude<GateDisposition, 'passed' | 'failed'>, ReconciliationCause>
> = Object.freeze({
  unavailable: 'gate_outcomes_unavailable',
  stale: 'gate_outcomes_stale',
  pending: 'gate_evaluation_incomplete',
});

export class ProposalAdjudicatorService implements ProposalAdjudicator {
  constructor(
    private readonly lifecycle: LifecycleValidationPort,
    private readonly gates: GateOutcomePort,
    private readonly policy: AuthorityPolicyPort,
    private readonly application: LifecycleApplicationPort,
    private readonly separation: SeparationPolicy,
    private readonly evidence: AdjudicationRecordPort,
    private readonly authorization: IntakeAuthorizationPort,
  ) {}

  async adjudicate(
    proposal: AdjudicationProposal,
    approval?: ApprovalAttempt,
  ): Promise<AdjudicationVerdict> {
    const decidedAt = proposal.proposedAt;

    // --- 0a. Authorisation, before anything is decided, read back or recorded.
    // Ahead of the idempotency lookup on purpose: otherwise an unauthorised
    // caller could read a prior verdict back out of it (`FR-GEL-066`, EPIC-024).
    await this.authorization.requireEditable(
      proposal.workspaceId,
      proposal.proposerId,
      proposal.specificationId,
    );

    // --- 0b. Idempotency. A retry returns the ORIGINAL verdict (`FR-GEL-071`).
    const already = await this.evidence.findByIdempotency(
      proposal.workspaceId,
      proposal.proposalId,
      proposal.idempotencyKey,
    );
    if (already) return already;

    // --- 1. Consistency. The world may have moved since the proposal formed.
    const observed = await this.lifecycle.currentStatus(
      proposal.workspaceId,
      proposal.specificationId,
    );
    if (observed !== proposal.expectedCurrentStatus) {
      // Stale state stays `inconsistent`, never `refused`: nothing was decided
      // against the proposal, the ground moved under it.
      return this.finish(proposal, {
        verdict: 'inconsistent',
        mismatch: {
          expectedStatus: proposal.expectedCurrentStatus,
          observedStatus: observed,
          expectedVersion: proposal.targetVersion,
        },
        reason:
          `Proposal expected status "${proposal.expectedCurrentStatus}" but the specification ` +
          `is "${observed}". Nothing was applied.`,
        decidedAt,
      });
    }

    // --- 2. Separation of duties, before any approval can count.
    if (approval) {
      const sod = evaluateSeparationOfDuties(proposal, approval, this.separation);
      if (!sod.permitted) {
        return this.refuse(proposal, sod.reasonCode, sod.reason, decidedAt);
      }
    }

    // --- 3. Validity, answered by EPIC-009.
    const permitted = await this.lifecycle.isPermitted(observed, proposal.requestedStatus);
    if (!permitted) {
      return this.refuse(
        proposal,
        'invalid_lifecycle_transition',
        `The lifecycle does not permit "${observed}" -> "${proposal.requestedStatus}". ` +
          'EPIC-009 owns this answer.',
        decidedAt,
      );
    }

    // --- 4. Gates, answered by EPIC-021.
    //
    // Only `failed` is a refusal. A gate that could not be read, is stale, or
    // has not finished has decided nothing — routing those to reconciliation
    // keeps infrastructure trouble from masquerading as a governance decision.
    const gate = await this.gates.outcomesFor(
      proposal.workspaceId,
      proposal.specificationId,
      observed + '->' + proposal.requestedStatus,
    );
    if (gate.disposition === 'failed') {
      return this.refuse(
        proposal,
        'gate_failed',
        'Gate "' + (gate.blocking ?? 'unnamed') + '" did not pass. Nothing was applied.',
        decidedAt,
      );
    }
    if (gate.disposition !== 'passed') {
      const cause = GATE_RECONCILIATION_CAUSE[gate.disposition];
      return this.reconcile(
        proposal,
        cause,
        'No gate outcome could be established (' +
          (gate.blocking ?? 'no detail supplied') +
          '). Nothing was applied, and nothing was refused: no gate decided anything.',
        decidedAt,
      );
    }

    // --- 5. Authority.
    const required = await this.policy.requiredAuthorities(observed, proposal.requestedStatus);
    const actorId = approval?.approverId ?? proposal.proposerId;
    const held = await this.policy.actorAuthorities(proposal.workspaceId, actorId);
    const missing = required.find((r) => !held.includes(r));
    if (missing !== undefined) {
      // An *attempted* approval that lacks authority is a refusal at the
      // approval stage. Absent an attempt it is a routing decision instead —
      // reporting `refused` would tell a proposer their proposal was rejected
      // when it merely needs somebody else.
      if (approval) {
        const noAuthorityAtAll = held.length === 0;
        return this.refuse(
          proposal,
          noAuthorityAtAll ? 'unauthorized_actor' : 'approval_authority_missing',
          noAuthorityAtAll
            ? 'The approver holds no authority in this workspace. Nothing was applied.'
            : `The approver does not hold "${missing}". Nothing was applied.`,
          decidedAt,
        );
      }
      return this.finish(proposal, {
        verdict: 'approval_required',
        requiredApproverRole: missing,
        reason: `Requires "${missing}", which the actor does not hold. Nothing was applied.`,
        decidedAt,
      });
    }

    // --- 6. Validation passed. Application is a SEPARATE decision.
    const autoApply = await this.policy.autoApplyPermitted(observed, proposal.requestedStatus);
    if (!autoApply) {
      return this.finish(proposal, {
        verdict: 'validated',
        reason:
          'Valid, authorised and gate-clear. Policy does not authorise automatic application, ' +
          'so no transition was applied.',
        decidedAt,
      });
    }

    // --- 7. Ask EPIC-009. Claim nothing until it answers.
    const outcome = await this.application.apply({
      workspaceId: proposal.workspaceId,
      specificationId: proposal.specificationId,
      expectedCurrentStatus: observed,
      requestedStatus: proposal.requestedStatus,
      actorId,
    });

    if (outcome.outcome === 'confirmed') {
      return this.finish(proposal, {
        verdict: 'applied',
        appliedTransitionId: outcome.transitionId,
        reason: 'EPIC-009 confirmed the transition.',
        decidedAt,
      });
    }
    if (outcome.outcome === 'refused') {
      return this.refuse(
        proposal,
        'lifecycle_application_refused',
        `EPIC-009 refused the transition: ${outcome.reason}`,
        decidedAt,
      );
    }
    return this.finish(proposal, {
      verdict: 'reconciliation_required',
      reconciliation: {
        cause: outcome.cause,
        detail: outcome.reason,
        ...(outcome.intentId !== undefined ? { intentId: outcome.intentId } : {}),
      },
      reason:
        `The application outcome is unknown (${outcome.reason}). The transition may or may not ` +
        'have been applied, so neither "applied" nor "refused" would be true.',
      decidedAt,
    });
  }

  /**
   * Build a refusal.
   *
   * The stage is **derived** from the code rather than passed alongside it, so
   * the two can never disagree — which is precisely what would put `EPIC-037`
   * back to guessing which event to emit.
   */
  private refuse(
    proposal: AdjudicationProposal,
    reasonCode: RefusalReasonCode,
    reason: string,
    decidedAt: string,
  ): Promise<AdjudicationVerdict> {
    return this.finish(proposal, {
      verdict: 'refused',
      refusalStage: REFUSAL_STAGE_OF[reasonCode],
      refusalReasonCode: reasonCode,
      reason,
      decidedAt,
    });
  }

  /** Route to reconciliation with a structured cause, never a parsed string. */
  private reconcile(
    proposal: AdjudicationProposal,
    cause: ReconciliationCause,
    reason: string,
    decidedAt: string,
  ): Promise<AdjudicationVerdict> {
    return this.finish(proposal, {
      verdict: 'reconciliation_required',
      reconciliation: { cause, detail: reason },
      reason,
      decidedAt,
    });
  }

  /**
   * Record immutable evidence, then return the verdict carrying its id.
   *
   * The draft omits `proposalId` and `adjudicationRecordId`: both are supplied
   * here. Accepting a full verdict would let a caller pass an id for a record
   * that does not exist yet.
   */
  private async finish(
    proposal: AdjudicationProposal,
    draft: VerdictDraft,
  ): Promise<AdjudicationVerdict> {
    const adjudicationRecordId = await this.evidence.record({
      proposal,
      verdict: draft.verdict,
      reason: draft.reason,
      ...(draft.verdict === 'applied' ? { appliedTransitionId: draft.appliedTransitionId } : {}),
      ...(draft.verdict === 'refused'
        ? { refusalStage: draft.refusalStage, refusalReasonCode: draft.refusalReasonCode }
        : {}),
      ...(draft.verdict === 'approval_required'
        ? { requiredApproverRole: draft.requiredApproverRole }
        : {}),
      ...(draft.verdict === 'inconsistent'
        ? { observedStatus: draft.mismatch.observedStatus }
        : {}),
      ...(draft.verdict === 'reconciliation_required'
        ? {
            reconciliationCause: draft.reconciliation.cause,
            reconciliationDetail: draft.reconciliation.detail,
          }
        : {}),
    });
    return {
      ...draft,
      proposalId: proposal.proposalId,
      adjudicationRecordId,
    } as AdjudicationVerdict;
  }
}
