/**
 * T094 — out-of-date flagging (F-04.7, **FR-032**).
 *
 * When a source requirement changes, every specification derived from it is
 * FLAGGED. It is not regenerated, not edited, not archived, and its lifecycle
 * state does not move. A human decides what to do next.
 *
 * That restraint is the requirement, not a simplification of it. Regenerating
 * on a requirement edit would silently replace a specification a team may have
 * reviewed, approved and baselined — and the person who edited one sentence in
 * one requirement would have no idea they had done it.
 *
 * The change SIGNAL is EPIC-007's content hash (`T069`), which normalises
 * whitespace and preserves case: re-spacing a requirement flags nothing, and a
 * change of meaning — including a priority or type change — flags everything
 * derived from it. This service compares the two hashes rather than storing its
 * own copy of the requirement, so there is one definition of "changed" in the
 * platform and it lives with the requirement.
 *
 * This service holds NO engine and no version writer. There is no seam through
 * which a future change could make flagging trigger a run.
 *
 * Framework-free (PC-1). Wired in `specifications.module.ts`.
 */

/** The narrow slice of the specification store this needs. Nothing more. */
export interface OutOfDateStore {
  findIdsForRequirement(workspaceId: string, requirementId: string): Promise<string[]>;
  flagOutOfDate(ids: string[]): Promise<string[]>;
}

export interface RequirementChange {
  workspaceId: string;
  requirementId: string;
  /** The content hash before the edit, and after it (EPIC-007 `T069`). */
  previousContentHash: string;
  currentContentHash: string;
}

export interface FlagResult {
  /** The specifications this change newly flagged. Already-flagged ones are not repeated. */
  flagged: string[];
}

export class OutOfDateService {
  constructor(private readonly store: OutOfDateStore) {}

  /**
   * Flag the specifications derived from a changed requirement.
   *
   * Returns only what CHANGED. An already-flagged specification is not
   * re-reported, so a caller that notifies on the result does not notify twice
   * for one stale specification.
   */
  async flagForRequirementChange(change: RequirementChange): Promise<FlagResult> {
    // Not a material change — nothing derived from it has gone stale.
    if (change.previousContentHash === change.currentContentHash) return { flagged: [] };

    const derived = await this.store.findIdsForRequirement(
      change.workspaceId,
      change.requirementId,
    );
    if (derived.length === 0) return { flagged: [] };

    // The flag, and nothing else. The store's signature offers no other field
    // to write, which is what keeps "flagged, never regenerated" true as this
    // code is maintained.
    return { flagged: await this.store.flagOutOfDate(derived) };
  }
}
