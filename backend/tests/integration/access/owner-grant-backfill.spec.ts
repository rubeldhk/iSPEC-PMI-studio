/**
 * T1131 (EPIC-024, C2E) — the owner-grant backfill, against real data.
 *
 * The migration matched nothing when it was applied to the development
 * database, because that database holds no specifications. A migration that
 * has only ever run against zero rows is untested, and this one decides
 * whether existing artifacts become reachable or stay locked — so it is
 * exercised here against rows deliberately shaped like pre-C2E data.
 *
 * The setup applies every migration **except** the backfill, inserts the
 * artifacts, and only then applies it. Applying everything first would leave
 * nothing for the backfill to find.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');
const BACKFILL = '20260827000000_epic024_owner_grant_backfill';

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_bf';
const OTHER_WS = 'ws_bf_other';
const OWNER = 'u_bf_owner';
const FOREIGN = 'u_bf_foreign';

suite('T1131 · the owner-grant backfill resolves what it can and invents nothing', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();

    const dirs = readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort();
    expect(dirs, 'the backfill migration is missing').toContain(BACKFILL);

    for (const dir of dirs.filter((d) => d !== BACKFILL)) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }

    for (const [id, name] of [
      [WS, 'backfill'],
      [OTHER_WS, 'elsewhere'],
    ]) {
      await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
        id,
        name,
      ]);
    }
    for (const [id, ws] of [
      [OWNER, WS],
      [FOREIGN, OTHER_WS],
    ]) {
      await db.query(
        `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
         VALUES ($1,$2,$1,$1,'x',now())`,
        [id, ws],
      );
    }
    await db.query(
      `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
       VALUES ('proj_bf',$1,'bf',$2,now())`,
      [WS, OWNER],
    );

    // Four artifacts, shaped like pre-C2E data: no grants at all.
    const specs: [string, string][] = [
      ['spec_resolvable', OWNER], // creator is a real user in this workspace
      ['spec_ghost', 'u_deleted'], // creator no longer exists
      ['spec_foreign', FOREIGN], // creator is real, but in another tenant
      ['spec_already', OWNER], // already granted; must not be double-granted
    ];
    for (const [id, createdBy] of specs) {
      await db.query(
        `INSERT INTO "specifications"
           ("id","workspaceId","projectId","title","lifecycleState","engineName","engineVersion",
            "generatedAt","createdById","updatedById","updatedAt")
         VALUES ($1,$2,'proj_bf',$1,'draft','fixture','1',now(),$3,$3,now())`,
        [id, WS, createdBy],
      );
    }
    await db.query(
      `INSERT INTO "access_grants"
         ("id","workspaceId","artifactType","artifactId","userId","level","grantedById","grantedAt")
       VALUES (gen_random_uuid()::text,$1,'specification','spec_already',$2,'edit',$2,now())`,
      [WS, OWNER],
    );

    // NOW the backfill.
    await db.query(readFileSync(join(MIGRATIONS, BACKFILL, 'migration.sql'), 'utf8'));
  }, 300_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  }, 120_000);

  async function grantees(artifactId: string): Promise<string[]> {
    const { rows } = await db.query<{ userId: string }>(
      `SELECT "userId" FROM "access_grants"
       WHERE "artifactType"='specification' AND "artifactId"=$1 AND "revokedAt" IS NULL`,
      [artifactId],
    );
    return rows.map((r) => r.userId);
  }

  async function outcomeOf(artifactId: string): Promise<string | null> {
    const { rows } = await db.query<{ outcome: string }>(
      `SELECT "outcome" FROM "ownership_backfill_records" WHERE "artifactId"=$1`,
      [artifactId],
    );
    return rows[0]?.outcome ?? null;
  }

  it('grants the creator where they resolve in the same workspace', async () => {
    expect(await grantees('spec_resolvable')).toEqual([OWNER]);
    expect(await outcomeOf('spec_resolvable')).toBe('granted');
  });

  it('invents nothing for a creator who no longer exists', async () => {
    expect(await grantees('spec_ghost')).toEqual([]);
    expect(await outcomeOf('spec_ghost')).toBe('unresolved');
  });

  it('invents nothing for a creator belonging to another workspace', async () => {
    // The creator is a real human — just not one of this tenant's. Granting
    // them would move an artifact across a tenant boundary by migration.
    expect(await grantees('spec_foreign')).toEqual([]);
    expect(await outcomeOf('spec_foreign')).toBe('unresolved');
  });

  it('leaves an already-granted artifact untouched', async () => {
    expect(await grantees('spec_already')).toEqual([OWNER]);
    expect(await outcomeOf('spec_already'), 'an already-granted artifact was recorded').toBeNull();
  });

  it('is idempotent — re-running grants nothing further', async () => {
    await db.query(readFileSync(join(MIGRATIONS, BACKFILL, 'migration.sql'), 'utf8'));
    expect(await grantees('spec_resolvable')).toEqual([OWNER]);
    expect(await grantees('spec_already')).toEqual([OWNER]);
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "ownership_backfill_records"`,
    );
    expect(Number(rows[0]!.n), 'a second run duplicated its evidence').toBe(3);
  });

  it('records counts an operator can act on', async () => {
    const { rows } = await db.query<{ outcome: string; n: string }>(
      `SELECT "outcome", count(*) AS n FROM "ownership_backfill_records" GROUP BY "outcome" ORDER BY 1`,
    );
    expect(rows.map((r) => [r.outcome, Number(r.n)])).toEqual([
      ['granted', 1],
      ['unresolved', 2],
    ]);
  });
});
