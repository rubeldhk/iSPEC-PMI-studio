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
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

/**
 * Whether a Room was declared, observed at the seam rather than in the store.
 *
 * `InMemoryLoopStore` keeps its map in a true `#private` field, so it cannot be
 * counted from outside — and a helper that quietly returned `0` would make the
 * no-orphan assertion below pass against an implementation that created one
 * every time. Spying on `declareObject` is the observation that can actually
 * fail.
 */
async function watchDeclare(): Promise<{ calls: () => number; restore: () => void }> {
  const { LoopService } = await import('../../src/modules/loop/loop.service.js');
  const loop = app.get(LoopService, { strict: false });
  const spy = vi.spyOn(loop, 'declareObject');
  return { calls: (): number => spy.mock.calls.length, restore: (): void => spy.mockRestore() };
}

suite('T1164 · the current state, pinned so the failures below are diagnosable', () => {
  it('the loop config registry is populated — T1165 filled the seam', async () => {
    // The inverse of what this assertion said before `T1165`. It was written to
    // pin the empty registry — every workflow type refused, `500` — and was
    // observed doing so; the commit records that run. Kept, inverted, because
    // the diagnostic value is the same in both directions: if this fails, the
    // tests below are failing for a reason nobody has established.
    const res = await authed('post', '/loop/objects').send({
      projectId: PROJECT,
      workflowType: 'requirement-room',
      subjectType: 'specification',
      subjectId: 'spec_control',
    });
    expect(res.status).toBeLessThan(300);
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
    // `LoopObjectRef` is `{ workflowType, objectId }` — the stage is not on it,
    // and asserting a field the contract does not carry would pass only by
    // `toMatchObject`'s tolerance for absent keys.
    expect(res.body).toMatchObject({ workflowType: 'requirement-room' });
    expect(String(res.body.objectId).length).toBeGreaterThan(0);

    // It starts at `Event`, read from the loop's own projection rather than
    // re-derived here (`FR-RQR-074`).
    const progress = await authed('get', `/loop/objects/${String(res.body.objectId)}/progress`);
    expect(progress.status).toBeLessThan(300);
    const event = (progress.body as { stage: string; omitted: boolean }[]).find(
      (row) => row.stage === 'Event',
    );
    expect(event, 'the projection does not name Event').toBeDefined();
    expect(event?.omitted).toBe(false);
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

suite('T1166 · POST /rooms/requirement — one call opens a Room and takes first intent', () => {
  it('returns the new Room and its first candidates', async () => {
    const res = await authed('post', '/rooms/requirement').send({
      projectId: PROJECT,
      text: 'Approvers shall be notified within one business day of a submission.',
      sourceRef: 'kickoff-notes',
    });
    expect(res.status).toBeLessThan(300);
    expect(String(res.body.roomObjectId).length).toBeGreaterThan(0);
  });

  it('the Room it names is a real, declared loop object', async () => {
    // The half a caller cannot check for itself: an id that resolves to nothing
    // would satisfy the assertion above.
    const opened = await authed('post', '/rooms/requirement').send({
      projectId: PROJECT,
      text: 'Every decision shall record its rationale.',
    });
    const progress = await authed(
      'get',
      `/loop/objects/${String(opened.body.roomObjectId)}/progress`,
    );
    expect(progress.status).toBeLessThan(300);
    expect(Array.isArray(progress.body)).toBe(true);
  });

  it('takes the workspace from the session, not the body', async () => {
    const res = await authed('post', '/rooms/requirement').send({
      workspaceId: 'ws_somewhere_else',
      projectId: PROJECT,
      text: 'A body naming its own tenant must not be believed.',
    });
    expect(res.status).toBeLessThan(300);
    // Readable by this session — so it landed in this session's workspace.
    const progress = await authed(
      'get',
      `/loop/objects/${String(res.body.roomObjectId)}/progress`,
    );
    expect(progress.status).toBeLessThan(300);
  });

  it('refuses empty intent', async () => {
    const res = await authed('post', '/rooms/requirement').send({
      projectId: PROJECT,
      text: '   ',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('leaves NO orphan Room when the intent is refused', async () => {
    // The rule this endpoint exists to keep. Declaring the object and then
    // failing to take intent would leave a Room that exists, contains nothing,
    // and cannot be acted on or deleted — a state a user can neither use nor
    // clear. The store has no delete, so the only safe order is: refuse first.
    const watch = await watchDeclare();
    try {
      const refused = await authed('post', '/rooms/requirement').send({
        projectId: PROJECT,
        text: '',
      });
      expect(refused.status).toBeGreaterThanOrEqual(400);
      expect(watch.calls(), 'a refused open declared a Room anyway').toBe(0);
    } finally {
      watch.restore();
    }
  });

  it('refuses an unauthenticated caller before declaring anything', async () => {
    const watch = await watchDeclare();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${PREFIX}/rooms/requirement`)
        .send({ projectId: PROJECT, text: 'Anyone at all.' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(watch.calls(), 'an unauthenticated open declared a Room').toBe(0);
    } finally {
      watch.restore();
    }
  });

  it('the watch can see a declaration — or the two above prove nothing', async () => {
    // Anti-vacuity. A spy that never records would make both assertions above
    // pass against an endpoint that declared a Room on every call.
    const watch = await watchDeclare();
    try {
      const ok = await authed('post', '/rooms/requirement').send({
        projectId: PROJECT,
        text: 'A valid piece of intent.',
      });
      expect(ok.status).toBeLessThan(300);
      expect(watch.calls()).toBe(1);
    } finally {
      watch.restore();
    }
  });
});
