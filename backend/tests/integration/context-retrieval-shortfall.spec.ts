/**
 * `T1280` (EPIC-038) — the short read, against real pgvector.
 *
 * `R-038-2`, `R-038-3`. **The most important test in the Epic**: the failure it
 * catches is silent in every other design.
 *
 * pgvector filters **after** the approximate scan. When a query's filter is
 * restrictive, the neighbours the HNSW graph visits first are mostly rows the
 * filter then discards — and the query returns fewer rows than its `LIMIT`,
 * with nothing saying so. A package assembled from that read names no
 * exclusions, because the material never reached the assembler, and it looks
 * complete.
 *
 * ## How the fixture makes the scan bite
 *
 * A fixture of ten rows passes whatever the implementation does: the scan
 * visits everything. So this one is built to be hostile:
 *
 * - **Two workspaces share the default partition.** Their rows were written
 *   before either had a partition of its own — the case `PgVectorIndex`
 *   documents — so the workspace predicate is a filter, not a prune.
 * - **The crowd is nearer.** 3,000 rows of another workspace sit almost on top
 *   of the query; the requester's 60 rows are far away. Every neighbour the
 *   graph offers first belongs to someone else.
 * - **The iterative scan is bounded** (`hnsw.max_scan_tuples`), as it always
 *   is in production — only higher.
 *
 * Then it asserts three things: the read **was** short; the rows the read
 * missed **did exist** (an exact count proves the shortfall is the index's,
 * not an empty corpus); and the package **carries** `requested` and
 * `returned`. And a control: with the scan allowed to run, the same query
 * returns everything — so the shortfall is caused by the mechanism named,
 * not by a bug that always under-returns.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { POSTGRES_IMAGE, POSTGRES_SHM_BYTES } from '../helpers/postgres-image.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import {
  PrismaContextStore,
  type ContextPrismaClient,
} from '../../src/modules/context/context.store.prisma.js';
import { SearchService } from '../../src/modules/context/retrieval/search.service.js';
import {
  PgVectorIndex,
  type PgVectorClient,
} from '../../src/modules/context/retrieval/vector.index.pg.js';
import { allow, input } from '../helpers/context-fixtures.js';
import { fixtureEmbedding, letterVector } from '../helpers/context-retrieval-fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const REQUESTER = 'ws_requester';
const CROWD = 'ws_crowd';
const OBJECTIVE = 'booking notification sent twice';
const MODEL = 'fixture-letters';
const DIMENSION = 27;
const REQUESTER_ROWS = 60;
const CROWD_ROWS = 3000;
const LIMIT = 40;

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let db: Client;

/** Deterministic noise, so a failure reproduces. */
function jitter(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const literal = (v: readonly number[]): string => `[${v.join(',')}]`;

async function insertRows(rows: { ws: string; id: string; vector: number[] }[]): Promise<void> {
  for (let start = 0; start < rows.length; start += 500) {
    const batch = rows.slice(start, start + 500);
    const values: unknown[] = [];
    const tuples = batch.map((r, i) => {
      values.push(`ie_${r.ws}_${r.id}`, r.ws, r.id, literal(r.vector));
      const b = i * 4;
      return `($${b + 1},$${b + 2},'requirement',$${b + 3},'v1','${MODEL}',${DIMENSION},$${b + 4}::vector)`;
    });
    await db.query(
      `INSERT INTO "context_index_entries"
         ("id","workspaceId","sourceType","sourceId","sourceVersion","embeddingModelId","dimension","embedding")
       VALUES ${tuples.join(',')}`,
      values,
    );
  }
}

function search(maxScanTuples: number): SearchService {
  const vectors = new PgVectorIndex(prisma as unknown as PgVectorClient, { maxScanTuples });
  return new SearchService(vectors, fixtureEmbedding(MODEL), null, { limit: LIMIT });
}

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).withSharedMemorySize(POSTGRES_SHM_BYTES).start();
  const url = container.getConnectionUri();
  db = new Client({ connectionString: url });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  await db.query(
    `INSERT INTO "context_source_classes" ("id","workspaceId","sourceType","securityClassification","indexable")
     VALUES ('sc_req',$1,'requirement','internal',true)`,
    [REQUESTER],
  );

  const query = letterVector(OBJECTIVE);
  const noise = jitter(38);
  // The crowd: almost on top of the query.
  const crowd = Array.from({ length: CROWD_ROWS }, (_, i) => ({
    ws: CROWD,
    id: `c${i}`,
    vector: query.map((x) => x + noise() * 0.05),
  }));
  // The requester's own material: far from the query, but there.
  const far = letterVector('quartz zephyr jukebox');
  const own = Array.from({ length: REQUESTER_ROWS }, (_, i) => ({
    ws: REQUESTER,
    id: `r${i}`,
    vector: far.map((x) => x + noise() * 0.05),
  }));
  // Written before either workspace had a partition: both land in the default.
  await insertRows([...crowd, ...own]);

  // The planner's choice, made for it. At this fixture's size PostgreSQL rightly
  // prefers the exact path — filter by the workspace btree, then sort 60 rows —
  // and nothing is ever short. At production scale, with workspaces of
  // thousands of entries, it chooses the HNSW scan instead, and that is the
  // path whose behaviour is under test. Disabling explicit sorts for this
  // database (before any client connects) puts the query on that path without
  // a corpus too large for a suite; the second assertion proves it is there.
  await db.query(`ALTER DATABASE "${container.getDatabase()}" SET enable_sort = off`);
  await db.end();
  db = new Client({ connectionString: url });
  await db.connect();

  prisma = new PrismaClient({ datasources: { db: { url } } });
  // Creates the HNSW index for this dimension, and — because the requester's
  // rows already sit in the default partition — leaves them there.
  await new PgVectorIndex(prisma as unknown as PgVectorClient).prepare(REQUESTER, DIMENSION);
  await db.query('ANALYZE "context_index_entries"');
}, 600_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.end();
  await container?.stop();
}, 120_000);

