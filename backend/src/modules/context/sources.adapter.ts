/**
 * `T1810`, `T1812` (EPIC-038) — the governed sources, read from the modules
 * that own them.
 *
 * `FR-CTX-011`, `FR-CTX-015`, `FR-CTX-017`, `FR-CTX-050`, `FR-CTX-063`. One
 * adapter fills two ports for the two governed-document types this programme
 * already serves:
 *
 * - `SourceVersionReader` — the current version of a source, for staleness,
 *   index health and inspection drift.
 * - `ArtifactSource` — one version's text **and the project that owns it**,
 *   for indexing and for the project boundary.
 *
 * ## Only through public services
 *
 * It asks `RequirementsService` and `SpecificationsReadService` — the same
 * calls their own routes make, with their own tenancy guards — and reads no
 * table of theirs. A second reader of another Epic's schema is how two Epics
 * end up disagreeing about what "current" means.
 *
 * ## What a version is, per type
 *
 * | Type | Version | Why |
 * |---|---|---|
 * | `requirement` | its `contentHash` | `EPIC-007` moves the hash on every material edit and on nothing else |
 * | `specification` | `v<versionNumber>` | `EPIC-009` appends a numbered version per content change |
 *
 * Only the current requirement is readable as text: `EPIC-007`'s history keeps
 * prior states without their hash, so an older hash cannot be matched to one.
 *
 * ## Three answers, never two
 *
 * *Resolves*, *does not resolve* (absent, other workspace, retired, no current
 * version) and *unknown* (a type no module serves). A failing read is an outage
 * and propagates — reported as gone, it would mark every entry stale.
 *
 * Framework-free (PC-1).
 */
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { SourceVersionReader } from './inspection.service.js';
import type { ArtifactSource } from './retrieval/index.service.js';

/** The slice of `RequirementsService` read here. */
export interface RequirementReader {
  get(
    workspaceId: string,
    id: string,
  ): Promise<{
    id: string;
    projectId: string;
    reference: string;
    description: string;
    contentHash: string;
    retiredAt: Date | null;
  }>;
}

/** The slice of `SpecificationsReadService` read here. */
export interface SpecificationReader {
  get(
    workspaceId: string,
    id: string,
  ): Promise<{
    id: string;
    projectId: string;
    title: string;
    currentVersion: { versionNumber: number; contentRaw: string } | null;
  }>;
  versions(workspaceId: string, id: string): Promise<{ versionNumber: number; contentRaw: string }[]>;
}

/**
 * `T1828`, `R-038-8` — the slice of `EPIC-037`'s public facade read here: an
 * execution's current-state projection, never its event stream.
 */
export interface ExecutionProjectionReader {
  snapshot(
    workspaceId: string,
    executionId: string,
  ): Promise<{
    executionId: string;
    command: string;
    surface: string;
    lifecycleState: string;
    governanceState: string;
    projectedThroughSequence: number;
    /** `T1857` — `null` is workspace-wide by EPIC-037's record; absent is unknown. */
    projectId?: string | null;
  } | null>;
}

export interface GovernedSourceServices {
  readonly requirements: RequirementReader;
  readonly specifications: SpecificationReader;
  /** `T1828` — absent leaves execution history unknown and unreadable. */
  readonly executions?: ExecutionProjectionReader;
}

/** `null` for absent or another workspace's — the guard's one opaque outcome. */
async function absentAsNull<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export function governedSources(services: GovernedSourceServices): SourceVersionReader & ArtifactSource {
  return {
    async currentVersion(workspaceId, sourceType, sourceId) {
      if (sourceType === 'requirement') {
        const requirement = await absentAsNull(() => services.requirements.get(workspaceId, sourceId));
        return requirement === null || requirement.retiredAt !== null
          ? { resolves: false }
          : { resolves: true, version: requirement.contentHash };
      }
      if (sourceType === 'specification') {
        const specification = await absentAsNull(() => services.specifications.get(workspaceId, sourceId));
        return specification?.currentVersion
          ? { resolves: true, version: `v${specification.currentVersion.versionNumber}` }
          : { resolves: false };
      }
      if (sourceType === 'execution-history' && services.executions) {
        // A projection's version is how far it has projected — the version the
        // assembler's history judge compares against (`T1288`).
        const snapshot = await services.executions.snapshot(workspaceId, sourceId);
        return snapshot === null
          ? { resolves: false }
          : { resolves: true, version: String(snapshot.projectedThroughSequence) };
      }
      return {
        resolves: 'unknown',
        reason: `no module in the programme serves current versions of '${sourceType}' to this Epic`,
      };
    },

    async read(workspaceId, sourceType, sourceId, version) {
      if (sourceType === 'requirement') {
        const requirement = await absentAsNull(() => services.requirements.get(workspaceId, sourceId));
        if (requirement === null || requirement.retiredAt !== null || requirement.contentHash !== version) {
          return null;
        }
        return { text: `${requirement.reference}: ${requirement.description}`, projectId: requirement.projectId };
      }
      if (sourceType === 'specification') {
        const specification = await absentAsNull(() => services.specifications.get(workspaceId, sourceId));
        if (specification === null) return null;
        const wanted = /^v(\d+)$/.exec(version);
        if (wanted === null) return null;
        const found = (await services.specifications.versions(workspaceId, sourceId)).find(
          (v) => v.versionNumber === Number(wanted[1]),
        );
        return found === undefined
          ? null
          : { text: `${specification.title}\n\n${found.contentRaw}`, projectId: specification.projectId };
      }
      if (sourceType === 'execution-history' && services.executions) {
        const snapshot = await services.executions.snapshot(workspaceId, sourceId);
        // Only the version the projection is at: an older projection is not
        // retained, so it does not resolve.
        if (snapshot === null || String(snapshot.projectedThroughSequence) !== version) return null;
        // `T1857`, `FR-CTX-050` — the project the history belongs to. A snapshot
        // that cannot say is refused: indexing it as workspace-wide would put
        // one project's history into another's packages unmarked.
        if (snapshot.projectId === undefined) {
          throw new ValidationFailedError(
            `EPIC-037 did not say which project execution ${sourceId} belongs to, so its history ` +
              'is not indexed rather than indexed as workspace-wide (FR-CTX-050)',
          );
        }
        return {
          text:
            `execution ${snapshot.executionId}: ${snapshot.command} on ${snapshot.surface}, ` +
            `${snapshot.lifecycleState}, governance ${snapshot.governanceState}`,
          projectId: snapshot.projectId,
        };
      }
      return null;
    },
  };
}
