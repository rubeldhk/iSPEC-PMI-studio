/**
 * `T1279` (EPIC-038) — semantic ranking, built here rather than integrated.
 *
 * `FR-CTX-010`–`FR-CTX-014`, `R-038-2`–`R-038-4`. Fills `AssemblyPorts
 * ['retrieval']`.
 *
 * ## What it refuses
 *
 * - **No provider** — `503` naming `EmbeddingPort` (`FR-CTX-013`).
 * - **An index never built** for this workspace — `FR-CTX-012`: an unranked
 *   package is a different thing, and "nothing indexed" must not read as
 *   "nothing relevant".
 * - **A mixed index** — entries from a model other than the active one.
 *   Two models of one dimension produce incomparable spaces and the database
 *   computes distances across them without erroring (`R-038-4`).
 * - **A neighbour with no distance** — `T1308`: zero is a real distance, so a
 *   default would rank an unknown as a judgement.
 *
 * ## What it reports
 *
 * `requested` and `returned`, always (`R-038-3`). The vector index is
 * approximate and may return fewer than asked; that is a finding the package
 * carries, never an answer it absorbs.
 *
 * ## Staleness is marked here, and excluded by assembly
 *
 * With a reader of current versions, a candidate whose entry was built from an
 * older version carries `stale` (`FR-CTX-017`, `SC-CTX-009`). With no reader it
 * carries nothing — that is unknown, and this file does not claim otherwise.
 *
 * Framework-free (PC-1).
 */
import { GovernanceSeamUnboundError, ValidationFailedError } from '../../../core/errors.js';

/**
 * `T1837`, `FR-CTX-012` — the index cannot answer: never built, built from
 * another model, returned a neighbour with no distance, or its staleness could
 * not be read.
 *
 * The contract says `503` — *a capability that exists and is not currently
 * answerable* — and `ProviderUnavailableError` is `502`, a claim that an
 * upstream answered badly. This reuses the platform's existing `503` code
 * rather than inventing one: the error-code table belongs to the platform
 * contract (`DEF-008-001`), not to this Epic.
 */
export class ContextIndexUnavailableError extends GovernanceSeamUnboundError {}
import type { SourceVersionReader } from '../inspection.service.js';
import { embedChecked, type EmbeddingPort } from './embedding.port.js';
import { APPROVED_SOURCE_TYPES } from './index.service.js';
import type { Candidate, RetrievalOutcome } from './outcome.types.js';
import type { NearestRow, VectorIndex } from './vector.index.js';
import type { ReusableAuthorisation } from '../isolation.js';

export interface SearchOptions {
  /**
   * How many candidates to ask for — the `requested` of `R-038-3`. Optional
   * here because the module reads it from the workspace's budget policy per
   * request (`FR-CTX-036`); a search with neither refuses.
   */
  readonly limit?: number;
}

export class SearchService {
  constructor(
    private readonly vectors: VectorIndex,
    private readonly embedding: EmbeddingPort | null,
    private readonly versions: SourceVersionReader | null,
    private readonly options: SearchOptions,
    /**
     * `T1826`, `FR-CTX-051` — authorisations into the requester's workspace.
     * Their sources live in their owners' partitions, which a search of the
     * requester's partition alone can never reach.
     */
    private readonly grants: { authorisationsInto(workspaceId: string): Promise<ReusableAuthorisation[]> } | null = null,
  ) {}

