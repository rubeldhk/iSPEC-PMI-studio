/**
 * `T1276`, `T1279` (EPIC-038) — where vectors live and are compared.
 *
 * The seam between ranking and storage. `vector.index.pg.ts` is the real one:
 * pgvector, inside the workspace partition, with iterative scans (`R-038-2`).
 * This file declares the interface and an in-memory twin that computes the
 * same cosine distance exactly, for unit tests.
 *
 * ## Metadata and vector are written separately, deliberately
 *
 * `ContextStore.upsertIndexEntry` writes the entry; `attach` writes its vector.
 * An entry whose vector never arrived has no embedding, and `nearest` only
 * considers entries that do — so a failure between the two leaves an entry
 * that is visibly unindexed rather than one ranked against a zero.
 *
 * Framework-free (PC-1).
 */
import type { IndexEntry } from '../context.store.js';

export interface NearestQuery {
  readonly workspaceId: string;
  readonly modelId: string;
  readonly dimension: number;
  readonly vector: readonly number[];
  readonly limit: number;
  /** `FR-CTX-015` — the ranker filters too, though assembly does not trust it to. */
  readonly sourceTypes: readonly string[];
  /** `T1826` — when given, only these sources: an owner's authorised few. */
  readonly onlySources?: readonly { sourceType: string; sourceId: string }[];
}

/**
 * One neighbour. `distance` is cosine distance — `0` identical, `2` opposite.
 * Typed nullable because a storage layer can return one, and `T1308` requires
 * that case refused rather than defaulted.
 */
export interface NearestRow {
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceVersion: string;
  /** `T1808` — the owning project recorded at indexing. */
  readonly projectId?: string | null;
  readonly distance: number | null;
}

export interface VectorIndex {
  /**
   * Called before an entry for this workspace and dimension is first written:
   * the PostgreSQL index gives the workspace its own partition and ensures an
   * HNSW index for the dimension. A partition must exist before rows do.
   */
  prepare(workspaceId: string, dimension: number): Promise<void>;
  attach(entry: IndexEntry, vector: readonly number[]): Promise<void>;
  /** `T1855` — whether the source's entry carries a vector. An entry without one is not current. */
  isEmbedded(workspaceId: string, sourceType: string, sourceId: string): Promise<boolean>;
  nearest(query: NearestQuery): Promise<NearestRow[]>;
  /** `R-038-4` — which models the workspace's embedded entries came from. */
  modelsIn(workspaceId: string): Promise<{ modelId: string; dimension: number; count: number }[]>;
}

export function cosineDistance(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** For unit tests. Exact rather than approximate, so it never under-returns. */
export class InMemoryVectorIndex implements VectorIndex {
  readonly #rows = new Map<string, { entry: IndexEntry; vector: readonly number[] }>();

  async prepare(_workspaceId: string, _dimension: number): Promise<void> {
    // Nothing to prepare: a map has no partitions.
  }

  async attach(entry: IndexEntry, vector: readonly number[]): Promise<void> {
    // Keyed on the source, as the store is: re-indexing replaces.
    this.#rows.set(`${entry.workspaceId}:${entry.sourceType}:${entry.sourceId}`, { entry, vector });
  }

  async isEmbedded(workspaceId: string, sourceType: string, sourceId: string): Promise<boolean> {
    return this.#rows.has(`${workspaceId}:${sourceType}:${sourceId}`);
  }

  async nearest(query: NearestQuery): Promise<NearestRow[]> {
    return [...this.#rows.values()]
      .filter(
        ({ entry }) =>
          entry.workspaceId === query.workspaceId &&
          entry.embeddingModelId === query.modelId &&
          entry.dimension === query.dimension &&
          query.sourceTypes.includes(entry.sourceType) &&
          (query.onlySources === undefined ||
            query.onlySources.some((s) => s.sourceType === entry.sourceType && s.sourceId === entry.sourceId)),
      )
      .map(({ entry, vector }) => ({
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        sourceVersion: entry.sourceVersion,
        projectId: entry.projectId ?? null,
        distance: cosineDistance(vector, query.vector),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, query.limit);
  }

  async modelsIn(workspaceId: string): Promise<{ modelId: string; dimension: number; count: number }[]> {
    const counts = new Map<string, { modelId: string; dimension: number; count: number }>();
    for (const { entry } of this.#rows.values()) {
      if (entry.workspaceId !== workspaceId) continue;
      const key = `${entry.embeddingModelId}:${entry.dimension}`;
      const row = counts.get(key) ?? { modelId: entry.embeddingModelId, dimension: entry.dimension, count: 0 };
      counts.set(key, { ...row, count: row.count + 1 });
    }
    return [...counts.values()];
  }
}
