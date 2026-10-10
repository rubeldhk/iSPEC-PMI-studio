/**
 * `T859j` — `AccessPolicy` bound to `EPIC-024` (`FR-EVS-015`, `BR-0062`).
 *
 * Evidence must not become a side channel around artifact access: a scan
 * result naming a file someone cannot read is a disclosure with better
 * formatting. So reading evidence about an artifact asks `EPIC-024` the same
 * question reading the artifact would.
 *
 * ## Which artifacts `EPIC-024` governs
 *
 * `EPIC-024`'s rule is strict — *"no grants means nobody has been given access,
 * not that everybody has"* — and it is applied to the artifact types the
 * platform puts under grants: `specification` and `project`. For those, this
 * adapter returns exactly `effectivelyReadable`, derivation sources included.
 *
 * Evidence attests other things too — a file at a commit, a build, a running
 * service — that have no grant model at all. Applying the strict rule to them
 * would refuse every read, because nothing can ever hold a grant on them. For
 * those the rule that does apply is the workspace boundary (`FR-EVS-016`),
 * which every repository query already enforces in its `where`. Recorded as
 * `DEF-032-003` so the list of governed types has an owner.
 *
 * A check that cannot be made refuses: an error from `EPIC-024` is a `false`,
 * never a pass.
 */
import type { AccessPolicy, AttestedTarget, EvidenceReader } from '@pmi/evidence-contract';

/** The types `EPIC-024` keys grants by today. */
export const ACCESS_GOVERNED_TYPES: ReadonlySet<string> = new Set(['specification', 'project']);

/** The slice of `AccessInheritanceService` this adapter reads. */
export interface ReadabilityCheck {
  effectivelyReadable(
    workspaceId: string,
    userId: string,
    artifact: { artifactType: string; artifactId: string },
  ): Promise<boolean>;
}

export class AccessControlEvidencePolicy implements AccessPolicy {
  constructor(private readonly access: ReadabilityCheck) {}

  async canRead(reader: EvidenceReader, target: AttestedTarget): Promise<boolean> {
    if (!ACCESS_GOVERNED_TYPES.has(target.type)) return true;
    try {
      return await this.access.effectivelyReadable(reader.workspaceId, reader.userId, {
        artifactType: target.type,
        artifactId: target.id,
      });
    } catch {
      return false;
    }
  }
}
