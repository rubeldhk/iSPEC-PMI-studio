/**
 * T242 — provenance stamping at generation time (FR-ENH-004, SC-ENH-001).
 *
 * Stamped ONCE, when the artifact is generated, never recomputed: recomputing
 * returns CURRENT steering, not the steering that applied — the difference
 * between provenance and a guess. The migration backs this with the shared
 * reject_mutation() trigger; the service refuses at the code layer too.
 *
 * An artifact generated with no steering in scope gets a row with an empty
 * set — never a missing row.
 */
import { ConflictError } from '../../core/errors.js';
import type { SteeringResolution } from './steering-resolver.js';

export interface SteeringApplicationRecord {
  id: string;
  workspaceId: string;
  artifactType: string;
  artifactId: string;
  appliedDocuments: SteeringResolution['resolved'];
  overrides: SteeringResolution['overrides'];
  appliedAt: Date;
}

export interface SteeringApplicationStore {
  append(row: SteeringApplicationRecord): Promise<SteeringApplicationRecord>;
  findForArtifact(artifactType: string, artifactId: string): Promise<SteeringApplicationRecord | null>;
}

export interface GenerationStamp {
  workspaceId: string;
  artifactType: string;
  artifactId: string;
  resolution: SteeringResolution;
}

export class SteeringApplicationService {
  constructor(private readonly store: SteeringApplicationStore) {}

  /** Called for EVERY generation — with an empty resolution when none applied. */
  async recordForGeneration(stamp: GenerationStamp): Promise<SteeringApplicationRecord> {
    const existing = await this.store.findForArtifact(stamp.artifactType, stamp.artifactId);
    if (existing) {
      throw new ConflictError(
        `Steering provenance for ${stamp.artifactType} ${stamp.artifactId} is stamped once, ` +
          'at generation time — it is already recorded and is never recomputed.',
      );
    }
    return this.store.append({
      id: `sa_${stamp.artifactType}_${stamp.artifactId}`,
      workspaceId: stamp.workspaceId,
      artifactType: stamp.artifactType,
      artifactId: stamp.artifactId,
      appliedDocuments: stamp.resolution.resolved,
      overrides: stamp.resolution.overrides,
      appliedAt: new Date(),
    });
  }
}

export class InMemorySteeringApplicationStore implements SteeringApplicationStore {
  private readonly rows: SteeringApplicationRecord[] = [];

  async append(row: SteeringApplicationRecord): Promise<SteeringApplicationRecord> {
    this.rows.push({ ...row });
    return { ...row };
  }

  async findForArtifact(
    artifactType: string,
    artifactId: string,
  ): Promise<SteeringApplicationRecord | null> {
    const hit = this.rows.find((r) => r.artifactType === artifactType && r.artifactId === artifactId);
    return hit ? { ...hit } : null;
  }
}
