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
import { POSTGRES_IMAGE } from '../../helpers/postgres-image.js';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');
const BACKFILL = '20260827000000_epic024_owner_grant_backfill';
/** Attaches the Y1 trigger TO the backfill table, so it must follow it. */
const BACKFILL_IMMUTABILITY = '20260827140000_epic024_backfill_evidence_immutable';
const APP_ROLE = 'pmi_app_probe';

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
  /** The same database, as a role with no special privilege. */
  let appRole: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();

    const dirs = readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort();
    expect(dirs, 'the backfill migration is missing').toContain(BACKFILL);

    // Both are held back: the backfill needs data to find, and the Y1 trigger
    // attaches to the table the backfill creates, so it cannot run before it.
    const held = new Set([BACKFILL, BACKFILL_IMMUTABILITY]);
    for (const dir of dirs.filter((d) => !held.has(d))) {
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

    // NOW the backfill, then the trigger that protects what it wrote.
    await db.query(readFileSync(join(MIGRATIONS, BACKFILL, 'migration.sql'), 'utf8'));
    await db.query(readFileSync(join(MIGRATIONS, BACKFILL_IMMUTABILITY, 'migration.sql'), 'utf8'));

    // A NON-superuser role, because the container's default user is one and a
    // superuser proves nothing about what the running application can do.
    await db.query(`CREATE ROLE "${APP_ROLE}" LOGIN PASSWORD 'probe'`);
    await db.query(`GRANT USAGE ON SCHEMA public TO "${APP_ROLE}"`);
    await db.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_ROLE}"`,
    );

    const uri = new URL(container.getConnectionUri());
    uri.username = APP_ROLE;
    uri.password = 'probe';
    appRole = new Client({ connectionString: uri.toString() });
    await appRole.connect();
  }, 300_000);

  afterAll(async () => {
    await appRole?.end();
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

  it('is APPEND-ONLY — the list of unresolved artifacts cannot be shortened (Y1)', async () => {
    // Promoted from LOW in C3B. This table names every artifact still without
    // an owner. A mutable list of outstanding security remediations can be
    // quietly shortened, and nothing else records what the migration could not
    // resolve or why — that is not re-derivable once grants are added later.
    //
    // Asserted as the APPLICATION role, not a superuser: a trigger the runtime
    // could bypass would protect nothing where it matters.
    const { rows: role } = await appRole.query<{ su: boolean; owner: boolean }>(
      `SELECT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS su,
              pg_catalog.pg_get_userbyid(c.relowner) = current_user AS owner
         FROM pg_class c WHERE c.relname = 'ownership_backfill_records'`,
    );
    expect(role[0]?.su, 'this proof would be vacuous as a superuser').toBe(false);
    expect(role[0]?.owner, 'a table owner can disable its own triggers').toBe(false);

    await expect(
      appRole.query(`UPDATE "ownership_backfill_records" SET "outcome"='granted'`),
    ).rejects.toThrow(/append-only/i);
    await expect(appRole.query(`DELETE FROM "ownership_backfill_records"`)).rejects.toThrow(
      /append-only/i,
    );
    // And it cannot simply turn the trigger off.
    await expect(
      appRole.query(`ALTER TABLE "ownership_backfill_records" DISABLE TRIGGER ALL`),
    ).rejects.toThrow();

    // And the evidence is intact afterwards.
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "ownership_backfill_records" WHERE "outcome"='unresolved'`,
    );
    expect(Number(rows[0]!.n)).toBe(2);
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
