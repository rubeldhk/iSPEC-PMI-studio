/**
 * `T1164`, `T1166` (EPIC-033 Phase 9) — a Room can be opened in the running
 * application.
 *
 * Written to fail. `T405j` recorded quickstart Scenario 13 as *not run*; the
 * investigation behind Phase 9 found something stronger — the journey cannot be
 * **attempted**, because nothing can create a Requirement Room object at all.
 *
 * ## Failing for the right reason
 *
 * The first block pins the **current** behaviour, and it passes today. Its job is
 * to make the failure below diagnosable: these tests must fail because no
 * workflow type is registered, and not because the route is missing, the session
 * is wrong, or the database is unreachable. Without it, a red suite would say
 * only that something is broken.
 *
 * `LOOP_STAGE_HANDLERS` is `new StageRegistry([])`; `buildConfigRegistry` refuses
 * every workflow file that names an unregistered stage; `safeRegistry` swallows
 * that into an empty registry so one unfilled seam does not take the API down
 * (`FR-GEL-062`); and `declareObject` then refuses each type **by name**.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const PREFIX = 'v1';
const WS = 'ws_open';
const USER = 'u_open';
const PROJECT = 'pr_open';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: USER,
    async seed(db, ids) {
      await db.query(
        `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
         VALUES ($1,$2,'Open',$3,now())`,
        [PROJECT, ids.workspaceId, ids.userId],
      );
    },
  });
  app = harness.app;
}, 300_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

const authed = (method: 'post' | 'get', path: string) =>
  request(app.getHttpServer())[method](`/${PREFIX}${path}`).set('Cookie', harness.cookie);

suite('T1164 · the current state, pinned so the failures below are diagnosable', () => {
  it('the loop config registry is empty — no workflow type is declarable', async () => {
    // The control this whole file rests on. If this ever fails, the tests below
    // are failing for a reason nobody has established.
    const res = await authed('post', '/loop/objects').send({
      projectId: PROJECT,
      workflowType: 'requirement-room',
      subjectType: 'specification',
      subjectId: 'spec_open',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('and it is not the route, the session or the database', async () => {
    // Each of the three things that could otherwise explain the failures below.
    // A MOUNTED route, probed with an id that does not exist. The
    // discriminator is `T405e`'s: a handler that ran returns its own message,
    // while an unmatched path gets the filter's authored sentence.
    const mounted = await authed('get', '/loop/objects/no-such-object/history');
    const message = (mounted.body as { error?: { message?: string } }).error?.message;
    expect(message, 'the loop routes are not mounted').not.toBe(
      'The requested resource does not exist.',
    );
    expect(message).toMatch(/no loop object/i);

    const unauthenticated = await request(app.getHttpServer())
      .post(`/${PREFIX}/loop/objects`)
      .send({ projectId: PROJECT, workflowType: 'requirement-room' });
    // `401`, not EPIC-024's opaque `404`: the caller is not being told whether
    // something exists, only that it never got as far as being asked.
    expect(unauthenticated.status, 'the session is not being read').toBe(401);

    const reachable = await authed('get', '/projects');
    expect(reachable.status, 'the database is unreachable').toBeLessThan(500);
  });
});

suite('T1164 · a Requirement Room object can be declared', () => {
  it('declares, and lands in Event', async () => {
    const res = await authed('post', '/loop/objects').send({
      projectId: PROJECT,
      workflowType: 'requirement-room',
      subjectType: 'specification',
      subjectId: 'spec_open',
    });
    expect(res.status).toBeLessThan(300);
    expect(res.body).toMatchObject({ currentStage: 'Event' });
    expect(res.body.objectId).toBeTruthy();
  });

  it('is scoped to the caller’s workspace, which the body cannot name', async () => {
    // `T1148`/`T1156` — the workspace comes from the session. A body naming
    // another workspace must not place the object there.
    const res = await authed('post', '/loop/objects').send({
      workspaceId: 'ws_somewhere_else',
      projectId: PROJECT,
      workflowType: 'requirement-room',
      subjectType: 'specification',
      subjectId: 'spec_scoped',
    });
    expect(res.status).toBeLessThan(300);

    const history = await authed('get', `/loop/objects/${String(res.body.objectId)}/history`);
    expect(history.status, 'the object landed outside the caller’s workspace').toBeLessThan(300);
  });

  it('both workflow files load — the registry is all-or-nothing', async () => {
    // `buildConfigRegistry` refuses EVERY file if any one names an unregistered
    // stage, so registering the Room's six stages is load-bearing for
    // `example-workflow` too. If that file ever adds `Execute`, this says so
    // rather than the Room mysteriously failing to declare.
    const example = await authed('post', '/loop/objects').send({
      projectId: PROJECT,
      workflowType: 'example-workflow',
      subjectType: 'specification',
      subjectId: 'spec_example',
    });
    expect(example.status, 'example-workflow stopped loading').toBeLessThan(300);
  });

  it('a workflow type nobody declared is still refused', async () => {
    // Anti-vacuity: registering handlers must not make `declareObject` accept
    // anything it is handed.
    const res = await authed('post', '/loop/objects').send({
      projectId: PROJECT,
      workflowType: 'not-a-real-workflow',
      subjectType: 'specification',
      subjectId: 'spec_bogus',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
