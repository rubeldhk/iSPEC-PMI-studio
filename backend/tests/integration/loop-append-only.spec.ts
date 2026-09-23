/**
 * T993p — `loop_transitions` is append-only BY THE DATABASE (`FR-GEL-040`).
 *
 * Why an integration test and not a unit test: a mocked repository cannot fail
 * it. Asserting the service never calls `update` proves the service is well
 * behaved today. The requirement is that the row cannot be changed *at all* —
 * by a compromised service, a stray migration, or a hand-typed psql session.
 *
 * This is the `audit-immutability.spec.ts` precedent followed, not duplicated:
 * `reject_mutation()` is EPIC-004's shared function and this table attaches to
 * it. Also asserted here: `loop_instance_configurations` is superseded rather
 * than rewritten (`FR-GEL-006`), which is a *different* rule — it permits one
 * column to change — and therefore has its own trigger.
 *
 * RAID R-04: needs a container runtime. Skipped loudly and by name where none
 * is available — never silently passed.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T993p · loop_transitions is append-only, enforced by PostgreSQL (FR-GEL-040)', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();

    // Every migration, in order — the same sequence `prisma migrate deploy`
    // runs. The triggers under test arrive in the last one.
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }

    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
      'ws_loop',
      'loop append-only probe',
    ]);
    await db.query(
      `INSERT INTO "loop_objects"
         ("id","workspaceId","projectId","workflowType","configVersion",
          "subjectType","subjectId","currentStage","version")
       VALUES ('lo_probe','ws_loop','p_probe','probe-type',1,'opaque','subj_1','Event',1)`,
    );
    await db.query(
      `INSERT INTO "loop_transitions"
         ("id","workspaceId","objectId","objectVersion","fromStage","toStage","outcome",
          "actorId","actorKind","authorityBasis","configVersion","gateOutcomes")
       VALUES ('lt_probe','ws_loop','lo_probe',0,NULL,'Event','accepted',
               'u_probe','human','probe-authority',1,'[]'::jsonb)`,
    );
  }, 180_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  it('applied the migrations and holds the probe row', async () => {
    // Anti-vacuity. A false pass would be an empty table, where UPDATE and
    // DELETE are trivially no-ops and the trigger never fires.
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "loop_transitions"`);
    expect(rows[0].n).toBe(1);
  });

  it('refuses UPDATE on a recorded transition', async () => {
    await expect(
      db.query(`UPDATE "loop_transitions" SET "toStage" = 'Outcome' WHERE "id" = 'lt_probe'`),
    ).rejects.toThrow();
  });

  it('refuses DELETE on a recorded transition', async () => {
    await expect(
      db.query(`DELETE FROM "loop_transitions" WHERE "id" = 'lt_probe'`),
    ).rejects.toThrow();
  });

  it('leaves the row exactly as recorded after both refusals', async () => {
    const { rows } = await db.query(
      `SELECT "toStage", "outcome"::text AS outcome FROM "loop_transitions" WHERE "id" = 'lt_probe'`,
    );
    expect(rows[0]).toEqual({ toStage: 'Event', outcome: 'accepted' });
  });

  it('still accepts INSERT — append-only, not read-only', async () => {
    // The failure this catches: a trigger written `BEFORE INSERT OR UPDATE OR
    // DELETE` would pass all three assertions above and make the table unusable.
    await db.query(
      `INSERT INTO "loop_transitions"
         ("id","workspaceId","objectId","objectVersion","fromStage","toStage","outcome",
          "actorId","actorKind","authorityBasis","configVersion","gateOutcomes")
       VALUES ('lt_probe2','ws_loop','lo_probe',1,'Event','Context','accepted',
               'u_probe','human','probe-authority',1,'[]'::jsonb)`,
    );
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "loop_transitions"`);
    expect(rows[0].n).toBe(2);
  });
});

suite('T993p · a loop configuration is superseded, never rewritten (FR-GEL-006)', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
      'ws_cfg',
      'loop config probe',
    ]);
    await db.query(
      `INSERT INTO "loop_instance_configurations"
         ("id","workspaceId","workflowType","configVersion","stages","authorities",
          "requiredGates","triggerRules","approvedBy","approvalRef")
       VALUES ('cfg_probe','ws_cfg','probe-type',1,'["Event","Outcome"]'::jsonb,'{}'::jsonb,
               '{}'::jsonb,'{}'::jsonb,'u_approver','commit_abc')`,
    );
  }, 180_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  it('refuses to rewrite the stages of a configuration in force', async () => {
    // FR-GEL-006's whole point: an in-flight object pinned to configVersion 1
    // must still resolve to the bytes it started under. Rewriting them changes
    // history for every object mid-loop, silently.
    await expect(
      db.query(
        `UPDATE "loop_instance_configurations"
         SET "stages" = '["Event","Decide","Outcome"]'::jsonb WHERE "id" = 'cfg_probe'`,
      ),
    ).rejects.toThrow();
  });

  it('refuses to rewrite the approval it was accepted under', async () => {
    await expect(
      db.query(
        `UPDATE "loop_instance_configurations" SET "approvalRef" = 'commit_zzz' WHERE "id" = 'cfg_probe'`,
      ),
    ).rejects.toThrow();
  });

  it('refuses DELETE', async () => {
    await expect(
      db.query(`DELETE FROM "loop_instance_configurations" WHERE "id" = 'cfg_probe'`),
    ).rejects.toThrow();
  });

  it('PERMITS setting supersededBy — the one column a change may touch', async () => {
    // The distinction that makes this trigger different from reject_mutation():
    // superseding is how a configuration change is recorded, so a blanket
    // append-only rule here would make FR-GEL-005 unimplementable.
    await db.query(
      `UPDATE "loop_instance_configurations" SET "supersededBy" = 2 WHERE "id" = 'cfg_probe'`,
    );
    const { rows } = await db.query(
      `SELECT "supersededBy" FROM "loop_instance_configurations" WHERE "id" = 'cfg_probe'`,
    );
    expect(rows[0].supersededBy).toBe(2);
  });

  it('still refuses a rewrite smuggled in alongside a supersede', async () => {
    // The bypass a naive "did supersededBy change?" check would allow.
    await expect(
      db.query(
        `UPDATE "loop_instance_configurations"
         SET "supersededBy" = 3, "approvedBy" = 'someone_else' WHERE "id" = 'cfg_probe'`,
      ),
    ).rejects.toThrow();
  });
});
