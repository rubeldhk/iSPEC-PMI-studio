/**
 * `T1279` (EPIC-038) — the vector index in PostgreSQL. `R-038-1`, `R-038-2`,
 * `R-038-3`, `R-038-4`.
 *
 * ## The partition is the boundary
 *
 * `prepare` gives each workspace its own partition of `context_index_entries`
 * before its first entry is written, so a query for one workspace prunes to one
 * partition and never scans another tenant's rows. A plain `WHERE` against one
 * global HNSW index would return the same rows on every test small enough to
 * run — and silently fewer in production, because pgvector filters **after**
 * the approximate scan (`R-038-2`).
 *
 * A workspace whose rows already sit in the default partition (written before
 * it had one) keeps them there: PostgreSQL refuses to create a partition whose
 * values the default already holds. Those rows are still scoped by the
 * predicate; they are simply not pruned. `T1280` exercises exactly that case,
 * because it is where the approximate scan bites.
 *
 * ## The HNSW index is per dimension, created on first use
 *
 * The `embedding` column is dimensionless (`T1231`): no provider exists, so no
 * dimension can be fixed in a migration. pgvector indexes a fixed dimension, so
 * the index is a partial expression index — `embedding::vector(d)` where
 * `dimension = d` — created on the partitioned parent, which propagates it to
 * every partition, present and future. The query repeats the same expression
 * and predicate, or the planner cannot use it.
 *
 * ## Iterative scans, bounded (`R-038-2`, `R-038-3`)
 *
 * Every query runs in a transaction with `hnsw.iterative_scan = strict_order`,
 * so a restrictive filter scans further rather than returning short. It is
 * bounded by `hnsw.max_scan_tuples`, so it can still return short — and when it
 * does, `SearchService` reports `returned < requested` and the package carries
 * the shortfall. Rarer is not the same as never.
 *
 * Dimensions are validated integers before they reach SQL text; every other
 * value is a bound parameter.
 */
import { createHash } from 'node:crypto';
import type { IndexEntry } from '../context.store.js';
import type { NearestQuery, NearestRow, VectorIndex } from './vector.index.js';

/** The raw-SQL slice of `PrismaClient` this file uses, named rather than imported (PC-1). */
export interface PgVectorClient {
  $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]): Promise<T>;
  $transaction<T>(fn: (tx: PgVectorClient) => Promise<T>): Promise<T>;
}

export interface PgVectorOptions {
  /** `hnsw.max_scan_tuples` — pgvector's default is 20,000. */
  readonly maxScanTuples?: number;
  /** `hnsw.ef_search` — pgvector's default is 40. */
  readonly efSearch?: number;
}

function dimensionOf(value: number): number {
  if (!Number.isInteger(value) || value <= 0 || value > 16000) {
    throw new Error(`invalid embedding dimension: ${value}`);
  }
  return value;
}

const literal = (vector: readonly number[]): string => `[${vector.join(',')}]`;

/** A stable, SQL-safe partition name for a workspace. */
export function partitionName(workspaceId: string): string {
  return `context_index_entries_ws_${createHash('sha256').update(workspaceId).digest('hex').slice(0, 20)}`;
}

export class PgVectorIndex implements VectorIndex {
  readonly #indexed = new Set<number>();
  readonly #partitioned = new Set<string>();

  constructor(
    private readonly db: PgVectorClient,
    private readonly options: PgVectorOptions = {},
  ) {}

  async prepare(workspaceId: string, dimension: number): Promise<void> {
    await this.#ensurePartition(workspaceId);
    await this.#ensureHnsw(dimensionOf(dimension));
  }

  async attach(entry: IndexEntry, vector: readonly number[]): Promise<void> {
    const d = dimensionOf(entry.dimension);
    if (vector.length !== d) throw new Error(`vector of ${vector.length} for an entry of dimension ${d}`);
    await this.db.$executeRawUnsafe(
      `UPDATE "context_index_entries" SET "embedding" = $1::vector
        WHERE "id" = $2 AND "workspaceId" = $3`,
      literal(vector),
      entry.id,
      entry.workspaceId,
    );
  }

