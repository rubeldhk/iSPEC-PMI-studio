/**
 * T381 + T813 — run-time access snapshotting, NARROWED to the run
 * (FR-ACC-028, FR-ACC-028a).
 *
 * A long unattended run cannot half-apply a mid-flight permission change: the
 * snapshot is resolved once at start and READ FROM, never re-queried
 * (R-002-4). T813's narrowing: the snapshot governs only what the RUN may
 * read and produce. It is deliberately NOT consulted for reviewer
 * visibility — a review session sits open for days, and a snapshot there
 * would be a read capability that outlives a revoke, which is exactly what
 * FR-ACC-023 forbids. Reviewer visibility is `AccessEvaluationService`
 * (open-time, current grants).
 */
import type { AccessGrantRecord, ArtifactRef, GrantStore } from './access-grant.service.js';

export interface AccessSnapshot {
  resolvedAt: Date;
  /** Whose access the run carries — the initiator's. */
  userId: string;
  /** The initiator's active grants at start. */
  grants: Pick<AccessGrantRecord, 'artifactType' | 'artifactId' | 'level'>[];
  /** Artifacts that were restricted (had any active grant) at start. */
  restrictedArtifacts: ArtifactRef[];
}

/** The snapshot needs the restricted set; the store must be able to list it. */
export interface SnapshotGrantSource extends GrantStore {
  activeForUser(workspaceId: string, userId: string): Promise<AccessGrantRecord[]>;
  restrictedArtifacts(workspaceId: string): Promise<ArtifactRef[]>;
}

function sameArtifact(a: ArtifactRef, b: ArtifactRef): boolean {
  return a.artifactType === b.artifactType && a.artifactId === b.artifactId;
}

export class AccessSnapshotService {
  constructor(private readonly grants: SnapshotGrantSource) {}

  /** FR-ACC-028 — resolved ONCE, at run start. */
  async capture(workspaceId: string, userId: string, at?: Date): Promise<AccessSnapshot> {
    const active = await this.grants.activeForUser(workspaceId, userId);
    return {
      resolvedAt: at ?? new Date(),
      userId,
      grants: active.map((g) => ({
        artifactType: g.artifactType,
        artifactId: g.artifactId,
        level: g.level,
      })),
      restrictedArtifacts: await this.grants.restrictedArtifacts(workspaceId),
    };
  }

  /**
   * What the RUN may read — evaluated against the snapshot alone, never the
   * live grant table. A mid-run revocation therefore cannot half-apply; it
   * takes effect on the next run.
   */
  runMayRead(snapshot: AccessSnapshot, artifact: ArtifactRef): boolean {
    const restricted = snapshot.restrictedArtifacts.some((r) => sameArtifact(r, artifact));
    if (!restricted) return true;
    return snapshot.grants.some((g) => sameArtifact(g, artifact));
  }

  /**
   * T813 — the deliberate refusal: reviewer visibility NEVER reads the
   * snapshot. The method exists so a caller reaching for the snapshot to
   * decide reviewer visibility fails at compile time with a clear name
   * rather than silently reusing `runMayRead`.
   */
  reviewerVisibilityIsNotSnapshotScoped(): never {
    throw new Error(
      'Reviewer visibility is evaluated against CURRENT grants at session open ' +
        '(AccessEvaluationService, FR-ACC-028a) — the run snapshot governs only the run.',
    );
  }
}
