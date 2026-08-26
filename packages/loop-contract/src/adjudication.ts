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
 * The adjudication outcome.
 *
 * Carries **no boolean**: every meaningful state is in `verdict`, and a
 * consumer that wants to know whether anything changed reads
 * `appliedTransitionId`, which exists only for `applied`.
 */
export interface AdjudicationVerdict {
  readonly verdict: AdjudicationVerdictName;
  readonly proposalId: string;
  /** Why, in terms an auditor reads. "Refused" is not a reason. */
  readonly reason: string;
  readonly decidedAt: string;
  /** Present **only** when `verdict === 'applied'` (`FR-GEL-069`). */
  readonly appliedTransitionId?: string;
  /** The role or identity an approval must come from, when required. */
  readonly requiredApproverRole?: string;
  /** Immutable evidence linking proposal, verdict and transition. */
  readonly adjudicationRecordId?: string;
}

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
  /** Timeout, crash, or lost response. The transition may or may not have happened. */
  | { readonly outcome: 'unknown'; readonly reason: string };

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
