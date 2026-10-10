/**
 * `T1276`, `T1278` (EPIC-038) — building, versioning and stale-marking the
 * index. `FR-CTX-015`–`FR-CTX-018`, `R-038-4`–`R-038-6`.
 *
 * ## One source at a time, and only that way
 *
 * `reindex` names one source at one version. There is deliberately no
 * rebuild-all: a corpus rebuild is an operation nobody runs, which is how an
 * index becomes permanently stale in practice (`R-038-6`). An entry already at
 * that version and model is left alone — `indexedAt` included — so "current"
 * means current rather than "recently rewritten".
 *
 * ## The order of refusals is the contract's
 *
 * | Check | Refusal |
 * |---|---|
 * | Type outside `FR-CTX-015`'s approved set | `400` — not configurable |
 * | Type unclassified, or classified not indexable | `400` naming the class |
 * | No embedding provider | `503` naming `EmbeddingPort` |
 * | No artifact source | `503` naming `ArtifactSource` |
 * | The version does not resolve | `400` — nothing is written |
 *
 * ## Staleness is a version comparison (`R-038-5`)
 *
 * `health` compares each entry's recorded version with the source's current
 * one. Never a timestamp: a re-save moves a clock without changing meaning.
 * With no reader of current versions, the stale count is `null` and says why —
 * an unknown count reported as zero is the most reassuring wrong answer there
 * is.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { GovernanceSeamUnboundError, ValidationFailedError } from '../../../core/errors.js';
import type { ContextStore, IndexEntry } from '../context.store.js';
import type { SourceVersionReader } from '../inspection.service.js';
import { embedChecked, embeddingUnbound, type EmbeddingPort } from './embedding.port.js';
import type { VectorIndex } from './vector.index.js';

/**
 * `FR-CTX-015` — governed documents and execution history. Source code and
 * imported external documents are out of scope, and no configuration changes
 * that: classification decides *which approved types* a workspace indexes, not
 * *what counts as approved*.
 */
export const APPROVED_SOURCE_TYPES: ReadonlySet<string> = new Set([
  'specification',
  'requirement',
  'baseline',
  'decision',
  'execution-history',
]);

/**
 * `ArtifactSource` — the corpus. `EPIC-033` and `EPIC-032` own the documents;
 * this Epic reads one version of one source. `null` when it does not resolve.
 */
export interface ArtifactSource {
  read(
    workspaceId: string,
    sourceType: string,
    sourceId: string,
    version: string,
  ): Promise<{ text: string; projectId?: string | null } | null>;
}

export interface ReindexRequest {
  readonly workspaceId: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceVersion: string;
}

export interface IndexHealth {
  readonly entryCount: number;
  /** The active model, or `null` while no provider is bound. */
  readonly embeddingModelId: string | null;
  readonly models: readonly { modelId: string; dimension: number; count: number }[];
  /** `null` when it could not be determined — never `0` by default. */
  readonly staleCount: number | null;
  readonly staleness: string;
}

