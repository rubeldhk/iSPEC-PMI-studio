/**
 * `T728` — the four ports this Epic requires. `FR-DPE-050`.
 *
 * Every one **refuses when absent** — `EPIC-030` `FR-GEL-062` and `EPIC-032`
 * fail the same direction, so a governed action cannot slip through the seam
 * between substrate Epics.
 */
import type { RiskBand } from './bands.js';
import type { DecisionRequest, GateOutcome, SteeringRuleRef } from './types.js';

export interface PortDeclaration {
  readonly name: 'SteeringSource' | 'GateProvider' | 'EvidenceContractSource' | 'AuditSink';
  readonly filledBy: 'EPIC-019' | 'EPIC-021' | 'EPIC-032' | 'EPIC-004';
  readonly absent: 'refuse';
}

export const DECISION_PORTS: readonly PortDeclaration[] = Object.freeze([
  { name: 'SteeringSource', filledBy: 'EPIC-019', absent: 'refuse' },
  { name: 'GateProvider', filledBy: 'EPIC-021', absent: 'refuse' },
  { name: 'EvidenceContractSource', filledBy: 'EPIC-032', absent: 'refuse' },
  { name: 'AuditSink', filledBy: 'EPIC-004', absent: 'refuse' },
] as const);

// ─────────────────────────────────────────────────────────── SteeringSource

/** One classification rule — the content of a `risk-classification` steering document. */
export interface ClassificationRule {
  /** An action type, or a prefix ending in `*` (`release.*`). */
  readonly actionPattern: string;
  /** Optional target type the rule is limited to. */
  readonly targetType?: string;
  readonly band: RiskBand;
}

/** The ruleset `resolveSteering()` chose for one decision's scope. */
export interface ResolvedRuleset {
  readonly rules: readonly ClassificationRule[];
  /** The steering document the rules came from; `null` when none applies. */
  readonly source: SteeringRuleRef | null;
  /** `FR-DPE-042` — the `SteeringOverride`, quoted, when scopes conflicted. */
  readonly precedence?: string;
}

/** Filled by `EPIC-019`. Absent, or throwing, ⇒ refuse: unreadable rules are not permissive rules. */
export interface SteeringSource {
  rulesetFor(scope: { readonly workspaceId: string; readonly projectId: string }): Promise<ResolvedRuleset>;
}

// ─────────────────────────────────────────────────────────── GateProvider

/** Filled by `EPIC-021`. Absent ⇒ a required gate resolves `violation`, never `satisfied`. */
export interface GateProvider {
  evaluate(gateId: string, request: DecisionRequest): Promise<GateOutcome>;
}

// ─────────────────────────────────────────────────────── EvidenceContractSource

/** Filled by `EPIC-032`. Absent ⇒ a medium-band evidence gate refuses. */
export interface EvidenceContractSource {
  isSatisfied(
    evidenceContractRef: string,
    ctx: { readonly workspaceId: string; readonly projectId: string },
  ): Promise<{ readonly satisfied: boolean; readonly unmet: readonly string[] }>;
}

// ─────────────────────────────────────────────────────────── AuditSink

export interface DecisionAuditEntry {
  readonly workspaceId: string;
  readonly decisionId: string;
  readonly actionType: string;
  readonly outcome: string;
  readonly actor: string;
}

/** Filled by `EPIC-004`. Absent ⇒ refuse: a decision that cannot be recorded is not taken (`FR-DPE-016`). */
export interface AuditSink {
  record(entry: DecisionAuditEntry): Promise<void>;
}
