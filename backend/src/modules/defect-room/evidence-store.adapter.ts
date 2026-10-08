/**
 * `T1797` (EPIC-032 convergence) — `DEFECT_ROOM_PORTS`' `EvidenceStore`, filled.
 *
 * The port declared `filledBy: 'EPIC-032'` and stayed unbound, so every
 * reproduction carrying evidence refused (`R-035-7`). This binds it to
 * `EvidenceService.contribute` — reproduction evidence is filed in the evidence
 * store, under the attested artifact's access rules, never as a Room-local
 * copy (`FR-DFR-033`, `BR-0062`).
 *
 * ## The version the port does not carry
 *
 * The port hands over a defect id and an attestation, and names no artifact
 * version. `FR-EVS-042` refuses a contribution naming none rather than attaching
 * it to whatever is current. So the adapter reads the defect and attests the
 * version **the defect contests** — `contestedArtifactVersion`, *"the version
 * REPORTED. Nothing re-targets it later"* (`FR-DFR-024`). That version is named
 * by the report, not inferred at write time. A defect that cannot be found, or
 * a version that is not a version number (`latest`, `v3-beta`), refuses.
 *
 * ## Attached to the defect, as an outcome
 *
 * Evidence attaches to an artifact, a task, a decision or an outcome
 * (`FR-EVS-004`). A reproduction is an observed outcome of the contested
 * artifact, so it attaches to `outcome:<defectId>`; the attested artifact is the
 * contested one. The Room keeps the returned evidence id on its reproduction row.
 */
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { EvidenceAttestation, EvidenceStorePort } from './reproduction.service.js';

/** The slice of the Room's store this adapter reads. */
export interface DefectLookup {
  findDefect(
    workspaceId: string,
    id: string,
  ): Promise<{ projectId: string; contestedArtifactRef: string; contestedArtifactVersion: string } | null>;
}

/** The slice of `EvidenceService` this adapter calls. */
export interface EvidenceContributor {
  contribute(principal: { workspaceId: string; userId: string }, body: unknown): Promise<{ id: string }>;
}

/** `3`, `v3` or `V3` → 3. Anything else is not a version number, and is not guessed into one. */
function versionNumber(raw: string): number | null {
  const match = /^[vV]?(\d+)$/.exec(raw.trim());
  if (match === null) return null;
  const n = Number(match[1]);
  return n >= 1 ? n : null;
}

export class EvidenceServiceStore implements EvidenceStorePort {
  constructor(
    private readonly defects: DefectLookup,
    private readonly evidence: EvidenceContributor,
  ) {}

  async contribute(input: {
    workspaceId: string;
    workRef: string;
    attestation: EvidenceAttestation;
  }): Promise<{ evidenceRef: string }> {
    const defect = await this.defects.findDefect(input.workspaceId, input.workRef);
    if (defect === null) throw new NotFoundError(`No defect ${input.workRef}.`);

    const version = versionNumber(defect.contestedArtifactVersion);
    if (version === null) {
      throw new ValidationFailedError(
        `defect ${input.workRef} contests version "${defect.contestedArtifactVersion}", which is not a ` +
          'version number; evidence must name the version it attests, never a guess (FR-EVS-042)',
      );
    }

    const stored = await this.evidence.contribute(
      { workspaceId: input.workspaceId, userId: 'defect-room' },
      {
        attestation: input.attestation,
        attestedArtifact: { id: defect.contestedArtifactRef, version },
        attachedTo: { type: 'outcome', id: input.workRef },
        producedAt: new Date().toISOString(),
        source: { uri: 'pmi:defect-room' },
        projectId: defect.projectId,
      },
    );
    return { evidenceRef: stored.id };
  }
}
