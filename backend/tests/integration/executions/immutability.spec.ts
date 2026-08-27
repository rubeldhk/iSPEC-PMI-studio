/**
 * T1025, T1080 (EPIC-037 Band A) — the registry's authoritative tables are
 * append-only, and the runtime cannot get around it.
 *
 * Asserted as a **non-superuser, non-owner** role, because a trigger the
 * application could bypass protects nothing where it matters. A superuser
 * proving `UPDATE` is refused proves only that the trigger fires, not that the
 * running system is bound by it.
 *
 * The classification is asserted too, in both directions. Six tables are
 * authoritative and carry the trigger; two are projections and deliberately do
 * **not** — a projection that cannot be rewritten cannot be rebuilt, and
 * rebuildability is exactly what makes it non-authoritative.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_exec';
const APP_ROLE = 'pmi_exec_app';
const EXEC = 'exec_1';

/** Authoritative: append-only, trigger attached. */
const AUTHORITATIVE = [
  'execution_events',
  'agent_identity_snapshots',
  'execution_target_bindings',
  'execution_artifacts',
  'execution_comments',
  'status_transition_proposals',
] as const;

/** Projections: rebuildable, and therefore deliberately unprotected. */
const PROJECTIONS = ['execution_state', 'status_transition_state'] as const;

