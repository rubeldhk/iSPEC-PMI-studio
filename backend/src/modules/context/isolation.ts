/**
 * `T1256` (EPIC-038) — the tenant boundary, and the one authorised way through
 * it.
 *
 * `FR-CTX-050`–`FR-CTX-053`, `SC-CTX-003`.
 *
 * ## The failure this prevents is the only one here that cannot be undone
 *
 * Every other mistake in this Epic is correctable. A wrong classification is
 * reclassified, a superseded item re-marked, a badly budgeted package assembled
 * again. **A leaked package has already been read**, and there is no version of
 * "fix it" that unreads material.
 *
 * That asymmetry is why this file refuses by default and requires a named
 * authorisation to permit — rather than permitting by default and requiring a
 * prohibition to refuse. `FR-CTX-053` states it directly: *the absence of a
 * prohibition is not a permission.*
 *
 * ## What this file is NOT
 *
 * It is not authorisation. `R-038-7`: workspace scoping is a property of the
 * **data** — which rows exist for this query — and authorisation is a property
 * of the **actor**. They look like the same check and are not, and a system
 * that treats the partition as the permission grants every member of a
 * workspace everything in it.
 *
 * That mistake is invisible precisely because the boundary it *does* enforce is
 * visibly working. `EPIC-024` adjudicates the actor's side, this file the
 * data's, and `T1257` asserts that satisfying one does not satisfy the other.
 *
 * ## Direction
 *
 * An authorisation is between **two named workspaces, one way**. *"A may read
 * B's handbook"* does not imply the reverse, and a symmetric lookup — the easy
 * one to write — grants a permission nobody stated, to the workspace that was
 * being generous.
 *
 * Framework-free (PC-1).
 */

/** A source, and the workspace that owns it. */
export interface OwnedSource {
  readonly sourceType: string;
  readonly sourceId: string;
  /** The workspace the material belongs to, which may not be the requester's. */
  readonly workspaceId: string;
}

/** `FR-CTX-051` — the explicit permission for one source to cross, one way. */
export interface ReusableAuthorisation {
  readonly id: string;
  readonly sourceType: string;
  readonly sourceId: string;
  /** The granting workspace: the one that owns the source. */
  readonly workspaceId: string;
  /** The single workspace permitted to read it. */
  readonly toWorkspaceId: string;
  readonly authorisedBy: string;
  readonly rationale: string;
}

export interface AuthorisationReader {
  /**
   * Both endpoints are required arguments, and deliberately.
   *
   * A lookup keyed on the source alone would let every workspace in once any
   * workspace was let in; a lookup ignoring direction would grant the reverse
   * crossing nobody stated.
   */
  find(input: {
    sourceType: string;
    sourceId: string;
    fromWorkspaceId: string;
    toWorkspaceId: string;
  }): Promise<ReusableAuthorisation | null>;
}

/**
 * What the boundary decided.
 *
 * A discriminated union so a refusal cannot be read as a permission with a
 * message attached, and so the `authorisationRef` exists exactly on the arm
 * that requires it — an item marked as a crossing with nothing naming the
 * authorisation does not typecheck (`FR-CTX-052`).
 */
export type BoundaryVerdict =
  | { readonly allowed: true; readonly crossBoundary: false }
  | {
      readonly allowed: true;
      readonly crossBoundary: true;
      readonly authorisationRef: string;
    }
  | { readonly allowed: false; readonly reason: string };

/**
 * `FR-CTX-050`–`FR-CTX-053` — may this source appear in that workspace's
 * package?
 *
 * A pure function of the source, the requesting workspace and the
 * authorisations. It reads nothing else and decides nothing about the actor.
 */
export async function judgeBoundary(
  source: OwnedSource,
  requestingWorkspaceId: string,
  authorisations: AuthorisationReader,
): Promise<BoundaryVerdict> {
  if (source.workspaceId === requestingWorkspaceId) {
    // Not a crossing, and therefore not marked as one. If own-workspace
    // material were marked too, `crossBoundary` would stop distinguishing
    // anything and a reviewer scanning for crossings would find every item.
    return { allowed: true, crossBoundary: false };
  }

  const authorisation = await authorisations.find({
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    fromWorkspaceId: source.workspaceId,
    toWorkspaceId: requestingWorkspaceId,
  });

  if (!authorisation) {
    // `FR-CTX-053`. The refusal names the owning workspace and what is missing,
    // and deliberately does **not** cite any authorisation pointing the other
    // way: a reader seeing one named in a refusal would conclude the system was
    // confused rather than that a second grant is needed.
    return {
      allowed: false,
      reason:
        `${source.sourceType} ${source.sourceId} belongs to workspace ${source.workspaceId} ` +
        `and no authorisation permits ${requestingWorkspaceId} to read it. The absence of a ` +
        'prohibition is not a permission (FR-CTX-050, FR-CTX-053)',
    };
  }

  return { allowed: true, crossBoundary: true, authorisationRef: authorisation.id };
}
