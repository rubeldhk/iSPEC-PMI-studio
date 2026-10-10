/**
 * `T2304`/`T2306` (EPIC-048) — the vocabularies (`contracts/learning-contract.md` §1).
 *
 * **No `unknown` member anywhere.** A state the code cannot name is refused, not
 * defaulted — `EPIC-031`'s `RISK_BANDS` reasoning.
 */

/** `FR-LRN-004` — exactly six. */
export const CANDIDATE_STATES = Object.freeze([
  'proposed',
  'pending-review',
  'approved',
  'rejected',
  'expired',
  'withdrawn',
] as const);
export type CandidateState = (typeof CANDIDATE_STATES)[number];

/** After one of these, nothing is appended to the candidate's transition log. */
export const TERMINAL_CANDIDATE_STATES = Object.freeze(['approved', 'rejected', 'expired', 'withdrawn'] as const);
export type TerminalCandidateState = (typeof TERMINAL_CANDIDATE_STATES)[number];

export function isTerminalCandidateState(state: CandidateState): boolean {
  return (TERMINAL_CANDIDATE_STATES as readonly string[]).includes(state);
}

/** `R-048-12` — only `new` may take the automatic path. */
export const CANDIDATE_KINDS = Object.freeze(['new', 'supersede', 'deprecate', 'widen-scope'] as const);
export type CandidateKind = (typeof CANDIDATE_KINDS)[number];

/** `FR-LRN-013` — stated by the submitter, never computed or raised. */
export const CONFIDENCE_LEVELS = Object.freeze(['low', 'medium', 'high'] as const);
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** `EPIC-031`'s three bands (`ADR-0025`) — a submitter may only *propose* one (`FR-LRN-023`). */
export const RISK_BANDS = Object.freeze(['low', 'medium', 'high'] as const);
export type RiskBand = (typeof RISK_BANDS)[number];

/** `FR-LRN-032`, `FR-LRN-033`. */
export const VERSION_STATUSES = Object.freeze(['current', 'superseded', 'deprecated'] as const);
export type VersionStatus = (typeof VERSION_STATUSES)[number];

/**
 * `FR-LRN-015`, `FR-LRN-016`. `retired` is **reserved**: `EPIC-032` has no
 * retirement yet (`R-048-8`, `RK-6`), so it is never produced.
 */
export const EVIDENCE_STATES = Object.freeze(['verified', 'integrity-failed', 'unresolvable', 'withheld', 'retired'] as const);
export type EvidenceState = (typeof EVIDENCE_STATES)[number];

/** `FR-LRN-027` — there is no `agent` member, so no code can record an AI approver. */
export const APPROVER_KINDS = Object.freeze(['human', 'policy'] as const);
export type ApproverKind = (typeof APPROVER_KINDS)[number];

/** `FR-LRN-014`. */
export const SCOPE_KINDS = Object.freeze(['project', 'workspace', 'projects'] as const);
export type ScopeKind = (typeof SCOPE_KINDS)[number];

/** `FR-LRN-037` — review flags. A flag never changes status. */
export const FLAG_KINDS = Object.freeze([
  'evidence-changed',
  'source-invalid',
  'attestation-missing',
  'policy-auto-executed-review',
  'decision-not-accepted',
] as const);
export type FlagKind = (typeof FLAG_KINDS)[number];

/** `FR-LRN-053` — retrievability is recorded, never assumed. */
export const RETRIEVABILITY_OUTCOMES = Object.freeze(['retrievable', 'not-yet-retrievable'] as const);
export type RetrievabilityOutcome = (typeof RETRIEVABILITY_OUTCOMES)[number];