export class IndexService {
  constructor(
    private readonly store: ContextStore,
    private readonly vectors: VectorIndex,
    private readonly embedding: EmbeddingPort | null,
    private readonly artifacts: ArtifactSource | null,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async reindex(request: ReindexRequest): Promise<{ status: 'indexed' | 'current'; entry: IndexEntry }> {
    const { workspaceId, sourceType, sourceId, sourceVersion } = request;
    for (const [name, value] of Object.entries({ sourceType, sourceId, sourceVersion })) {
      if (typeof value !== 'string' || value.trim() === '') {
        throw new ValidationFailedError(`${name} is required to re-index one source (FR-CTX-018)`);
      }
    }

    if (!APPROVED_SOURCE_TYPES.has(sourceType)) {
      throw new ValidationFailedError(
        `'${sourceType}' is outside the approved source set — governed documents and execution ` +
          'history only (FR-CTX-015)',
      );
    }
    const sourceClass = await this.store.classifySource(workspaceId, sourceType);
    if (sourceClass === null) {
      throw new ValidationFailedError(
        `no source class is registered for '${sourceType}' in this workspace, so it is not indexed (FR-CTX-034)`,
      );
    }
    if (!sourceClass.indexable) {
      throw new ValidationFailedError(
        `'${sourceType}' is registered as ${sourceClass.securityClassification} and marked not ` +
          'indexable (FR-CTX-015)',
      );
    }

    if (this.embedding === null) throw embeddingUnbound();
    if (this.artifacts === null) {
      throw new GovernanceSeamUnboundError(
        'no artifact source is bound (ArtifactSource; EPIC-033 and EPIC-032 own the governed ' +
          'documents), so there is no corpus to index',
      );
    }

    const existing = await this.store.indexEntryFor(workspaceId, sourceType, sourceId);
    // `T1855` — current means the same version, the same model AND a vector.
    // An entry whose attach failed has none, and calling it current would leave
    // the source unrankable with nothing ever saying so.
    if (
      existing !== null &&
      existing.sourceVersion === sourceVersion &&
      existing.embeddingModelId === this.embedding.modelId &&
      (await this.vectors.isEmbedded(workspaceId, sourceType, sourceId))
    ) {
      return { status: 'current', entry: existing };
    }

    const source = await this.artifacts.read(workspaceId, sourceType, sourceId, sourceVersion);
    if (source === null) {
      throw new ValidationFailedError(
        `${sourceType} ${sourceId} at ${sourceVersion} does not resolve, so nothing was indexed`,
      );
    }

    const embedded = await embedChecked(this.embedding, [source.text]);
    const entry: IndexEntry = {
      id: randomUUID(),
      workspaceId,
      sourceType,
      sourceId,
      // `FR-CTX-016` — the version it was built from, which is what staleness
      // is later judged against.
      sourceVersion,
      // `T1808`, `FR-CTX-050` — the boundary needs to know whose this is.
      projectId: source.projectId ?? null,
      embeddingModelId: embedded.modelId,
      dimension: embedded.dimension,
      indexedAt: this.clock(),
    };
    await this.vectors.prepare(workspaceId, embedded.dimension);
    await this.store.upsertIndexEntry(entry);
    await this.vectors.attach(entry, embedded.vectors[0]!);
    return { status: 'indexed', entry };
  }

  async health(workspaceId: string, versions: SourceVersionReader | null): Promise<IndexHealth> {
    const entries = await this.store.indexEntriesFor(workspaceId);
    const models = await this.vectors.modelsIn(workspaceId);
    const base = {
      entryCount: entries.length,
      embeddingModelId: this.embedding?.modelId ?? null,
      models,
    };

    if (versions === null) {
      return {
        ...base,
        staleCount: null,
        staleness: 'unknown — no reader of current source versions is bound (FR-CTX-017)',
      };
    }
    const current = new Map<string, string>();
    let unknown = 0;
    try {
      for (const entry of entries) {
        const now = await versions.currentVersion(workspaceId, entry.sourceType, entry.sourceId);
        // `T1810` — an entry of a type nobody serves is not stale and not
        // current; it is left out of the comparison and counted.
        if (now.resolves === 'unknown') {
          unknown += 1;
          continue;
        }
        // A source that no longer resolves has moved away from its entry.
        current.set(`${entry.sourceType}:${entry.sourceId}`, now.resolves ? now.version : '∅');
      }
    } catch (error) {
      return {
        ...base,
        staleCount: null,
        staleness: `unknown — current versions could not be read (${error instanceof Error ? error.message : 'unknown fault'})`,
      };
    }
    const stale = await this.store.staleEntriesFor(workspaceId, current);
    return {
      ...base,
      staleCount: stale.length,
      staleness:
        unknown === 0
          ? 'known'
          : `known for ${entries.length - unknown} of ${entries.length} entries; ${unknown} are of types ` +
            'whose current version no module serves (FR-CTX-017)',
    };
  }
}
