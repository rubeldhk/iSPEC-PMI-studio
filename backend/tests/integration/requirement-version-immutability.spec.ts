/**
 * T457 — requirement_versions is append-only BY THE DATABASE (FR-009, and
 * FR-013's "prior versions retrievable and unaltered").
 *
 * Why an integration test: a mocked repository cannot fail this. The
 * service-layer half (T067) proves the code never mutates; the requirement is
 * that the rows cannot be changed AT ALL — by a bug, a stray migration, or a
 * hand-typed psql session. Same gap found in EPIC-004 (analysis finding C1)
 * and closed there by T454, which created the shared `reject_mutation()` this
 * table's trigger (T458) attaches to.
 *
 * Raw SQL against a real PostgreSQL via Testcontainers, with ALL migrations
 * applied in order — the trigger lives in the EPIC-007 migration, not init.
 *
 * RAID R-04: needs a container runtime. Skipped loudly by name where none
 * exists — never silently passed.
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

suite('T457 · requirement_versions is append-only, enforced by PostgreSQL (FR-009)', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();

    // Every migration, in order — the same sequence `prisma migrate deploy`
    // runs. The trigger under test arrives in the last one.
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }

    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
      'ws_req',
      'requirement immutability probe',
    ]);
    await db.query(
      `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
       VALUES ('u_req','ws_req','probe@example.test','Probe','$argon2id$probe',now())`,
    );
    await db.query(
      `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
       VALUES ('p_req','ws_req','Probe project','u_req',now())`,
    );
    await db.query(
      `INSERT INTO "requirements"
         ("id","workspaceId","projectId","reference","description","type","priority","contentHash","updatedAt")
       VALUES ('r_req','ws_req','p_req','REQ-001','As it stands.','functional','p1','hash-1',now())`,
    );
    await db.query(
      `INSERT INTO "requirement_versions"
         ("id","workspaceId","requirementId","description","type","priority","authoredById")
       VALUES ('rv_probe','ws_req','r_req','As it stood.','functional','p1','u_req')`,
    );
  }, 180_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  it('applied the migrations and holds the probe version row', async () => {
    // A false pass would be an empty table, where UPDATE and DELETE are
    // trivially no-ops and the trigger never fires.
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "requirement_versions"`);
    expect(rows[0].n).toBe(1);
  });

  it('rejects UPDATE — issued as raw SQL, past every code path', async () => {
    await expect(
      db.query(`UPDATE "requirement_versions" SET "description" = 'rewritten' WHERE "id" = 'rv_probe'`),
    ).rejects.toThrow(/requirement_versions is append-only/);
  });

  it('rejects DELETE', async () => {
    await expect(
      db.query(`DELETE FROM "requirement_versions" WHERE "id" = 'rv_probe'`),
    ).rejects.toThrow(/requirement_versions is append-only/);
  });

  it('the prior text is retrievable and UNALTERED after both attempts', async () => {
    const { rows } = await db.query(
      `SELECT "description" FROM "requirement_versions" WHERE "id" = 'rv_probe'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe('As it stood.');
  });

  it('still permits INSERT — history appends, it never closes', async () => {
    await db.query(
      `INSERT INTO "requirement_versions"
         ("id","workspaceId","requirementId","description","type","priority","authoredById")
       VALUES ('rv_probe_2','ws_req','r_req','Second prior state.','functional','p2','u_req')`,
    );
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "requirement_versions"`);
    expect(rows[0].n).toBe(2);
  });

  it('the requirements table itself rejects an EMPTY description (FR-007 at the database)', async () => {
    await expect(
      db.query(`UPDATE "requirements" SET "description" = '   ' WHERE "id" = 'r_req'`),
    ).rejects.toThrow(/requirements_description_nonempty/);
  });
});
