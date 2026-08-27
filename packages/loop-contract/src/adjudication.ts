/**
 * T1083 (EPIC-030 Phase C2A) — specification status-transition adjudication.
 *
 * `FR-GEL-063`–`FR-GEL-073`. The contract `EPIC-037` consumes.
 *
 * ## Why this is here and not in EPIC-037
 *
 * `EPIC-037` records proposals and execution history. **It does not decide
 * anything.** Adjudication — authority, gates, separation of duties, approval
 * routing — belongs to this Epic, and `EPIC-009` remains the authoritative
 * validator and executor of the transition itself. This file is the seam
 * between the three, and it lives in a **contract package** precisely so
 * `EPIC-037` can depend on it without importing this Epic's internals
 * (`FR-GEL-073`).
 *
 * ## The vocabulary rule
 *
 * A {@link LoopStage} is where a governed workflow object sits. A specification
 * lifecycle status is what a specification *is*. `FR-GEL-064` forbids passing
 * one into an API typed for the other, and forbids an implicit mapping. **There
 * is deliberately no conversion helper in this file** — a `stageForStatus()`
 * would be that mapping, one cast away from making a stage vocabulary
 * meaningless, which is the fault `FR-GEL-002` already forbids.
 *
 * The status type is imported from nowhere: this contract states the six values
 * `EPIC-009` owns, and `T1082` asserts they never collide with a loop stage.
 * Duplicating the *list* would create a second source of truth, so the port
 * below takes the status as an opaque string constrained by `EPIC-009`, and the
 * adjudicator validates it **through** `EPIC-009` rather than against a local
 * table (`FR-GEL-065`).
 */

/** A specification lifecycle status, as owned and validated by EPIC-009. */
export type SpecificationStatus = string;

/**
 * The closed verdict set (`FR-GEL-068`).
 *
 * Six values, one meaning each. Expressed as a union rather than a boolean pair
 * because `approved: true` cannot distinguish *"valid but deliberately not
 * applied"* from *"applied"*, and that distinction is the whole point.
 */
export const ADJUDICATION_VERDICTS = Object.freeze([
  /** Valid, and **not applied**. Policy routes application separately. */
  'validated',
  /** EPIC-009 **confirmed** the transition. Never returned before that. */
  'applied',
  /** Routed to a human. **No transition applied.** */
  'approval_required',
  /** Policy forbade it. **No transition applied.** */
  'refused',
  /** Observed state contradicts the proposal's expected state. */
  'inconsistent',
  /** Automated application prohibited pending governed resolution. */
  'reconciliation_required',
] as const);

export type AdjudicationVerdictName = (typeof ADJUDICATION_VERDICTS)[number];

/** Narrow an untrusted string to a verdict, or refuse it. */
export function isAdjudicationVerdict(value: string): value is AdjudicationVerdictName {
  return (ADJUDICATION_VERDICTS as readonly string[]).includes(value);
}

/** Who proposed. An agent may never approve its own proposal (`FR-GEL-067`). */
export type ProposerType = 'human' | 'agent' | 'service';

/**
 * A governed specification status-transition proposal.
 *
 * `expectedCurrentStatus` is what makes optimistic concurrency possible
 * (`FR-GEL-070`): without it a stale proposal is indistinguishable from a fresh
 * one, and `inconsistent` could never be returned.
 */
export interface AdjudicationProposal {
  readonly proposalId: string;
  readonly executionId: string;
  readonly workspaceId: string;
  readonly specificationId: string;
  /** What the proposer believed the status to be when proposing. */
  readonly expectedCurrentStatus: SpecificationStatus;
  readonly requestedStatus: SpecificationStatus;
  /** Target version or baseline the proposal was formed against. */
  readonly targetVersion: number;
  readonly proposerId: string;
  readonly proposerType: ProposerType;
  /** **Frozen** identity, never mutable display metadata (`FR-GEL-067`). */
  readonly proposerIdentitySnapshotId: string;
  readonly originatingConnector: string;
  readonly evidenceRefs: readonly string[];
  readonly reason: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly idempotencyKey: string;
  readonly proposedAt: string;
}

