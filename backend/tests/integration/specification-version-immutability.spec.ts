/**
 * T459 — specification_versions is append-only BY THE DATABASE (FR-013,
 * SC-007: any prior version retrievable UNCHANGED).
 *
 * Same reasoning as T453 (audit) and T457 (requirement versions): a mocked
 * repository cannot fail this; the requirement is that the rows cannot be
 * changed AT ALL. Raw SQL against a real PostgreSQL via Testcontainers, all
 * migrations applied in order — the trigger (T460) lives in the EPIC-009
 * migration, attached to EPIC-004's shared `reject_mutation()`, exactly as
 * EPIC-008's own migration header said it would be.
 *
 * The lifecycle tables ride along: the permitted-transition CHECK and the
 * transitions' own immutability are the same two-layer rule.
 *
 * RAID R-04: needs a container runtime; skipped loudly by name where none.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T459 · specification_versions is append-only, enforced by PostgreSQL (FR-013, SC-007)', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();

    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }

    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('ws_sv','probe',now())`);
    await db.query(
      `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
       VALUES ('u_sv','ws_sv','sv@example.test','Probe','$argon2id$probe',now())`,
    );
    await db.query(
      `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
       VALUES ('p_sv','ws_sv','Probe','u_sv',now())`,
    );
    await db.query(
      `INSERT INTO "specifications"
         ("id","workspaceId","projectId","title","engineName","engineVersion","generatedAt","createdById","updatedAt","updatedById")
       VALUES ('s_sv','ws_sv','p_sv','Probe spec','fixture','0.1.0',now(),'u_sv',now(),'u_sv')`,
    );
    await db.query(
      `INSERT INTO "specification_versions"
         ("id","workspaceId","specificationId","versionNumber","contentRaw","contentParsed","lifecycleStateAtCreation","authoredById")
       VALUES ('sv_probe','ws_sv','s_sv',1,'# As generated','{}','draft','u_sv')`,
    );
  }, 240_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  it('applied the migrations and holds the probe version row', async () => {
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "specification_versions"`);
    expect(rows[0].n).toBe(1);
  });

  it('rejects UPDATE — issued as raw SQL, past every code path', async () => {
    await expect(
      db.query(`UPDATE "specification_versions" SET "contentRaw" = 'rewritten' WHERE "id" = 'sv_probe'`),
    ).rejects.toThrow(/specification_versions is append-only/);
  });

  it('rejects DELETE', async () => {
    await expect(
      db.query(`DELETE FROM "specification_versions" WHERE "id" = 'sv_probe'`),
    ).rejects.toThrow(/specification_versions is append-only/);
  });

  it('the prior version is retrievable and UNALTERED after both attempts (SC-007)', async () => {
    const { rows } = await db.query(
      `SELECT "contentRaw" FROM "specification_versions" WHERE "id" = 'sv_probe'`,
    );
    expect(rows[0].contentRaw).toBe('# As generated');
  });

  it('still permits INSERT — versions append, they never close', async () => {
    await db.query(
      `INSERT INTO "specification_versions"
         ("id","workspaceId","specificationId","versionNumber","contentRaw","contentParsed","lifecycleStateAtCreation","authoredById")
       VALUES ('sv_probe_2','ws_sv','s_sv',2,'# Amended','{}','draft','u_sv')`,
    );
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "specification_versions"`);
    expect(rows[0].n).toBe(2);
  });

  it('the database refuses a transition outside the permitted set (FR-011)', async () => {
    // approved → draft is the named counterexample (US5 scenario 4).
    await expect(
      db.query(
        `INSERT INTO "lifecycle_transitions"
           ("id","workspaceId","specificationId","fromState","toState","actorId")
         VALUES ('lt_bad','ws_sv','s_sv','approved','draft','u_sv')`,
      ),
    ).rejects.toThrow(/lifecycle_permitted_transition/);
  });

  it('permits a legal transition — and then refuses to rewrite the history row', async () => {
    await db.query(
      `INSERT INTO "lifecycle_transitions"
         ("id","workspaceId","specificationId","fromState","toState","actorId")
       VALUES ('lt_ok','ws_sv','s_sv','draft','review','u_sv')`,
    );
    await expect(
      db.query(`UPDATE "lifecycle_transitions" SET "actorId" = 'someone-else' WHERE "id" = 'lt_ok'`),
    ).rejects.toThrow(/lifecycle_transitions is append-only/);
  });
});
