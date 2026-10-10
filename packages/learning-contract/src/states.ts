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