/** An approval offered against a proposal. */
export interface ApprovalAttempt {
  readonly proposalId: string;
  readonly approverId: string;
  readonly approverType: ProposerType;
  readonly approverIdentitySnapshotId: string;
  readonly basis: string;
  readonly attemptedAt: string;
}

/**
 * Why a proposal was refused, in two **orthogonal** typed concepts.
 *
 * The first attempt used a single discriminator mixing phase with cause
 * (`'separation-of-duties' | 'lifecycle' | 'gate' | 'application'`). The project
 * owner rejected it: that conflates *when* a refusal happened with *why*, and
 * still leaves event selection guessing.
 *
 * So: {@link RefusalStage} answers **when**, and selects the `EPIC-037` event.
 * {@link RefusalReasonCode} answers **why**, and never selects an event. The
 * human-readable `reason` is supplementary evidence and is **never parsed**.
 */
export type RefusalStage = 'validation' | 'approval' | 'transition';

export const REFUSAL_REASON_CODES = Object.freeze([
  'invalid_lifecycle_transition',
  'gate_failed',
  'unauthorized_actor',
  'self_approval_prohibited',
  'distinct_approver_required',
  'approval_authority_missing',
  'lifecycle_application_refused',
] as const);

export type RefusalReasonCode = (typeof REFUSAL_REASON_CODES)[number];

export function isRefusalReasonCode(value: string): value is RefusalReasonCode {
  return (REFUSAL_REASON_CODES as readonly string[]).includes(value);
}

/**
 * The stage each reason belongs to.
 *
 * A **gate** or **lifecycle-validation** failure is `validation`. A prohibited
 * or unauthorised **approval attempt** is `approval`. An explicit refusal
 * returned by `EPIC-009` during authorised **application** is `transition`.
 */
export const REFUSAL_STAGE_OF: Readonly<Record<RefusalReasonCode, RefusalStage>> = Object.freeze({
  invalid_lifecycle_transition: 'validation',
  gate_failed: 'validation',
  unauthorized_actor: 'approval',
  self_approval_prohibited: 'approval',
  distinct_approver_required: 'approval',
  approval_authority_missing: 'approval',
  lifecycle_application_refused: 'transition',
});

/**
 * The **deterministic** `EPIC-037` event for a refusal (`X1`).
 *
 * Total over {@link RefusalStage}, so `EPIC-037` selects an event by lookup and
 * never by reading prose. This is the whole point of the correction: `refused`
 * previously mapped to three candidate events with nothing to choose between
 * them.
 */
export const REFUSAL_EVENT_OF: Readonly<Record<RefusalStage, string>> = Object.freeze({
  validation: 'validation-failed',
  approval: 'approval-refused',
  transition: 'transition-refused',
});

export function refusalEventFor(stage: RefusalStage): string {
  return REFUSAL_EVENT_OF[stage];
}

/** Why reconciliation is needed. Structured, because a consumer must branch on it. */
export const RECONCILIATION_CAUSES = Object.freeze([
  /** Timeout, crash, lost response — nobody observed the outcome. */
  'application_outcome_unknown',
  /** EPIC-009 answered, with a state other than the one requested. */
  'application_state_unconfirmed',
  /**
   * EPIC-009 confirmed the state but surfaced no transition identity, so the
   * proposal -> verdict -> transition chain cannot be completed. `applied`
   * would require an id, and inventing one would put a false link in an audit
   * record — which is worse than saying the link is missing.
   */
  'application_transition_unidentified',
  /**
   * Gate causes. **Infrastructure or evidence unavailability is not a gate
   * decision**, and reporting it as `refused` would say a gate examined this
   * proposal and turned it down. Nothing examined it.
   *
   * `FR-ENH-016` — *"an unavailable or malformed role fails the gate"* — is a
   * different case and stays `gate_failed`: there, the gate **ran**, a role
   * could not answer, and failing is the authoritative outcome.
   */
  'gate_outcomes_unavailable',
  'gate_outcomes_stale',
  'gate_evaluation_incomplete',
] as const);

export type ReconciliationCause = (typeof RECONCILIATION_CAUSES)[number];

