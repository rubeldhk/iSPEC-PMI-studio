/**
 * `T1251` (EPIC-038) — provenance holds against a caller that skips the
 * service.
 *
 * `FR-CTX-042`, `FR-CTX-043`, `FR-CTX-044`.
 *
 * ## Why this exists beside `T1248` and `T1249`
 *
 * Those two prove `ProvenanceService` produces the right status. This one
 * proves the **database** refuses the wrong one — and the two are not the same
 * claim, because a service is one caller. A migration script, a repair query, a
 * future module, or a developer with `psql` all write rows without passing
 * through it.
 *
 * `EPIC-035`'s `T998i` established the shape: guards that fail differently and
 * are bypassed differently must be proved separately. Here the type
 * (`T1225`), the service (`T1248`, `T1249`) and the constraint (this file) each
 * refuse the same thing for a different reason.
 *
 * ## And why the assertions check the *reason* they were refused
 *
 * A row rejected for the wrong reason is a test passing for the wrong reason.
 * `T1230` caught exactly that mid-session: two of its assertions were rejecting
 * on a null `workspaceId` while claiming to prove a `CHECK`, and a looser
 * matcher would have hidden it permanently. Every expectation below names the
 * constraint it expects to fire.
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

const WS = 'ws_prov';
let container: StartedPostgreSqlContainer;
let db: Client;
let seq = 0;
const id = (p: string): string => `${p}_${(seq += 1)}`;

async function pkg(): Promise<string> {
  const packageId = id('cp');
  await db.query(
    `INSERT INTO "context_packages"
       ("id","workspaceId","projectId","objective","actorId","actorRole",
        "budgetTokens","budgetCost","state","embeddingModelId")
     VALUES ($1,$2,'pr_1','why does the booking notify twice','u_1','engineer',
             12000,40,'assembled','model-a')`,
    [packageId, WS],
  );
  return packageId;
}

async function item(packageId: string, over: Record<string, unknown> = {}): Promise<void> {
  const row: Record<string, unknown> = {
    id: id('pi'),
    workspaceId: WS,
    packageId,
    sourceType: 'requirement',
    sourceId: 'rq_1',
    sourceVersion: 'v3',
    authoritativeStatus: 'current',
    inclusionReason: 'objective term: notification',
    relevanceScore: 0.9,
    crossBoundary: false,
    ...over,
  };
  const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
  const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
  await db.query(`INSERT INTO "context_items" (${cols}) VALUES (${params})`, Object.values(row));
}

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

suite('T1251 · the database enforces provenance', () => {
  it('accepts a well-formed current item — or every refusal below is vacuous', async () => {
    await expect(item(await pkg())).resolves.toBeUndefined();
  });

  it('refuses a status nobody declared', async () => {
    // `FR-CTX-042`. A fourth status would be a vocabulary nobody agreed, and
    // every reader downstream would have to guess what it meant.
    const p = await pkg();
    await expect(item(p, { authoritativeStatus: 'probably-still-fine' })).rejects.toThrow(
      /context_items_status_is_known/,
    );
  });

  it('refuses superseded with no successor, by the named constraint', async () => {
    // `FR-CTX-043`, and the matcher names the constraint so a row rejected for
    // some *other* reason cannot pass this as though it proved the rule.
    const p = await pkg();
    await expect(item(p, { authoritativeStatus: 'superseded' })).rejects.toThrow(
      /context_items_superseded_names_successor/,
    );
  });

  it('refuses superseded with a blank successor too', async () => {
    // The gap a NOT NULL would leave open: `''` satisfies "is it set?" and
    // points at nothing, which is the half that does not let a reader act.
    const p = await pkg();
    await expect(
      item(p, { authoritativeStatus: 'superseded', supersededBy: '   ' }),
    ).rejects.toThrow(/context_items_superseded_names_successor/);
  });

  it('refuses undetermined with no reason, by the named constraint', async () => {
    // `FR-CTX-044`. Without the reason, *"I could not look"* and *"nobody has
    // decided"* arrive as one blank — and a reader cannot tell whether to chase
    // a person or a service.
    const p = await pkg();
    await expect(item(p, { authoritativeStatus: 'undetermined' })).rejects.toThrow(
      /context_items_undetermined_says_why/,
    );
  });

  it('and refuses a blank one', async () => {
    const p = await pkg();
    await expect(
      item(p, { authoritativeStatus: 'undetermined', undeterminedReason: '  ' }),
    ).rejects.toThrow(/context_items_undetermined_says_why/);
  });

  it('but a current item needs neither field, so the constraints are not blanket', async () => {
    // The control. Constraints demanding a successor and a reason from every
    // row would satisfy every refusal above while making the common case
    // impossible.
    const p = await pkg();
    await expect(
      item(p, { authoritativeStatus: 'current', supersededBy: null, undeterminedReason: null }),
    ).resolves.toBeUndefined();
  });

  it('and both non-trivial statuses are writable when they say what they must', async () => {
    const p = await pkg();
    await expect(
      item(p, { authoritativeStatus: 'superseded', supersededBy: 'rq_1@v5' }),
    ).resolves.toBeUndefined();
    await expect(
      item(p, {
        authoritativeStatus: 'undetermined',
        undeterminedReason: 'the baseline reader was unreachable',
      }),
    ).resolves.toBeUndefined();
  });
});

suite('T1251 · FR-CTX-041 — the table cannot hold a copy of the source', () => {
  it('has no column that could carry material', async () => {
    // The type forbids it (`T1225`) and the module forbids it (`T1236`). This
    // asserts the storage cannot hold one either — the layer that outlives
    // every refactor of the two above.
    const rows = await db.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'context_items'`,
    );
    const columns = rows.rows.map((r: { column_name: string }) => r.column_name.toLowerCase());
    for (const forbidden of ['content', 'body', 'payload', 'text', 'excerpt', 'blob']) {
      expect(columns, `context_items carries ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('but does carry the reference, so the absence is not the absence of the concept', async () => {
    const rows = await db.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'context_items'`,
    );
    const columns = rows.rows.map((r: { column_name: string }) => r.column_name);
    expect(columns).toContain('sourceId');
    expect(columns).toContain('sourceVersion');
  });
});
