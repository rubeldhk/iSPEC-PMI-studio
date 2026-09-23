/**
 * `T1232` (EPIC-038) — the index is partitioned, and the boundary is where the
 * row lives rather than what the query remembered to say.
 *
 * `R-038-2`, `FR-CTX-050`.
 *
 * ## Why this asserts the mechanism and not only the outcome
 *
 * A plain `WHERE "workspaceId" = $1` against one global HNSW index produces the
 * **same visible result** as a partition on every test small enough to run in a
 * suite. Both return only this workspace's rows. The difference appears at
 * scale, and it appears silently:
 *
 * pgvector applies the filter **after** the approximate scan, bounded by
 * `hnsw.ef_search` (default 40). In a multi-tenant corpus the top-40 neighbours
 * of a query are mostly other workspaces' rows, discarded after the scan — so
 * the query returns eight candidates instead of forty, with nothing saying so.
 * A package assembled from that read names **no exclusions**, because the
 * material never reached the assembler, and it looks complete.
 *
 * So an outcome test would pass against the design this Epic rejected. This
 * file asks the catalogue what the table actually is.
 *
 * `EPIC-035`'s `T998i` made the same move for a different reason: prove the
 * three guards refuse *separately*, because a test that only observes the
 * outcome cannot tell which one did the work.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let container: StartedPostgreSqlContainer;
let db: Client;

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  db = new Client({ connectionString: container.getConnectionUri() });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
}, 600_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
}, 120_000);

suite('T1232 · the index entry table is partitioned by workspace', () => {
  it('the extension is present and recent enough for iterative scans', async () => {
    // `R-038-2` — 0.8.0 added them. On an older pgvector every test here still
    // passes while a filtered search silently under-returns in production,
    // which is why the floor is asserted rather than assumed.
    const rows = await db.query(`SELECT extversion FROM pg_extension WHERE extname = 'vector'`);
    expect(rows.rowCount, 'the vector extension is not installed').toBe(1);
    const [major, minor] = String(rows.rows[0].extversion).split('.').map(Number);
    expect(major! > 0 || minor! >= 8, `pgvector ${rows.rows[0].extversion} is below 0.8.0`).toBe(
      true,
    );
  });

  it('and the table is genuinely partitioned, not merely indexed', async () => {
    // The assertion an outcome test cannot make. `relkind = 'p'` is a
    // partitioned table; `'r'` is an ordinary one with a WHERE clause somewhere.
    const rows = await db.query(
      `SELECT relkind FROM pg_class WHERE relname = 'context_index_entries'`,
    );
    expect(rows.rows[0]?.relkind).toBe('p');
  });

  it('partitioned by LIST on workspaceId, and not on something else', async () => {
    // A partition on `sourceType` would satisfy "is partitioned" and enforce
    // nothing about the boundary — the check has to name the column.
    const rows = await db.query(
      `SELECT pg_get_partkeydef('context_index_entries'::regclass) AS def`,
    );
    expect(String(rows.rows[0].def)).toMatch(/LIST \("?workspaceId"?\)/i);
  });

  it('the partition-key check can fire', () => {
    // Anti-tautology for the matcher above.
    expect(/LIST \("?workspaceId"?\)/i.test('LIST ("sourceType")')).toBe(false);
    expect(/LIST \("?workspaceId"?\)/i.test('LIST ("workspaceId")')).toBe(true);
  });

  it('a default partition exists, so an unknown workspace lands somewhere', async () => {
    // Without it an insert for a workspace with no partition errors. The
    // boundary still holds — the default partition is scoped to nothing else —
    // but the Room stops accepting material rather than isolating it.
    const rows = await db.query(
      `SELECT c.relname FROM pg_class c
         JOIN pg_inherits i ON i.inhrelid = c.oid
        WHERE i.inhparent = 'context_index_entries'::regclass`,
    );
    expect(rows.rows.map((r: { relname: string }) => r.relname)).toContain(
      'context_index_entries_default',
    );
  });
});

suite('T1232 · and the boundary holds in practice', () => {
  it('a query for one workspace returns nothing from another', async () => {
    await db.query(
      `INSERT INTO "context_index_entries"
         ("id","workspaceId","sourceType","sourceId","sourceVersion","embeddingModelId","dimension")
       VALUES ('ie_a','ws_a','requirement','rq_1','v1','model-a',3),
              ('ie_b','ws_b','requirement','rq_2','v1','model-a',3)`,
    );
    const rows = await db.query(
      `SELECT "id" FROM "context_index_entries" WHERE "workspaceId" = 'ws_a'`,
    );
    expect(rows.rows.map((r: { id: string }) => r.id)).toEqual(['ie_a']);
  });

  it('and the corpus really did contain the other workspace, so the check is not vacuous', async () => {
    // An isolation test over a corpus with nothing to leak proves the fixture.
    const rows = await db.query(`SELECT count(*)::int AS n FROM "context_index_entries"`);
    expect(rows.rows[0].n).toBeGreaterThanOrEqual(2);
  });

  it('an entry records the model that produced it', async () => {
    // `R-038-4`. Two models of one dimension produce incomparable spaces and
    // the database computes distances across them without erroring — mixed
    // entries do not fail, they rank nonsense.
    const rows = await db.query(
      `SELECT "embeddingModelId","dimension" FROM "context_index_entries" WHERE "id" = 'ie_a'`,
    );
    expect(rows.rows[0].embeddingModelId).toBe('model-a');
    expect(rows.rows[0].dimension).toBe(3);
  });
});
