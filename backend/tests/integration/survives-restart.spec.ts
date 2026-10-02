/**
 * `T1332` (EPIC-041) — what the platform creates, it keeps across a restart.
 *
 * `SC-LPW-007`, `US4` scenario 2. Tasks are created and a run is started through
 * the real routes of one application; that application is disposed; a second is
 * booted against the same database; everything is read back through the routes.
 * The test that would have found PMI-DOC-004B §2.1's in-memory stores on the
 * first day.
 *
 * Written to FAIL before `T1325`, `T1327`, `T1329` exist.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { rebootApp, startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let started: AuthenticatedApp;

beforeAll(async () => {
  if (noRuntime) return;
  started = await startAuthenticatedApp({
    workspaceId: 'ws_restart',
    userId: 'u_restart',
    seed: async (db, ids) => {
      await db.query(
        `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt") VALUES ('pr_restart',$1,'Restart',$2,now())`,
        [ids.workspaceId, ids.userId],
      );
      await db.query(
        `INSERT INTO "specifications" ("id","workspaceId","projectId","title","lifecycleState","engineName","engineVersion","generatedAt","createdById","updatedById","updatedAt")
         VALUES ('spec_restart',$1,'pr_restart','Restart spec','approved','fixture','1',now(),$2,$2,now())`,
        [ids.workspaceId, ids.userId],
      );
      // Tasks written the way the generator writes them; regeneration through
      // the engine is EPIC-012's own journey, not this test's subject.
      for (const n of [1, 2, 3]) {
        await db.query(
          `INSERT INTO "tasks" ("id","workspaceId","specificationId","description","status","engineName","engineVersion","updatedAt")
           VALUES ($1,$2,'spec_restart',$3,'not_started','fixture','1',now())`,
          [`task_restart_${n}`, ids.workspaceId, `Task ${n}`],
        );
      }
    },
  });
}, 600_000);

afterAll(async () => {
  await started?.close();
}, 120_000);

suite('T1332 · a restart loses nothing', () => {
  it('tasks updated and a run started before the restart are readable after it', async () => {
    const first = started.app.getHttpServer();
    const cookie = started.cookie;

    // Act, through the routes.
    await request(first).patch('/v1/tasks/task_restart_1').set('Cookie', cookie).send({ status: 'done' }).expect(200);
    await request(first).patch('/v1/tasks/task_restart_2').set('Cookie', cookie).send({ status: 'in_progress' }).expect(200);
    const run = await request(first)
      .post('/v1/projects/pr_restart/runs')
      .set('Cookie', cookie)
      .send({ mode: 'unattended', stopRange: 'after_specification' })
      .expect(202);

    // Restart.
    await started.app.close();
    const second = await rebootApp(started.databaseUrl, { workspaceId: started.workspaceId, userId: started.userId });
    try {
      const tasks = await request(second.app.getHttpServer())
        .get('/v1/specifications/spec_restart/tasks')
        .set('Cookie', second.cookie)
        .expect(200);
      const byId = new Map((tasks.body as { id: string; status: string }[]).map((t) => [t.id, t.status]));
      expect(byId.get('task_restart_1')).toBe('done');
      expect(byId.get('task_restart_2')).toBe('in_progress');
      expect(byId.get('task_restart_3')).toBe('not_started');

      const runs = await request(second.app.getHttpServer())
        .get('/v1/projects/pr_restart/runs')
        .set('Cookie', second.cookie)
        .expect(200);
      expect((runs.body as { id: string }[]).map((r) => r.id)).toContain(run.body.id);
    } finally {
      await second.app.close();
    }
  });
});
