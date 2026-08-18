/**
 * T052 — cross-workspace access returns not-found, and is audited (FR-002,
 * FR-003, FR-033, SC-004).
 *
 * Why this is an integration test. A unit test can assert that `scoped()`
 * *returns* an object containing a `workspaceId`. It cannot assert that the
 * object, handed to a database, actually excludes another tenant's rows — and
 * that is the requirement. So this seeds two workspaces in a real PostgreSQL
 * and lets the helper's own output build the SQL:
 *
 *     selectWhere('projects', scoped(WS_A, { where: { id: <B's project> } }))
 *
 * If the helper ever stops emitting `workspaceId`, the `WHERE` clause loses the
 * filter and this test sees the other tenant's row. That is the whole design:
 * **the assertion fails by leaking, not by shape.**
 *
 * The audit half matters just as much. `SC-004` says a refusal is
 * indistinguishable from a genuine absence *to the caller* — which is exactly
 * why it must be distinguishable to the operator. A refusal nobody records is a
 * probe nobody can see.
 *
 * RAID R-04: this needs a container runtime. Skipped loudly and by name where
 * none exists — never silently passed.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { projectScoped, scoped, type QueryLike } from '../../src/core/workspace-scope.js';
import { assertSameWorkspace } from '../../src/core/workspace.guard.js';
import { NotFoundError } from '../../src/core/errors.js';
import { AuditService, type AuditWriter } from '../../src/modules/audit/audit.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(here, '../../prisma/migrations/20260814000000_init/migration.sql');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS_A = 'ws_alpha';
const WS_B = 'ws_beta';
const PROJECT_A = 'prj_apollo';
const PROJECT_A2 = 'prj_artemis';
const PROJECT_B = 'prj_gemini';

suite('T052 · cross-workspace access returns not-found and is audited (FR-002, SC-004)', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;
  let audit: AuditService;

  /**
   * Turn a `ScopedQuery` into real SQL.
   *
   * Deliberately dumb: it reads whatever keys the helper put in `where` and
   * emits one equality per key. Nothing here knows the word "workspace", so the
   * test cannot accidentally re-add a filter the helper dropped.
   */
  async function selectWhere(table: string, query: QueryLike): Promise<Record<string, unknown>[]> {
    const where = query.where ?? {};
    const keys = Object.keys(where);
    const clause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(' AND ');
    const values = keys.map((key) => (where as Record<string, unknown>)[key]);
    const { rows } = await db.query(
      `SELECT * FROM "${table}"${clause ? ` WHERE ${clause}` : ''}`,
      values,
    );
    return rows as Record<string, unknown>[];
  }

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    await db.query(readFileSync(MIGRATION, 'utf8'));

    for (const [id, name] of [
      [WS_A, 'Alpha'],
      [WS_B, 'Beta'],
    ]) {
      await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
        id,
        name,
      ]);
    }

    await db.query(
      `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
       VALUES ($1,$2,$3,'Alpha User','x',now())`,
      ['usr_alpha', WS_A, 'alpha@example.test'],
    );

    for (const [id, ws, name] of [
      [PROJECT_A, WS_A, 'Apollo'],
      [PROJECT_A2, WS_A, 'Artemis'],
      [PROJECT_B, WS_B, 'Gemini'],
    ]) {
      await db.query(
        `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId") VALUES ($1,$2,$3,'usr_alpha')`,
        [id, ws, name],
      );
    }

    // Project-scoped content, for the FR-003 half.
    for (const [id, ws, project, key] of [
      ['job_apollo', WS_A, PROJECT_A, 'apollo-1'],
      ['job_artemis', WS_A, PROJECT_A2, 'artemis-1'],
      ['job_gemini', WS_B, PROJECT_B, 'gemini-1'],
    ]) {
      await db.query(
        `INSERT INTO "generation_jobs"
           ("id","workspaceId","projectId","jobKey","kind","requestedById","engineName",
            "engineVersion","correlationId","inputRefs")
         VALUES ($1,$2,$3,$4,'generate_specification','usr_alpha','speckit','v1','corr','{}'::jsonb)`,
        [id, ws, project, key],
      );
    }

    let sequence = 0;
    const writer: AuditWriter = {
      async create(data) {
        // `id` has no database default — Prisma mints it client-side, so a raw
        // writer must too.
        await db.query(
          `INSERT INTO "audit_entries"
             ("id","workspaceId","actorId","action","targetType","targetId","outcome","detail","occurredAt")
           VALUES ($1,$2,$3,$4::"AuditAction",$5,$6,$7::"AuditOutcome",$8,$9)`,
          [
            `aud_${++sequence}`,
            data['workspaceId'],
            data['actorId'] ?? null,
            data['action'],
            data['targetType'],
            data['targetId'] ?? null,
            data['outcome'],
            data['detail'] ? JSON.stringify(data['detail']) : null,
            data['occurredAt'] ?? new Date(),
          ],
        );
      },
    };
    audit = new AuditService(writer);
  }, 180_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  it('reads its own workspace, so a zero result later means something', async () => {
    // Without this, every assertion below is satisfied by a broken query, an
    // empty table, or a typo'd table name.
    const rows = await selectWhere('projects', scoped(WS_A, { where: { id: PROJECT_A } }));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['name']).toBe('Apollo');
  });

  it('returns NOTHING for another workspace’s project', async () => {
    // The row exists. The scope is what hides it.
    const rows = await selectWhere('projects', scoped(WS_A, { where: { id: PROJECT_B } }));
    expect(rows).toHaveLength(0);

    const unscoped = await db.query(`SELECT * FROM "projects" WHERE "id" = $1`, [PROJECT_B]);
    expect(unscoped.rows).toHaveLength(1);
  });

  it('cannot be widened by a caller asking for the other workspace', async () => {
    // The override rule, against a real database rather than an object shape.
    // Note what a correct result looks like: the caller asked for Beta and gets
    // its OWN rows, because `scoped()` applies the real scope last. Asserting
    // an empty result here would be wrong — and would pass against a helper
    // that produced a query matching nothing at all.
    const rows = await selectWhere('projects', scoped(WS_A, { where: { workspaceId: WS_B } }));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row['workspaceId'] === WS_A)).toBe(true);
    expect(rows.map((row) => row['id'])).not.toContain(PROJECT_B);
  });

  it('refuses cross-workspace access with the SAME message as a genuine absence', async () => {
    // SC-004. If these two differ by a single character, the API confirms which
    // ids exist — which is the disclosure the whole design exists to prevent.
    const foreign = (await db.query(`SELECT * FROM "projects" WHERE "id" = $1`, [PROJECT_B]))
      .rows[0] as { workspaceId: string };

    const refused = capture(() => assertSameWorkspace(WS_A, foreign, { targetType: 'project' }));
    const absent = capture(() => assertSameWorkspace(WS_A, null, { targetType: 'project' }));

    expect(refused).toBeInstanceOf(NotFoundError);
    expect(absent).toBeInstanceOf(NotFoundError);
    expect((refused as Error).message).toBe((absent as Error).message);
    expect((refused as Error).constructor).toBe((absent as Error).constructor);
  });

  it('writes an audit entry for the refusal', async () => {
    const foreign = (await db.query(`SELECT * FROM "projects" WHERE "id" = $1`, [PROJECT_B]))
      .rows[0] as { workspaceId: string };

    const pending: Promise<void>[] = [];
    capture(() =>
      assertSameWorkspace(WS_A, foreign, {
        targetType: 'project',
        onRefused: (record) => {
          pending.push(
            audit.record({
              workspaceId: record.workspaceId,
              actorId: 'usr_alpha',
              action: 'access_refused',
              targetType: record.targetType,
              targetId: PROJECT_B,
              outcome: record.outcome,
            }),
          );
        },
      }),
    );
    await Promise.all(pending);

    const { rows } = await db.query(
      `SELECT * FROM "audit_entries" WHERE "outcome" = 'refused' AND "targetType" = 'project'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['action']).toBe('access_refused');
    expect(rows[0]?.['targetId']).toBe(PROJECT_B);
  });

  it('records the refusal against the ACTING workspace, not the target’s', async () => {
    // Getting this backwards would file Alpha's probe into Beta's audit trail:
    // invisible to the tenant who should see it, and visible to the one who
    // should not. It would also leak the target's existence into the record.
    const { rows } = await db.query(
      `SELECT "workspaceId" FROM "audit_entries" WHERE "outcome" = 'refused'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['workspaceId']).toBe(WS_A);
  });

  it('does not leak between projects INSIDE one workspace (FR-003)', async () => {
    // T456 against a real database. Same tenant, different project: the row is
    // there, and the project scope is what excludes it.
    const own = await selectWhere('generation_jobs', projectScoped(WS_A, PROJECT_A));
    expect(own).toHaveLength(1);
    expect(own[0]?.['id']).toBe('job_apollo');

    const sibling = await selectWhere(
      'generation_jobs',
      projectScoped(WS_A, PROJECT_A, { where: { id: 'job_artemis' } }),
    );
    expect(sibling).toHaveLength(0);
  });

  it('still applies the workspace filter when a project is named (FR-003 composes)', async () => {
    // The mutation that would pass a project-only implementation: Alpha names
    // Beta's project directly. Filtered by project alone this returns Beta's
    // job, and tenancy is gone with no error anywhere.
    const rows = await selectWhere('generation_jobs', projectScoped(WS_A, PROJECT_B));
    expect(rows).toHaveLength(0);

    const unscoped = await db.query(`SELECT * FROM "generation_jobs" WHERE "projectId" = $1`, [
      PROJECT_B,
    ]);
    expect(unscoped.rows).toHaveLength(1);
  });
});

/** Run and return whatever was thrown, so two refusals can be compared. */
function capture(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected a refusal, and nothing was thrown.');
}