export interface ReconciliationDetail {
  readonly cause: ReconciliationCause;
  readonly detail: string;
  /** The durable intent recorded before the attempt, where one was opened. */
  readonly intentId?: string;
}

/** What the proposal expected against what the system observed (`FR-GEL-070`). */
export interface ObservedStateMismatch {
  readonly expectedStatus: SpecificationStatus;
  readonly observedStatus: SpecificationStatus;
  readonly expectedVersion?: number;
}

/** Fields every verdict carries, whatever it decided. */
export interface AdjudicationVerdictBase {
  readonly proposalId: string;
  /** Supplementary evidence for a human. **Never parsed** to select behaviour. */
  readonly reason: string;
  readonly decidedAt: string;
  /** Immutable evidence linking proposal, verdict and transition. */
  readonly adjudicationRecordId?: string;
}

/**
 * The adjudication outcome, as a **closed discriminated union**.
 *
 * Verdict-specific data used to be broadly optional on one object, which let a
 * caller construct `{ verdict: 'refused', appliedTransitionId }` — a refusal
 * that applied something — and typecheck. Each variant now carries exactly what
 * it needs, and `appliedTransitionId?: never` makes the nonsensical
 * combinations **unconstructible** rather than merely discouraged.
 *
 * Carries no boolean: every meaningful state is in `verdict`.
 */
export type AdjudicationVerdict =
  | (AdjudicationVerdictBase & {
      readonly verdict: 'validated';
      readonly appliedTransitionId?: never;
    })
  | (AdjudicationVerdictBase & {
      readonly verdict: 'applied';
      /** Required. `applied` without a confirmed transition is a lie (`FR-GEL-069`). */
      readonly appliedTransitionId: string;
    })
  | (AdjudicationVerdictBase & {
      readonly verdict: 'approval_required';
      readonly requiredApproverRole: string;
      readonly appliedTransitionId?: never;
    })
  | (AdjudicationVerdictBase & {
      readonly verdict: 'refused';
      readonly refusalStage: RefusalStage;
      readonly refusalReasonCode: RefusalReasonCode;
      readonly appliedTransitionId?: never;
    })
  | (AdjudicationVerdictBase & {
      readonly verdict: 'inconsistent';
      readonly mismatch: ObservedStateMismatch;
      readonly appliedTransitionId?: never;
    })
  | (AdjudicationVerdictBase & {
      readonly verdict: 'reconciliation_required';
      readonly reconciliation: ReconciliationDetail;
      readonly appliedTransitionId?: never;
    });

/**
 * The port through which this Epic asks **EPIC-009** to apply a transition.
 *
 * `EPIC-009` exposes no shared transaction boundary, so this Epic must not
 * claim `applied` optimistically. An implementation returns confirmation, a
 * refusal, or **unknown** — and unknown becomes `reconciliation_required`,
 * never `applied` and never `refused` (`FR-GEL-069`).
 */
export interface LifecycleApplicationPort {
  apply(input: {
    readonly workspaceId: string;
    readonly specificationId: string;
    readonly expectedCurrentStatus: SpecificationStatus;
    readonly requestedStatus: SpecificationStatus;
    readonly actorId: string;
  }): Promise<LifecycleApplicationOutcome>;
}

export type LifecycleApplicationOutcome =
  | { readonly outcome: 'confirmed'; readonly transitionId: string }
  | { readonly outcome: 'refused'; readonly reason: string }
  /**
   * The transition may or may not have happened. `cause` is structural so the
   * verdict can carry it without anyone parsing `reason`.
   */
  | {
      readonly outcome: 'unknown';
      readonly cause: ReconciliationCause;
      readonly reason: string;
      readonly intentId?: string;
    };

/**
 * What `EPIC-037` calls. One operation, one verdict.
 *
 * Deliberately narrow: a consumer can adjudicate and read the outcome, and can
 * do nothing else. There is no `apply()` here, because applying is not a thing
 * a consumer may ask for — it is a thing adjudication decides.
 */
export interface ProposalAdjudicator {
  adjudicate(
    proposal: AdjudicationProposal,
    approval?: ApprovalAttempt,
  ): Promise<AdjudicationVerdict>;
}
