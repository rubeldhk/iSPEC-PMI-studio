/**
 * `T726` — the decide types. `FR-DPE-003`, `FR-DPE-040`, `FR-DPE-041`.
 *
 * The concrete shape behind `loop-contract`'s `PolicyProvider`.
 *
 * - `DecisionResult.explanation` is **not optional** (`FR-DPE-040`): blocked
 *   and allowed alike explain themselves, so an unexplained result is not
 *   representable — the type-level half of `ADR-0025` constraint 3; the
 *   database `NOT NULL` is the other.
 * - `proposedClass` lives on the request and `effectiveClass` on the result
 *   (`FR-DPE-003`). An Engineering Expert may propose; policy classifies.
 */
import type { ActorRef } from './authority.js';
import type { RiskBand } from './bands.js';

export const DECISION_OUTCOMES = Object.freeze([
  'auto-executed',
  'approved',
  'refused',
  'pending',
  'exception',
] as const);

export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

/**
 * Four members, no fifth, no default — the same four words as `EPIC-030`'s
 * `loop-contract`. `satisfied` is reachable only by a provider returning it
 * (`FR-DPE-013`).
 */
export const GATE_RESULTS = Object.freeze(['satisfied', 'refused', 'exception', 'violation'] as const);

export type GateResult = (typeof GATE_RESULTS)[number];

export interface GateOutcome {
  readonly gateId: string;
  readonly result: GateResult;
  readonly detail?: string;
}

/** A versioned steering rule — `lineageId` and the `version` the decision was judged under. */
export interface SteeringRuleRef {
  readonly lineageId: string;
  readonly version: number;
}

export interface DecisionRequest {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly actionType: string;
  /** Opaque — no Room vocabulary (`FR-DPE-051`). */
  readonly target: { readonly type: string; readonly id: string };
  /** `BR-0005` — the version the decision is made against. */
  readonly objectVersion: string;
  readonly actor: ActorRef;
  /** `FR-DPE-003` — MAY propose; MUST NOT assign. */
  readonly proposedClass?: RiskBand;
  readonly requiredGates: readonly string[];
  /** Who asked for the action — `FR-DPE-015` refuses self-approval by default. */
  readonly requestedBy?: string;
  /** `FR-DPE-031` — the rule an automated action fired under, when automated. */
  readonly triggeredBy?: { readonly ruleId: string; readonly eventId: string };
}

/**
 * `T2502`, `FR-DPE-017` — the three ways a pending decision closes without an
 * approval. Each is recorded with outcome `refused`: a closure can only refuse.
 *
 * - `rejected` — by an authorized human who is not the requester;
 * - `withdrawn` — by the requester;
 * - `expired` — by the requesting automation, for its own request only.
 */
export const CLOSURE_KINDS = Object.freeze(['rejected', 'withdrawn', 'expired'] as const);

export type ClosureKind = (typeof CLOSURE_KINDS)[number];

export function isClosureKind(value: unknown): value is ClosureKind {
  return typeof value === 'string' && (CLOSURE_KINDS as readonly string[]).includes(value);
}

export interface Closure {
  readonly kind: ClosureKind;
  /** Never empty — the database refuses a closure without one. */
  readonly reason: string;
}

export interface Explanation {
  readonly policyVersion: string;
  /** `null` states that no rule matched (`FR-DPE-004`) — required either way. */
  readonly matchedRule: SteeringRuleRef | null;
  readonly riskClass: RiskBand;
  /** `FR-DPE-042`, `BR-0071` — quoted from `resolveSteering()`, present when scopes conflicted. */
  readonly precedenceResolution?: string;
  readonly authorityApplied: string;
  /** When a fence decided it, which one — e.g. *high band not configurable* (`FR-DPE-012`). */
  readonly constraintCited?: string;
  /** `FR-DPE-003` — a proposal that differs from policy, made visible rather than reconciled. */
  readonly proposalDisagreement?: string;
  /** `FR-DPE-032` — the rule that fired an automated decision. */
  readonly triggerRule?: string;
  /**
   * `FR-DPE-017` (amendment `A-031-1`) — present only on the row that closes a
   * pending decision without approving it. Kind and reason travel together.
   */
  readonly closure?: Closure;
}

export interface DecisionResult {
  readonly decisionId: string;
  readonly outcome: DecisionOutcome;
  readonly effectiveClass: RiskBand;
  readonly explanation: Explanation;
  readonly gateOutcomes: readonly GateOutcome[];
}
