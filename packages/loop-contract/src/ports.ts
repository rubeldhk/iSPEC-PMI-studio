/**
 * T922 — the five ports. `FR-GEL-021`, `FR-GEL-041`, `FR-GEL-062`.
 *
 * Every seam this Epic declares and does not fill. Each is a token-injected
 * interface, and an absent implementation is a **load-time refusal**, never a
 * runtime default — so this file exports no fallback, no no-op and no base
 * class. There is nothing here a consumer could wire up by accident.
 *
 * That is the whole point. A no-op `Decide` handler is an auto-approval wearing
 * a placeholder's name, and a `PolicyProvider` defaulting to permit installs the
 * `ADR-0025` failure mode at the foundation of every governed workflow in the
 * product.
 */

import type { LoopStage } from './stages.js';

// ─────────────────────────────────────────────────────────── shared references

/** Who acted. `FR-GEL-030` — automation is an actor kind, not an absence of one. */
export interface ActorRef {
  readonly kind: 'human' | 'automation' | 'agent';
  readonly id: string;
}

/** A loop object, addressed without knowing which workflow type it belongs to. */
export interface LoopObjectRef {
  readonly workflowType: string;
  readonly objectId: string;
}

/**
 * The database transaction a transition runs inside.
 *
 * Deliberately opaque. The contract needs to *require* a handle without naming
 * Prisma — `FR-GEL-060` forbids the contract knowing its implementation, and a
 * `Prisma.TransactionClient` here would make `packages/loop-contract` depend on
 * the ORM the backend happens to use today.
 *
 * Branded rather than empty: an empty interface is satisfied by `{}`, so a
 * caller could pass a plain object and typecheck cleanly while writing outside
 * any transaction. The brand forces an explicit cast at the one place the real
 * handle is created — `backend/src/modules/loop/`, where the ORM is known.
 */
export interface TransactionHandle {
  readonly __loopTransaction: 'opaque';
}

// ───────────────────────────────────────────────────────────── stage execution

export interface TransitionContext {
  readonly object: LoopObjectRef;
  readonly fromStage: LoopStage;
  readonly toStage: LoopStage;
  readonly actor: ActorRef;
  readonly configVersion: number;
  readonly trigger?: { readonly ruleId: string; readonly eventId: string };
}

export interface StageResult {
  readonly ok: boolean;
  readonly detail?: string;
}

/**
 * `FR-GEL-007` — a configuration naming a stage with no registered handler
 * fails to load. One handler, one stage: a handler covering several stages
 * would make "is this stage handled?" a question with a partial answer.
 */
export interface StageHandler {
  readonly stage: LoopStage;
  enter(ctx: TransitionContext): Promise<StageResult>;
}

// ──────────────────────────────────────────────────────────────── the Decide seam

export interface DecisionRequest {
  readonly object: LoopObjectRef;
  readonly toStage: LoopStage;
  readonly actor: ActorRef;
}

export interface DecisionResult {
  readonly permitted: boolean;
  readonly decisionId: string;
  readonly explanation: string;
}

/**
 * Filled by `EPIC-031`. **Absent ⇒ refuse** (`FR-GEL-062`).
 *
 * Stated as a contract obligation rather than an implementation choice, because
 * the failure mode is silent: a substrate that permits when its policy provider
 * is missing looks identical to one that permits because policy said so.
 */
export interface PolicyProvider {
  decide(request: DecisionRequest): Promise<DecisionResult>;
}

// ─────────────────────────────────────────────────────────────── the Evidence seam

export interface EvidenceContractView {
  readonly unmet: readonly string[];
  readonly complete: boolean;
}

/** Filled by `EPIC-032`. Absent ⇒ the Evidence stage cannot be configured in. */
export interface EvidenceProvider {
  contractFor(objectRef: LoopObjectRef): Promise<EvidenceContractView>;
}

// ──────────────────────────────────────────────────────────────────── the gates

/**
 * `FR-GEL-021`, `BR-0060`. **Four members, no fifth, no default.**
 *
 * There is no `skipped` and no `not-applicable`. A gate that did not run
 * resolves to `exception` (recorded, authorised) or `violation` (recorded, not)
 * — those are the only two ways past it, and both leave a record. Adding a
 * fifth member here is how *"a skipped gate is never a silent pass"* would stop
 * being true, which is why the tuple is frozen and asserted.
 */
export const GATE_RESULTS = Object.freeze([
  'satisfied',
  'refused',
  'exception',
  'violation',
] as const);

export type GateResult = (typeof GATE_RESULTS)[number];

export function isGateResult(candidate: string): candidate is GateResult {
  return (GATE_RESULTS as readonly string[]).includes(candidate);
}

export interface GateOutcome {
  readonly gateId: string;
  /** Required. A `GateOutcome` with no result is not constructible. */
  readonly result: GateResult;
  readonly detail?: string;
}

/** Filled by `EPIC-021`. */
export interface GateProvider {
  evaluate(gateId: string, ctx: TransitionContext): Promise<GateOutcome>;
}

// ───────────────────────────────────────────────────────────────────── the audit

export interface TransitionAuditEntry {
  readonly object: LoopObjectRef;
  readonly fromStage: LoopStage;
  readonly toStage: LoopStage;
  readonly actor: ActorRef;
  readonly outcome: string;
  readonly occurredAt: Date;
}

/**
 * Filled by `EPIC-004`. `FR-GEL-041`.
 *
 * **`tx` is not optional here**, and that is the one deliberate difference from
 * the existing `AuditService.record(input, tx?)`. The transition and its audit
 * record must be atomic; an optional handle permits exactly the call that breaks
 * that, and permits it silently, because the non-atomic version compiles and
 * passes every behavioural test until the process dies between the two writes.
 */
export interface AuditSink {
  record(entry: TransitionAuditEntry, tx: TransactionHandle): Promise<void>;
}
