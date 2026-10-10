/**
 * `T724` — the decision-authority record. `BR-0005`, `FR-DPE-014`.
 *
 * **Published provisionally for `U-02`**, which adopts it unchanged when
 * declared (clarified 2026-08-22). Exactly the five elements `BR-0005` names,
 * all required. A shape, not a class, so adoption costs nothing but an import.
 */

/** `FR-DPE-032` — an automated decision is distinguishable from a human one without inference. */
export interface ActorRef {
  readonly kind: 'human' | 'automation';
  readonly id: string;
}

export type AuthorityDecision = 'auto-executed' | 'approved' | 'refused' | 'exception';

export interface DecisionAuthorityRecord {
  readonly actor: ActorRef;
  readonly authorityBasis: string;
  readonly objectVersion: string;
  readonly decision: AuthorityDecision;
  /** ISO-8601. */
  readonly decidedAt: string;
}

export const AUTHORITY_RECORD_FIELDS = Object.freeze([
  'actor',
  'authorityBasis',
  'objectVersion',
  'decision',
  'decidedAt',
] as const satisfies readonly (keyof DecisionAuthorityRecord)[]);