  async isEmbedded(workspaceId: string, sourceType: string, sourceId: string): Promise<boolean> {
    const rows = await this.db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS "n" FROM "context_index_entries"
        WHERE "workspaceId" = $1 AND "sourceType" = $2 AND "sourceId" = $3 AND "embedding" IS NOT NULL`,
      workspaceId,
      sourceType,
      sourceId,
    );
    return Number(rows[0]?.n ?? 0) > 0;
  }

  async nearest(query: NearestQuery): Promise<NearestRow[]> {
    const d = dimensionOf(query.dimension);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL hnsw.iterative_scan = strict_order`);
      if (this.options.maxScanTuples !== undefined) {
        await tx.$executeRawUnsafe(
          `SET LOCAL hnsw.max_scan_tuples = ${Math.trunc(this.options.maxScanTuples)}`,
        );
      }
      if (this.options.efSearch !== undefined) {
        await tx.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = ${Math.trunc(this.options.efSearch)}`);
      }
      const rows = await tx.$queryRawUnsafe<
        {
          sourceType: string;
          sourceId: string;
          sourceVersion: string;
          projectId: string | null;
          distance: number | null;
        }[]
      >(
        // `"workspaceId" = $2` is the partition key: the planner prunes to one
        // partition. The expression and the `dimension` predicate match the
        // partial HNSW index exactly, or the index is not used.
        `SELECT "sourceType", "sourceId", "sourceVersion", "projectId",
                ("embedding"::vector(${d}) <=> $1::vector(${d}))::float8 AS "distance"
           FROM "context_index_entries"
          WHERE "workspaceId" = $2
            AND "embeddingModelId" = $3
            AND "dimension" = ${d}
            AND "embedding" IS NOT NULL
            AND "sourceType" = ANY($4::text[])
            AND ($6::text[] IS NULL OR ("sourceType" || ':' || "sourceId") = ANY($6::text[]))
          ORDER BY "embedding"::vector(${d}) <=> $1::vector(${d})
          LIMIT $5`,
        literal(query.vector),
        query.workspaceId,
        query.modelId,
        [...query.sourceTypes],
        query.limit,
        query.onlySources === undefined ? null : query.onlySources.map((s) => `${s.sourceType}:${s.sourceId}`),
      );
      return rows.map((r) => ({ ...r, distance: r.distance === null ? null : Number(r.distance) }));
    });
  }

  async modelsIn(workspaceId: string): Promise<{ modelId: string; dimension: number; count: number }[]> {
    const rows = await this.db.$queryRawUnsafe<{ modelId: string; dimension: number; count: number }[]>(
      `SELECT "embeddingModelId" AS "modelId", "dimension", count(*)::int AS "count"
         FROM "context_index_entries"
        WHERE "workspaceId" = $1 AND "embedding" IS NOT NULL
        GROUP BY 1, 2`,
      workspaceId,
    );
    return rows.map((r) => ({ modelId: r.modelId, dimension: Number(r.dimension), count: Number(r.count) }));
  }

  async #ensureHnsw(d: number): Promise<void> {
    if (this.#indexed.has(d)) return;
    await this.db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "context_index_entries_hnsw_d${d}"
         ON "context_index_entries"
         USING hnsw (("embedding"::vector(${d})) vector_cosine_ops)
         WHERE "dimension" = ${d}`,
    );
    this.#indexed.add(d);
  }

  async #ensurePartition(workspaceId: string): Promise<void> {
    if (this.#partitioned.has(workspaceId)) return;
    const name = partitionName(workspaceId);
    const [probe] = await this.db.$queryRawUnsafe<{ exists: boolean; inDefault: boolean }[]>(
      `SELECT to_regclass($1) IS NOT NULL AS "exists",
              EXISTS (SELECT 1 FROM "context_index_entries_default" WHERE "workspaceId" = $2) AS "inDefault"`,
      name,
      workspaceId,
    );
    if (probe !== undefined && !probe.exists && !probe.inDefault) {
      try {
        await this.db.$executeRawUnsafe(
          `CREATE TABLE IF NOT EXISTS "${name}" PARTITION OF "context_index_entries"
             FOR VALUES IN ('${workspaceId.replace(/'/g, "''")}')`,
        );
      } catch (error) {
        // Two writers racing to create the same partition: the loser's error
        // means the partition now exists, which is what was wanted.
        if (!/already exists/i.test(error instanceof Error ? error.message : '')) throw error;
      }
    }
    this.#partitioned.add(workspaceId);
  }
}