  async search(input: {
    workspaceId: string;
    objective: string;
    limit?: number;
  }): Promise<RetrievalOutcome & { modelId: string }> {
    const limit = input.limit ?? this.options.limit;
    if (limit === undefined || !Number.isInteger(limit) || limit <= 0) {
      throw new ValidationFailedError(
        'no retrieval limit was given, and the search has no configured one (FR-CTX-036, R-038-3)',
      );
    }
    const embedded = await embedChecked(this.embedding, [input.objective]);

    const models = await this.#read(() => this.vectors.modelsIn(input.workspaceId));
    if (models.length === 0) {
      throw new ContextIndexUnavailableError(
        'the index for this workspace has never been built, so assembly cannot rank anything and ' +
          'refuses rather than returning an unranked package (FR-CTX-012)',
      );
    }
    const foreign = models.filter(
      (m) => m.modelId !== embedded.modelId || m.dimension !== embedded.dimension,
    );
    if (foreign.length > 0) {
      throw new ContextIndexUnavailableError(
        `the index holds entries from ${foreign.map((m) => `${m.modelId} (${m.count})`).join(', ')} ` +
          `while the active model is ${embedded.modelId}; ranking across models would compare ` +
          'incomparable spaces, so it refuses until the workspace is re-indexed (R-038-4)',
      );
    }

    const query = {
      modelId: embedded.modelId,
      dimension: embedded.dimension,
      vector: embedded.vectors[0]!,
      limit,
      sourceTypes: [...APPROVED_SOURCE_TYPES],
    };
    const owned = (await this.#read(() => this.vectors.nearest({ ...query, workspaceId: input.workspaceId }))).map((row) => ({
      row,
      workspaceId: input.workspaceId,
    }));

    // `T1826` — each owner's authorised sources, ranked in the owner's own
    // partition and restricted to exactly what was authorised. The boundary
    // still judges every one of them at assembly.
    const authorised: { row: NearestRow; workspaceId: string }[] = [];
    if (this.grants) {
      const byOwner = new Map<string, { sourceType: string; sourceId: string }[]>();
      for (const grant of await this.grants.authorisationsInto(input.workspaceId)) {
        if (grant.workspaceId === input.workspaceId) continue;
        const list = byOwner.get(grant.workspaceId) ?? [];
        list.push({ sourceType: grant.sourceType, sourceId: grant.sourceId });
        byOwner.set(grant.workspaceId, list);
      }
      for (const [owner, onlySources] of byOwner) {
        for (const row of await this.#read(() => this.vectors.nearest({ ...query, workspaceId: owner, onlySources }))) {
          authorised.push({ row, workspaceId: owner });
        }
      }
    }
    const rows = [...owned, ...authorised]
      .sort((a, b) => (a.row.distance ?? Number.POSITIVE_INFINITY) - (b.row.distance ?? Number.POSITIVE_INFINITY))
      .slice(0, limit);

    const candidates: Candidate[] = [];
    for (const { row, workspaceId: owner } of rows) {
      if (row.distance === null || !Number.isFinite(row.distance)) {
        throw new ContextIndexUnavailableError(
          `the index returned ${row.sourceType} ${row.sourceId} with no distance; a candidate ` +
            'is never given a default score (FR-CTX-014)',
        );
      }
      const staleness = await this.#staleness(owner, row);
      candidates.push({
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        sourceVersion: row.sourceVersion,
        // The partition it was ranked in, which is the workspace that owns it —
        // stated, not defaulted. The boundary judges any that are not the
        // requester's (`FR-CTX-050`).
        workspaceId: owner,
        // `T1808` — recorded at indexing from the artifact source.
        projectId: row.projectId ?? null,
        // Cosine similarity: 1 identical, 0 unrelated, -1 opposite.
        relevanceScore: 1 - row.distance,
        ...staleness,
      });
    }

    return {
      requested: limit,
      returned: candidates.length,
      candidates,
      modelId: embedded.modelId,
    };
  }

  /**
   * `T1851`, `FR-CTX-012` — a fault reading the index is the index being
   * unavailable: the same `503` as never built, not a raw `500` that reads as a
   * bug in this module.
   */
  async #read<T>(read: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch (error) {
      if (error instanceof ContextIndexUnavailableError) throw error;
      throw new ContextIndexUnavailableError(
        `the vector index could not be read (${error instanceof Error ? error.message : 'unknown fault'}), ` +
          'so assembly cannot rank anything and refuses (FR-CTX-012)',
      );
    }
  }

  /**
   * `T1822`, `SC-CTX-009`. Three outcomes, none of them a default: stale,
   * current, or *unknown* — and an outage is none of those, it refuses. Treating
   * a failed read as current is how every stale entry ranks as current exactly
   * when nobody can check.
   */
  async #staleness(
    workspaceId: string,
    row: { sourceType: string; sourceId: string; sourceVersion: string },
  ): Promise<{ stale?: { currentVersion: string }; stalenessUnknown?: string }> {
    if (this.versions === null) {
      return { stalenessUnknown: 'no reader of current source versions is bound' };
    }
    let now: Awaited<ReturnType<SourceVersionReader['currentVersion']>>;
    try {
      now = await this.versions.currentVersion(workspaceId, row.sourceType, row.sourceId);
    } catch (error) {
      // `T1873` — execution history is an addition, and its port DEGRADES: the
      // version read here is the same EPIC-037 read the history judge makes,
      // and refusing the whole index for it would pre-empt the degrade. Marked
      // unknown, and left to the judge.
      if (row.sourceType === 'execution-history') {
        return {
          stalenessUnknown: `EPIC-037's projection could not be read (${error instanceof Error ? error.message : 'unknown fault'})`,
        };
      }
      throw new ContextIndexUnavailableError(
        `the current version of ${row.sourceType} ${row.sourceId} could not be read ` +
          `(${error instanceof Error ? error.message : 'unknown fault'}), so whether it is stale is ` +
          'unknown; refusing rather than ranking it as current (SC-CTX-009)',
      );
    }
    if (now.resolves === 'unknown') return { stalenessUnknown: now.reason };
    if (!now.resolves) return { stale: { currentVersion: 'none — the source no longer resolves' } };
    return now.version === row.sourceVersion ? {} : { stale: { currentVersion: now.version } };
  }
}