suite('T1280 · a short read is recorded, never absorbed', () => {
  it('the fixture is hostile: both workspaces share the default partition', async () => {
    const rows = await db.query(
      `SELECT tableoid::regclass::text AS part, count(*)::int AS n
         FROM "context_index_entries" GROUP BY 1`,
    );
    expect(rows.rows).toEqual([{ part: 'context_index_entries_default', n: CROWD_ROWS + REQUESTER_ROWS }]);
  });

  it('and the query uses the HNSW index, so the scan is approximate', async () => {
    const d = DIMENSION;
    const plan = await db.query(
      `EXPLAIN SELECT "sourceId" FROM "context_index_entries"
        WHERE "workspaceId" = $2 AND "embeddingModelId" = '${MODEL}' AND "dimension" = ${d}
          AND "embedding" IS NOT NULL AND "sourceType" = ANY(ARRAY['requirement'])
        ORDER BY "embedding"::vector(${d}) <=> $1::vector(${d}) LIMIT ${LIMIT}`,
      [literal(letterVector(OBJECTIVE)), REQUESTER],
    );
    const text = plan.rows.map((r: { 'QUERY PLAN': string }) => r['QUERY PLAN']).join('\n');
    // An index scan ORDERED by distance — the HNSW index, inherited by the
    // partition under an auto-generated name — with the workspace as a
    // post-scan Filter. That is the shape pgvector documents as able to
    // under-return.
    expect(text).toMatch(/Index Scan using \S+ on context_index_entries_default/);
    expect(text).toMatch(/Order By: .*<=>/);
    expect(text).toMatch(/Filter: .*"workspaceId" = 'ws_requester'/);
  });

  it('with the scan bounded, retrieval returns fewer than requested — and says so', async () => {
    const out = await search(200).search({ workspaceId: REQUESTER, objective: OBJECTIVE });
    expect(out.requested).toBe(LIMIT);
    expect(out.returned).toBeLessThan(LIMIT);
    expect(out.returned).toBe(out.candidates.length);
  });

  it('though the material existed: the shortfall is the index, not the corpus', async () => {
    const exact = await db.query(
      `SELECT count(*)::int AS n FROM "context_index_entries" WHERE "workspaceId" = $1`,
      [REQUESTER],
    );
    expect(exact.rows[0].n).toBeGreaterThanOrEqual(LIMIT);
  });

  it('and the package carries requested and returned (T1281)', async () => {
    const store = new PrismaContextStore(prisma as unknown as ContextPrismaClient);
    const result = await new AssemblyService(store, {
      retrieval: search(200),
      access: allow(),
      sourceClasses: { classify: (ws, type) => store.classifySource(ws, type) },
      authorisations: store,
      costOf: () => 1,
    }).assemble(input({ workspaceId: REQUESTER, objective: OBJECTIVE, executionId: undefined }));

    expect(result.shortfall).toMatchObject({ requested: LIMIT });
    expect(result.shortfall!.returned).toBeLessThan(LIMIT);
    const row = await store.findPackage(REQUESTER, result.packageId);
    expect([row?.retrievalRequested, row?.retrievalReturned]).toEqual([LIMIT, result.shortfall!.returned]);
  });

  it('the control: let the iterative scan run, and the same query is complete', async () => {
    const out = await search(20_000).search({ workspaceId: REQUESTER, objective: OBJECTIVE });
    expect([out.requested, out.returned]).toEqual([LIMIT, LIMIT]);
    expect(out.candidates.every((c) => c.workspaceId === REQUESTER)).toBe(true);
  });
});
