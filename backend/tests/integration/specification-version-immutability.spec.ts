/**
 * T459 — `specification_versions` is append-only, enforced by PostgreSQL
 * (**FR-013**, **SC-007**).
 *
 * Raw SQL against a real PostgreSQL via Testcontainers, with ALL migrations
 * applied in `prisma migrate deploy` order — the trigger under test arrives in
 * the last of them.
 *
 * Why the database and not only the service: `SpecificationVersionService`
 * offers no update and no delete, so the CODE cannot mutate a version. That is
 * a guarantee about one caller, not about the table. A migration script, an
 * admin console, or a future repository method bypasses it entirely. SC-007
 * says any prior version is retrievable **unchanged**; only the database can
 * promise that.
 *
 * This is the same two-layer pattern EPIC-004 established (analysis finding
 * C1) and EPIC-007 `T458` applied to `requirement_versions`. The shared
 * `reject_mutation()` function is EPIC-004's `T454`; this attaches to it and
 * deliberately does NOT redefine it — one function, one rule, every
 * append-only table.
 *
 * This task was gated on EPIC-008: the table it protects is `T077`'s, which is
 * why the lifecycle wave's stage 1 could not carry it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const ORIGINAL = '# Payments\n\nThe system shall settle in one transaction.';

suite('T459 · specification_versions is append-only, enforced by PostgreSQL (FR-013)', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();

    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }

    await db.query(
      `INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('ws_spec','spec immutability probe',now())`,
    );
    await db.query(
      `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
       VALUES ('u_spec','ws_spec','spec-probe@example.test','Probe','$argon2id$probe',now())`,
    );
    await db.query(
      `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
       VALUES ('p_spec','ws_spec','Probe project','u_spec',now())`,
    );
    await db.query(
      `INSERT INTO "specifications"
         ("id","workspaceId","projectId","title","engineName","engineVersion","generatedAt","createdById","updatedById","updatedAt")
       VALUES ('s_spec','ws_spec','p_spec','Payments','stub','1.0.0',now(),'u_spec','u_spec',now())`,
    );
    await db.query(
      `INSERT INTO "specification_versions"
         ("id","workspaceId","specificationId","versionNumber","contentRaw","contentParsed","lifecycleStateAtCreation","authoredById")
       VALUES ('sv_probe','ws_spec','s_spec',1,$1,'{"sections":[]}','draft','u_spec')`,
      [ORIGINAL],
    );
  }, 180_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  it('applied the migrations and holds the probe version row', async () => {
    // A false pass would be an empty table, where UPDATE and DELETE are
    // trivially no-ops and the trigger never fires.
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "specification_versions"`);
    expect(rows[0].n).toBe(1);
  });

  it('rejects a raw UPDATE', async () => {
    await expect(
      db.query(`UPDATE "specification_versions" SET "contentRaw" = 'rewritten' WHERE "id" = 'sv_probe'`),
    ).rejects.toThrow();
  });

  it('rejects a raw DELETE', async () => {
    await expect(
      db.query(`DELETE FROM "specification_versions" WHERE "id" = 'sv_probe'`),
    ).rejects.toThrow();
  });

  it('leaves the prior content retrievable and UNALTERED after both (SC-007)', async () => {
    const { rows } = await db.query(
      `SELECT "contentRaw", "versionNumber" FROM "specification_versions" WHERE "id" = 'sv_probe'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].contentRaw).toBe(ORIGINAL);
    expect(rows[0].versionNumber).toBe(1);
  });

  it('still permits INSERT — append-only, not read-only (FR-013)', async () => {
    await db.query(
      `INSERT INTO "specification_versions"
         ("id","workspaceId","specificationId","versionNumber","contentRaw","contentParsed","lifecycleStateAtCreation","authoredById")
       VALUES ('sv_second','ws_spec','s_spec',2,'# Payments v2','{"sections":["v2"]}','draft','u_spec')`,
    );
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "specification_versions"`);
    expect(rows[0].n).toBe(2);
  });

  it('attaches to the SHARED reject_mutation(), never a redefinition', async () => {
    // One function, one rule. EPIC-004 T454 created it; T458 and this attach.
    // Two copies can drift, and the one nobody reads is the one that stops
    // working.
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'reject_mutation'`,
    );
    expect(rows[0].n).toBe(1);

    const trigger = await db.query(
      `SELECT p.proname
         FROM pg_trigger t
         JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgname = 'specification_versions_immutable'`,
    );
    expect(trigger.rows[0]?.proname).toBe('reject_mutation');
  });

  it('the version CHECK constraints still hold at the database', async () => {
    // Empty engine output is never a stored specification (EPIC-008 T077), and
    // versions number from 1.
    await expect(
      db.query(
        `INSERT INTO "specification_versions"
           ("id","workspaceId","specificationId","versionNumber","contentRaw","contentParsed","lifecycleStateAtCreation","authoredById")
         VALUES ('sv_blank','ws_spec','s_spec',3,'   ','{"a":1}','draft','u_spec')`,
      ),
    ).rejects.toThrow();
  });
});
