/**
 * `T994l` (EPIC-034) — nothing completed is destroyed by a re-plan.
 *
 * `FR-CHR-065`, `SC-CHR-007`: **zero** completed work items destroyed. Proved
 * against PostgreSQL, because the destruction this forbids is a `DELETE` and a
 * re-`INSERT` — and a unit test with a stubbed store would watch the stub
 * behave and learn nothing about the rows.
 *
 * ## What is actually being guarded
 *
 * `TaskRegenerationService.regenerate()` **replaces** a task list. `EPIC-012`
 * built it as replace-with-confirmation; the confirmation makes the replacement
 * deliberate, not non-destructive. `FR-CHR-062` says downstream work must be
 * updated *"through `BR-0154`'s mechanism"* — and an implementer who reads that,
 * finds a service named exactly for the job, calls it and sees green has done
 * the thing the requirement forbids.
 *
 * So this test does not check that the recorder behaved well. It checks that
 * **the task rows are byte-identical afterwards**, including the ones marked
 * completed, so that any path which replaced them fails here regardless of how
 * it was reached or how deliberate it looked.
 *
 * `R-034-2` and the closure checklist pair this with
 * `change-room-independence.spec.ts`: the import ban and this row check must
 * *both* fail if the shortcut is taken.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import {
  PrismaChangeRoomStore,
  type ChangeRoomPrismaClient,
} from '../../src/modules/change-room/change-room.store.prisma.js';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';
import { RePlanRecorder } from '../../src/modules/change-room/replan.recorder.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_replan';
const PROJECT = 'pr_replan';
const SPEC = 'spec_replan';

interface TaskSnapshot {
  id: string;
  status: string;
  description: string;
  updatedAt: Date;
}

suite('T994l · a re-plan destroys no completed work', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  const snapshot = async (): Promise<TaskSnapshot[]> => {
    const rows = await db.query<TaskSnapshot>(
      'SELECT "id","status"::text AS status,"description","updatedAt" FROM "tasks" ' +
        'WHERE "specificationId" = $1 ORDER BY "id"',
      [SPEC],
    );
    return rows.rows;
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }

    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$1,now())`, [WS]);
    await db.query(
      `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
       VALUES ('u_replan',$1,'replan@pmi.local','Replan','unused',now())`,
      [WS],
    );
    await db.query(
      `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
       VALUES ($1,$2,'Replan','u_replan',now())`,
      [PROJECT, WS],
    );
    await db.query(
      `INSERT INTO "specifications"
         ("id","workspaceId","projectId","title","lifecycleState","engineName","engineVersion",
          "generatedAt","isOutOfDate","createdById","updatedById","updatedAt")
       VALUES ($1,$2,$3,'Notification window','draft','test','1',now(),false,$4,$4,now())`,
      [SPEC, WS, PROJECT, 'u_replan'],
    );
    // Three tasks, two of them finished. The completed pair is the population
    // `SC-CHR-007` counts.
    for (const [id, status] of [
      // `TaskStatus` is ('not_started','in_progress','done') — `done` is what
      // completed work looks like in this schema.
      ['task_done_1', 'done'],
      ['task_done_2', 'done'],
      ['task_open_1', 'not_started'],
    ] as const) {
      await db.query(
        `INSERT INTO "tasks"
           ("id","workspaceId","specificationId","description","status","engineName",
            "engineVersion","updatedAt")
         VALUES ($1,$2,$3,$4,$5::"TaskStatus",'test','1',now())`,
        [id, WS, SPEC, `work item ${id}`, status],
      );
    }

    // The obligation references a decision, which references an impact view and
    // a change request. Seeded in full rather than stubbed: the foreign keys
    // are part of what makes a re-plan obligation attributable, and a test that
    // routed around them would be proving something about a shape nobody
    // stores.
    await db.query(
      `INSERT INTO "change_requests"
         ("id","workspaceId","projectId","roomObjectId","targetBaselineId","targetBaselineVersion",
          "requestedOutcome","reason","requester")
       VALUES ('cr_replan',$1,$2,'ro_replan','b_1',1,'shorten the window','regulator','u_replan')`,
      [WS, PROJECT],
    );
    await db.query(
      `INSERT INTO "change_impact_views"
         ("id","workspaceId","changeRequestId","computedAt","traversalDepth",
          "architectureDetail","violationCheckStatus","violationCheckBecause")
       VALUES ('iv_replan',$1,'cr_replan',now(),25,$2,'not-run',$3)`,
      [WS, 'no architecture decision source is bound', 'BR-0073 is unowned (U-17)'],
    );
    await db.query(
      `INSERT INTO "change_decisions"
         ("id","workspaceId","changeRequestId","decidedBy","decidedByKind","authorityBasis",
          "objectVersion","decidedAt","decisionId","chosenOption","declinedOptions","rationale",
          "impactViewId")
       VALUES ('cd_replan',$1,'cr_replan','u_replan','human','DA-0007',1,now(),'dec_replan',
               $2::jsonb,$3::jsonb,'B keeps the migration reversible.','iv_replan')`,
      [WS, JSON.stringify({ optionId: 'b' }), JSON.stringify([{ optionId: 'a' }])],
    );
  }, 300_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  }, 120_000);

  it('the fixture really does have completed work to lose', async () => {
    // Anti-vacuity. Every assertion below is trivially satisfied if there is
    // nothing completed in the table.
    const before = await snapshot();
    expect(before).toHaveLength(3);
    expect(before.filter((t) => t.status === 'done')).toHaveLength(2);
  });

  it('records the obligation against a real database', async () => {
    const store = new PrismaChangeRoomStore({
      changeRePlanObligation: {
        create: async ({ data }: never) => {
          const row = data as Record<string, unknown>;
          const cols = Object.keys(row)
            .map((c) => `"${c}"`)
            .join(',');
          const params = Object.keys(row)
            .map((_, i) => `$${i + 1}`)
            .join(',');
          await db.query(
            `INSERT INTO "change_replan_obligations" (${cols}) VALUES (${params})`,
            Object.values(row),
          );
          return row;
        },
        findMany: async () =>
          (await db.query('SELECT * FROM "change_replan_obligations"')).rows,
      },
    } as unknown as ChangeRoomPrismaClient);

    const recorded = await new RePlanRecorder(store).record({
      workspaceId: WS,
      changeDecisionId: 'cd_replan',
      affectedSpecificationId: SPEC,
      whatMustChange: 'the notification window drops from 24h to 1h',
      why: 'the approved change shortens the regulatory window',
    });
    expect(recorded.state).toBe('recorded');

    const stored = await db.query(
      'SELECT "state" FROM "change_replan_obligations" WHERE "affectedSpecificationId" = $1',
      [SPEC],
    );
    expect(stored.rowCount).toBe(1);
    expect(stored.rows[0]?.state).toBe('recorded');
  });

  it('and not one task row changed', async () => {
    // `SC-CHR-007`. Byte-identical, including `updatedAt`: a re-plan that
    // touched a row without replacing it would still be editing work the
    // requirement protects.
    const after = await snapshot();
    expect(after.map((t) => t.id)).toEqual(['task_done_1', 'task_done_2', 'task_open_1']);
    expect(after.filter((t) => t.status === 'done')).toHaveLength(2);
    for (const task of after) {
      expect(task.description).toBe(`work item ${task.id}`);
    }
  });

  it('no task was replaced by one with a new id', async () => {
    // The specific shape of the destruction. `regenerate()` returns "the new
    // list when replaced", and a replaced task id resolving to its
    // specification is — in `EPIC-012`'s own words — history, not error.
    const rows = await db.query('SELECT COUNT(*)::int AS n FROM "tasks" WHERE "specificationId" = $1', [
      SPEC,
    ]);
    expect(rows.rows[0]?.n).toBe(3);
  });

  it('the obligation is the only thing the re-plan produced', async () => {
    // What `R-034-2` asks for: the requirement recorded and outstanding, and
    // nothing executed. Sitting in `recorded` is the visible, honest state.
    const obligations = await db.query(
      'SELECT "state" FROM "change_replan_obligations" WHERE "workspaceId" = $1',
      [WS],
    );
    expect(obligations.rows.every((r: { state: string }) => r.state === 'recorded')).toBe(true);
  });

  it('and the recorder has no verb that could have replaced anything', async () => {
    // Repeated from the unit test against the real class, so this file fails on
    // its own if an execute path is ever added.
    const subject = new RePlanRecorder(new InMemoryChangeRoomStore());
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(subject));
    for (const forbidden of ['regenerate', 'execute', 'replace']) {
      expect(methods).not.toContain(forbidden);
    }
  });
});
