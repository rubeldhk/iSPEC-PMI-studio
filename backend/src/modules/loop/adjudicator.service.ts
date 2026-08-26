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
import type {
  AdjudicationProposal,
  AdjudicationVerdict,
  ApprovalAttempt,
  LifecycleApplicationPort,
  ProposalAdjudicator,
} from '@pmi/loop-contract';
import {
  evaluateSeparationOfDuties,
  type SeparationPolicy,
} from './separation-of-duties.js';

/** EPIC-009 — the authoritative lifecycle. Asked, never duplicated. */
export interface LifecycleValidationPort {
  currentStatus(workspaceId: string, specificationId: string): Promise<string>;
  isPermitted(from: string, to: string): Promise<boolean>;
}

/** EPIC-021 — gate outcomes on a specification. Consumed, never re-decided. */
export interface GateOutcomePort {
  outcomesFor(
    workspaceId: string,
    specificationId: string,
  ): Promise<{ passed: boolean; blocking: string | undefined }>;
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

/**
 * Immutable adjudication evidence (`FR-GEL-072`) and the idempotency oracle
 * (`FR-GEL-071`).
 *
 * `findByIdempotency` is what makes a retry safe. Without it, a client that
 * retries after a lost response adjudicates twice — and if the first attempt
 * applied a transition, the second could apply another, or approve twice.
 */
export interface AdjudicationRecordPort {
  record(input: {
    proposal: AdjudicationProposal;
    verdict: string;
    reason: string;
    appliedTransitionId?: string;
  }): Promise<string>;
  /** The verdict already decided for this proposal and key, if any. */
  findByIdempotency(
    workspaceId: string,
    proposalId: string,
    idempotencyKey: string,
  ): Promise<AdjudicationVerdict | null>;
}

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
    // Placing this ahead of the idempotency lookup matters: otherwise an
    // unauthorised caller could read a previous verdict back out of it
    // (`FR-GEL-066`, EPIC-024).
    await this.authorization.requireEditable(
      proposal.workspaceId,
      proposal.proposerId,
      proposal.specificationId,
    );

    // --- 0b. Idempotency. A retry returns the ORIGINAL verdict and re-decides
    // nothing (`FR-GEL-071`). Re-running would risk a second approval or a
    // second transition, which is precisely what a retry must not cause.
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
      return this.finish(proposal, {
        verdict: 'inconsistent',
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
        return this.finish(proposal, {
          verdict: 'refused',
          reason: sod.reason,
          decidedAt,
        });
      }
    }

    // --- 3. Validity, answered by EPIC-009.
    const permitted = await this.lifecycle.isPermitted(observed, proposal.requestedStatus);
    if (!permitted) {
      return this.finish(proposal, {
        verdict: 'refused',
        reason:
          `The lifecycle does not permit "${observed}" -> "${proposal.requestedStatus}". ` +
          'EPIC-009 owns this answer.',
        decidedAt,
      });
    }

    // --- 4. Gates, answered by EPIC-021.
    const gate = await this.gates.outcomesFor(proposal.workspaceId, proposal.specificationId);
    if (!gate.passed) {
      return this.finish(proposal, {
        verdict: 'refused',
        reason: `Gate "${gate.blocking ?? 'unnamed'}" did not pass. Nothing was applied.`,
        decidedAt,
      });
    }

    // --- 5. Authority. Missing authority is a routing decision, not a refusal.
    const required = await this.policy.requiredAuthorities(observed, proposal.requestedStatus);
    const held = await this.policy.actorAuthorities(
      proposal.workspaceId,
      approval?.approverId ?? proposal.proposerId,
    );
    const missing = required.find((r) => !held.includes(r));
    if (missing !== undefined) {
      return this.finish(proposal, {
        verdict: 'approval_required',
        reason: `Requires "${missing}", which the actor does not hold. Nothing was applied.`,
        decidedAt,
        requiredApproverRole: missing,
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
      actorId: approval?.approverId ?? proposal.proposerId,
    });

    if (outcome.outcome === 'confirmed') {
      return this.finish(proposal, {
        verdict: 'applied',
        reason: 'EPIC-009 confirmed the transition.',
        decidedAt,
        appliedTransitionId: outcome.transitionId,
      });
    }
    if (outcome.outcome === 'refused') {
      return this.finish(proposal, {
        verdict: 'refused',
        reason: `EPIC-009 refused the transition: ${outcome.reason}`,
        decidedAt,
      });
    }
    return this.finish(proposal, {
      verdict: 'reconciliation_required',
      reason:
        `The application outcome is unknown (${outcome.reason}). The transition may or may not ` +
        'have been applied, so neither "applied" nor "refused" would be true.',
      decidedAt,
    });
  }

  /**
   * Record immutable evidence, then return the verdict carrying its id.
   *
   * The parameter deliberately omits `proposalId` and `adjudicationRecordId`:
   * both are supplied *here*. Accepting a full verdict would let a caller pass
   * an id for a record that does not exist yet.
   */
  private async finish(
    proposal: AdjudicationProposal,
    verdict: Omit<AdjudicationVerdict, 'proposalId' | 'adjudicationRecordId'>,
  ): Promise<AdjudicationVerdict> {
    const adjudicationRecordId = await this.evidence.record({
      proposal,
      verdict: verdict.verdict,
      reason: verdict.reason,
      ...(verdict.appliedTransitionId !== undefined
        ? { appliedTransitionId: verdict.appliedTransitionId }
        : {}),
    });
    return { ...verdict, proposalId: proposal.proposalId, adjudicationRecordId };
  }
}