suite('T1080 · the execution registry refuses mutation, under the real application role', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;
  let app: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();
    db = new Client({ connectionString: url });
    await db.connect();

    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'exec',now())`, [
      WS,
    ]);
    await db.query(
      `INSERT INTO "executions"
         ("id","correlationId","idempotencyKey","workspaceId","command","argsSanitized",
          "initiatorType","initiatorId","surface","contractVersion")
       VALUES ($1,'c1','k1',$2,'specify','{}'::jsonb,'agent','p_agent','fixture','1.0')`,
      [EXEC, WS],
    );
    await db.query(
      `INSERT INTO "execution_events"
         ("id","workspaceId","executionId","sequence","class","type","payload","occurredAt",
          "emittedBy","idempotencyKey","integrityHash")
       VALUES ('ev1',$1,$2,1,'lifecycle','registered','{}'::jsonb, now(),'p_agent','ek1','h1')`,
      [WS, EXEC],
    );
    await db.query(
      `INSERT INTO "execution_comments"
         ("id","workspaceId","executionId","authorId","authorType","commentType","body","integrityHash")
       VALUES ('cm1',$1,$2,'p_agent','agent','completion','done','h2')`,
      [WS, EXEC],
    );
    await db.query(
      `INSERT INTO "execution_state"
         ("executionId","workspaceId","lifecycleState","governanceState","projectedThroughSequence")
       VALUES ($1,$2,'registered','governed',1)`,
      [EXEC, WS],
    );

    // EVERY authoritative table needs a row. `reject_mutation()` is a row-level
    // BEFORE trigger, so an UPDATE against an empty table affects no rows and
    // succeeds -- four of the six assertions below would have passed vacuously.
    await db.query(
      `INSERT INTO "agent_identity_snapshots"
         ("id","workspaceId","executionId","descriptorRef","principalSnapshotId",
          "provider","model","adapter","capabilities")
       VALUES ('ais1',$1,$2,'p_agent','snap1','frozen','frozen','fixture',ARRAY[]::TEXT[])`,
      [WS, EXEC],
    );
    await db.query(
      `INSERT INTO "execution_target_bindings"
         ("id","workspaceId","executionId","phase","targetType","targetId")
       VALUES ('tb1',$1,$2,'input','specification','spec_1')`,
      [WS, EXEC],
    );
    await db.query(
      `INSERT INTO "execution_artifacts"
         ("id","workspaceId","executionId","role","reference")
       VALUES ('ar1',$1,$2,'generated','specs/037/spec.md')`,
      [WS, EXEC],
    );
    await db.query(
      `INSERT INTO "status_transition_proposals"
         ("id","workspaceId","executionId","targetRef","targetVersion","expectedCurrentStatus",
          "proposedState","rationale","proposedBy","proposerSnapshotId","correlationId","idempotencyKey")
       VALUES ('pr1',$1,$2,'spec_1',1,'draft','review','ready','p_agent','snap1','c1','pk1')`,
      [WS, EXEC],
    );
    await db.query(
      `INSERT INTO "status_transition_state"
         ("proposalId","workspaceId","state","projectedThroughSequence")
       VALUES ('pr1',$1,'pending',1)`,
      [WS],
    );

    await db.query(`CREATE ROLE "${APP_ROLE}" LOGIN PASSWORD 'probe'`);
    await db.query(`GRANT USAGE ON SCHEMA public TO "${APP_ROLE}"`);
    await db.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_ROLE}"`,
    );

    const uri = new URL(url);
    uri.username = APP_ROLE;
    uri.password = 'probe';
    app = new Client({ connectionString: uri.toString() });
    await app.connect();
  }, 300_000);

  afterAll(async () => {
    await app?.end();
    await db?.end();
    await container?.stop();
  }, 120_000);

  it('the probing role has no way around the trigger', async () => {
    // Without this the rest is theatre: a superuser, a table owner or a role
    // with BYPASSRLS would each defeat the protection by a different route.
    const { rows } = await app.query<{
      su: boolean;
      bypass: boolean;
      owner: boolean;
    }>(
      `SELECT r.rolsuper AS su, r.rolbypassrls AS bypass,
              pg_catalog.pg_get_userbyid(c.relowner) = current_user AS owner
         FROM pg_roles r, pg_class c
        WHERE r.rolname = current_user AND c.relname = 'execution_events'`,
    );
    expect(rows[0]?.su, 'a superuser proves nothing here').toBe(false);
    expect(rows[0]?.bypass).toBe(false);
    expect(rows[0]?.owner, 'a table owner can disable its own triggers').toBe(false);
  });

  it.each(AUTHORITATIVE)('%s refuses UPDATE and DELETE', async (table) => {
    // Guard first: an UPDATE against an empty table affects no rows and would
    // succeed, so the refusal below would prove nothing.
    const { rows: count } = await app.query<{ n: string }>(`SELECT count(*) AS n FROM "${table}"`);
    expect(Number(count[0]!.n), `${table} is empty; this assertion would be vacuous`).toBeGreaterThan(0);

    await expect(app.query(`UPDATE "${table}" SET "workspaceId" = 'x'`)).rejects.toThrow(
      /append-only/i,
    );
    await expect(app.query(`DELETE FROM "${table}"`)).rejects.toThrow(/append-only/i);
  });

  it.each(AUTHORITATIVE)('%s cannot have its triggers disabled or be altered', async (table) => {
    await expect(app.query(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`)).rejects.toThrow();
    await expect(app.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS x`)).rejects.toThrow();
  });

  it.each(PROJECTIONS)('%s IS writable — it is a projection, not evidence', async (table) => {
    // The other direction, and it matters as much. Protecting a projection
    // would make `rebuild` impossible and quietly turn a cache into a second
    // source of truth.
    await expect(
      app.query(`UPDATE "${table}" SET "projectedThroughSequence" = "projectedThroughSequence"`),
    ).resolves.toBeTruthy();
  });

  it('a correction appends rather than overwriting', async () => {
    // The redaction rule (`R-037-9`): the original survives, the successor
    // carries the redacted body, and the thread stays verifiable.
    await app.query(
      `INSERT INTO "execution_comments"
         ("id","workspaceId","executionId","authorId","authorType","commentType","body",
          "supersedesCommentId","integrityHash","redactionState","redactedBy","redactedAt","redactionReason")
       VALUES ('cm2',$1,$2,'p_agent','agent','completion','[redacted]','cm1','h3','redacted','u_admin', now(),'contained a token')`,
      [WS, EXEC],
    );
    const { rows } = await app.query<{ id: string; body: string }>(
      `SELECT "id","body" FROM "execution_comments" WHERE "executionId" = $1 ORDER BY "createdAt"`,
      [EXEC],
    );
    expect(rows.map((r) => r.id)).toEqual(['cm1', 'cm2']);
    expect(rows[0]?.body, 'the original body was overwritten').toBe('done');
  });

  it('every authoritative table names its trigger in pg_trigger', async () => {
    const { rows } = await db.query<{ relname: string }>(
      `SELECT c.relname FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_proc  p ON p.oid = t.tgfoid
        WHERE p.proname = 'reject_mutation' AND NOT t.tgisinternal
        ORDER BY 1`,
    );
    const protectedTables = rows.map((r) => r.relname);
    for (const table of AUTHORITATIVE) expect(protectedTables).toContain(table);
    // And the projections are absent, asserted rather than assumed.
    for (const table of PROJECTIONS) expect(protectedTables).not.toContain(table);
  });
});
