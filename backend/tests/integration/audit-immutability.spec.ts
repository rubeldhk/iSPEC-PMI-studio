/**
 * T453 — the audit trail is append-only BY THE DATABASE (FR-033, SC-012).
 *
 * Why this is an integration test and not a unit test: a mocked repository
 * cannot fail it. Asserting that the service never calls `update` proves only
 * that the service is well behaved today. The requirement is that the row
 * cannot be changed *at all* — by a compromised service, a stray migration, or
 * a hand-typed psql session.
 *
 * So this issues raw SQL against a real PostgreSQL, with the real migration
 * applied, and asserts the database itself raises. It is the only form of the
 * assertion that means anything.
 *
 * RAID R-04: this needs a container runtime. It is skipped, loudly and by name,
 * where none is available — never silently passed.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(here, '../../prisma/migrations/20260814000000_init/migration.sql');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T453 · audit_entries is append-only, enforced by PostgreSQL (FR-033)', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    await db.query(readFileSync(MIGRATION, 'utf8'));

    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
      'ws_immutability',
      'immutability probe',
    ]);
    await db.query(
      `INSERT INTO "audit_entries" ("id","workspaceId","action","targetType","outcome")
       VALUES ($1,$2,'create','probe','success')`,
      ['audit_probe', 'ws_immutability'],
    );
  }, 180_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  it('applied the migration and holds the probe row', async () => {
    // A false pass would be an empty table, where UPDATE and DELETE are
    // trivially no-ops and the trigger never fires.
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "audit_entries"`);
    expect(rows[0].n).toBe(1);
  });

  it('rejects UPDATE', async () => {
    await expect(
      db.query(`UPDATE "audit_entries" SET "outcome" = 'failed' WHERE "id" = 'audit_probe'`),
    ).rejects.toThrow(/audit_entries is append-only/);
  });

  it('rejects DELETE', async () => {
    await expect(
      db.query(`DELETE FROM "audit_entries" WHERE "id" = 'audit_probe'`),
    ).rejects.toThrow(/audit_entries is append-only/);
  });

  it('leaves the row intact after both attempts', async () => {
    const { rows } = await db.query(
      `SELECT "outcome" FROM "audit_entries" WHERE "id" = 'audit_probe'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe('success');
  });

  it('still permits INSERT — append-only, not read-only', async () => {
    await db.query(
      `INSERT INTO "audit_entries" ("id","workspaceId","action","targetType","outcome")
       VALUES ('audit_probe_2', 'ws_immutability', 'update', 'probe', 'success')`,
    );
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "audit_entries"`);
    expect(rows[0].n).toBe(2);
  });

  it('exposes reject_mutation() for the version tables EPIC-007 and EPIC-009 will add', async () => {
    // The function is shared by contract. Those epics attach their own triggers
    // and must not redefine it; this asserts it is there to attach to.
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'reject_mutation'`,
    );
    expect(rows[0].n).toBe(1);
  });
});
