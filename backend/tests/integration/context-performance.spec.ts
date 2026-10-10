/**
 * `T1292` (EPIC-038) — the `R-038-10` targets, measured.
 *
 * | Target | p95 | Excludes |
 * |---|---|---|
 * | Retrieval over 50,000 entries | < 800 ms | the embedding provider's latency |
 * | Assembly | < 2.5 s | the embedding provider's latency; access adjudication (fixture permits) |
 * | Incremental re-index | < 5 s | the embedding provider's latency; reading the source document |
 * | Screen load | < 1.2 s | **not measured here** — a browser figure; see the closing report |
 *
 * ## The exclusions, stated in the output
 *
 * `EPIC-035`'s `T999o` found three of four figures excluded storage latency
 * nobody had granted. Here every figure excludes the embedding provider,
 * because **no provider exists in the programme** (`R-038-1`): the fixture
 * embedding answers in microseconds, so these figures are the database's and
 * this module's share only. A real provider adds a network round trip to every
 * retrieval and re-index. The exclusions are printed with the figures, so
 * nobody quotes a number without them.
 *
 * ## p95 over 30 runs
 *
 * Thirty samples put the p95 at the 29th value. One untimed pass first pays
 * for connection setup and planning, which a user does not pay per request.
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
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { SearchService } from '../../src/modules/context/retrieval/search.service.js';
import {
  PgVectorIndex,
  partitionName,
  type PgVectorClient,
} from '../../src/modules/context/retrieval/vector.index.pg.js';
import { allow, input } from '../helpers/context-fixtures.js';
import { fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_perf';
const ENTRIES = 50_000;
const DIMENSION = 27;
const MODEL = 'fixture-letters';
const RUNS = 30;
const PROVIDER = 'the embedding provider (none exists; the fixture answers in microseconds)';

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let vectors: PgVectorIndex;
let store: PrismaContextStore;

const measured: { what: string; p95: number; target: number; excludes: string }[] = [];

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
}

async function measure(
  what: string,
  target: number,
  excludes: string,
  each: (index: number) => Promise<unknown>,
): Promise<number> {
  await each(-1);
  const samples: number[] = [];
  for (let index = 0; index < RUNS; index += 1) {
    const started = process.hrtime.bigint();
    await each(index);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  const value = p95(samples);
  measured.push({ what, p95: value, target, excludes });
  return value;
}

const OBJECTIVES = [
  'why does the booking notify twice',
  'invoice totals round incorrectly',
  'password reset link expires',
  'deployment rollback procedure',
  'flaky integration test in checkout',
];

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).withSharedMemorySize(POSTGRES_SHM_BYTES).start();
  const url = container.getConnectionUri();
  const db = new Client({ connectionString: url });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  await db.query(
    `INSERT INTO "context_source_classes" ("id","workspaceId","sourceType","securityClassification","indexable")
     VALUES ('sc_perf',$1,'requirement','internal',true)`,
    [WS],
  );
  // The workspace's own partition, as `PgVectorIndex.prepare` would create it,
  // filled before the HNSW index exists so the index is bulk-built.
  await db.query(
    `CREATE TABLE "${partitionName(WS)}" PARTITION OF "context_index_entries" FOR VALUES IN ('${WS}')`,
  );
  // Deterministic, varied vectors: each entry a mix of letters.
  let seed = 7;
  const next = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let start = 0; start < ENTRIES; start += 1000) {
    const values: unknown[] = [];
    const tuples: string[] = [];
    for (let i = start; i < Math.min(start + 1000, ENTRIES); i += 1) {
      const v = Array.from({ length: DIMENSION }, (_, d) => (d === DIMENSION - 1 ? 1 : Math.floor(next() * 4)));
      const b = values.length;
      values.push(`ie_${i}`, `rq_${i}`, `[${v.join(',')}]`);
      tuples.push(`($${b + 1},'${WS}','requirement',$${b + 2},'v1','${MODEL}',${DIMENSION},$${b + 3}::vector)`);
    }
    await db.query(
      `INSERT INTO "context_index_entries"
         ("id","workspaceId","sourceType","sourceId","sourceVersion","embeddingModelId","dimension","embedding")
       VALUES ${tuples.join(',')}`,
      values,
    );
  }
  await db.end();

  prisma = new PrismaClient({ datasources: { db: { url } } });
  vectors = new PgVectorIndex(prisma as unknown as PgVectorClient);
  await vectors.prepare(WS, DIMENSION);
  await prisma.$executeRawUnsafe('ANALYZE "context_index_entries"');
  store = new PrismaContextStore(prisma as unknown as ContextPrismaClient);
}, 900_000);

afterAll(async () => {
  if (measured.length > 0) {
    console.log(
      `\nT1292 · R-038-10 measured figures (${ENTRIES} entries, p95 of ${RUNS})\n${measured
        .map(
          (row) =>
            `  ${row.what}: p95 ${row.p95.toFixed(1)}ms (target < ${row.target}ms, excludes ${row.excludes})`,
        )
        .join('\n')}\n  screen load: NOT MEASURED here (a browser figure)\n`,
    );
  }
  await prisma?.$disconnect();
  await container?.stop();
}, 120_000);

suite('T1292 · R-038-10', () => {
  it('the corpus is the size the target names, in its own partition', async () => {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM "${partitionName(WS)}"`,
    )) as { n: number }[];
    expect(rows[0]?.n).toBe(ENTRIES);
  });

  it('retrieval over 50,000 entries: p95 < 800 ms', async () => {
    const search = new SearchService(vectors, fixtureEmbedding(MODEL), null, { limit: 40 });
    const value = await measure('retrieval', 800, PROVIDER, (i) =>
      search.search({ workspaceId: WS, objective: OBJECTIVES[Math.abs(i) % OBJECTIVES.length]! }),
    );
    expect(value).toBeLessThan(800);
  }, 300_000);

  it('assembly: p95 < 2.5 s', async () => {
    const assembly = new AssemblyService(store, {
      retrieval: new SearchService(vectors, fixtureEmbedding(MODEL), null, { limit: 40 }),
      access: allow(),
      sourceClasses: { classify: (ws, type) => store.classifySource(ws, type) },
      authorisations: store,
    });
    const value = await measure(
      'assembly',
      2500,
      `${PROVIDER}; access adjudication (a fixture that permits)`,
      (i) =>
        assembly.assemble(
          input({
            workspaceId: WS,
            executionId: undefined,
            objective: OBJECTIVES[Math.abs(i) % OBJECTIVES.length]!,
          }),
        ),
    );
    expect(value).toBeLessThan(2500);
  }, 300_000);

  it('incremental re-index of one source: p95 < 5 s', async () => {
    const index = new IndexService(store, vectors, fixtureEmbedding(MODEL), {
      async read(_ws, _type, sourceId, version) {
        return { text: `${sourceId} revised at ${version}: ${OBJECTIVES[0]}` };
      },
    });
    const value = await measure(
      're-index',
      5000,
      `${PROVIDER}; reading the source document (a fixture)`,
      (i) =>
        index.reindex({
          workspaceId: WS,
          sourceType: 'requirement',
          sourceId: `rq_${(i + 1) * 997}`,
          sourceVersion: `v${i + 3}`,
        }),
    );
    expect(value).toBeLessThan(5000);
  }, 300_000);
});
