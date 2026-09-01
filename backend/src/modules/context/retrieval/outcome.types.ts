/**
 * `T1229` (EPIC-038) — the counts that make a short read impossible to ignore,
 * and the closed vocabulary of exclusions.
 *
 * `R-038-2`, `R-038-3`, `FR-CTX-035`.
 *
 * ## The finding this file exists for
 *
 * pgvector's documentation states that with an approximate index **filtering is
 * applied after the index scan**, bounded by `hnsw.ef_search` (default 40). A
 * workspace predicate is restrictive by construction in a multi-tenant corpus,
 * so a query asking for forty candidates can legitimately receive eight.
 *
 * A retrieval layer that returns eight of forty *without saying so* produces a
 * package that **names no exclusions** — because the material never reached the
 * assembler, so there was nothing to exclude. The package looks complete. That
 * is `FR-CTX-035`'s prohibition on silent truncation, defeated one layer below
 * where it was written.
 *
 * So the counts travel **with** the candidates. A caller cannot take the list
 * without taking the evidence of how many were asked for, which is the
 * difference between a shortfall being reportable and a shortfall being
 * reported.
 *
 * `EPIC-035`'s `FR-DFR-064` is the same rule one Epic over: an unknown set and
 * an empty set must not behave alike.
 *
 * Framework-free (PC-1).
 */

/** `FR-CTX-033`–`FR-CTX-035`, `FR-CTX-053`, `FR-CTX-017` — the five, closed. */
export const EXCLUSION_REASONS = Object.freeze([
  'permission',
  'classification',
  'budget',
  'boundary',
  'stale',
] as const);

export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export interface ExclusionRecord {
  readonly id: string;
  /** `FR-002` — its own tenant, for the same reason `PackageItem` carries one. */
  readonly workspaceId: string;
  readonly packageId: string;
  readonly sourceType: string;
  readonly sourceId: string;
  /** Required, with no default — a reason by omission is one nobody can explain. */
  readonly reason: ExclusionReason;
  /** The specific rule or limit, in words a reader can act on. */
  readonly detail: string;
  /**
   * `FR-CTX-038`, `FR-CTX-039` — whether the excluded item was marked essential.
   *
   * On the exclusion rather than only on the candidate, because the refusal it
   * causes must be explainable **after** the fact: the package refused, and
   * this is the item that caused it.
   */
  readonly wasEssential: boolean;
}

/** One ranked candidate, before permission and classification have spoken. */
export interface Candidate {
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceVersion: string;
  /** `FR-CTX-014` — the score that ranked it. Never defaulted; see `T1308`. */
  readonly relevanceScore: number;
}

/**
 * What retrieval answers: the candidates **and** how many were asked for.
 *
 * One shape rather than a list plus a separate `getCounts()`, because a second
 * call is a call somebody forgets — and forgetting it looks exactly like there
 * being nothing to report.
 */
export interface RetrievalOutcome {
  readonly requested: number;
  readonly returned: number;
  readonly candidates: readonly Candidate[];
}

export interface RetrievalShortfall {
  readonly requested: number;
  readonly returned: number;
  /** Why it may have happened — the mechanism, not a diagnosis. */
  readonly because: string;
}

/**
 * `R-038-3` — a short read, or `null` when the read was full.
 *
 * The wording names the mechanism and stops there. A short read under a
 * restrictive filter is **expected behaviour** rather than an error, so
 * asserting a cause would be a guess; naming what pgvector actually does lets
 * whoever reads the package judge for themselves.
 */
export function shortfallOf(outcome: RetrievalOutcome): RetrievalShortfall | null {
  if (outcome.returned > outcome.requested) {
    // Not fussiness. If this happens the count is wrong, and every shortfall
    // computed from it afterwards is wrong in the direction that hides gaps.
    throw new Error(
      `retrieval returned ${outcome.returned} candidates, more than requested (${outcome.requested})`,
    );
  }
  if (outcome.returned === outcome.requested) return null;
  return {
    requested: outcome.requested,
    returned: outcome.returned,
    because:
      'the index filter is applied after the approximate scan and is bounded by hnsw.ef_search, ' +
      'so a restrictive filter can return fewer candidates than requested (R-038-2)',
  };
}
