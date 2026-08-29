/**
 * `T1183`, `T1184` (EPIC-033 Phase 10) — the four routes the journey needs.
 *
 * The owner opened the application, reached a Room, and found nothing to do in
 * it. Part of that is the screen (`T1185`–`T1188`); part is that four
 * capabilities the backend has owned since Phase 3 were never exposed:
 * **listing candidates**, **setting acceptance criteria**, **listing
 * clarifications**, and **answering one**.
 *
 * Each exists on `RequirementRoomStore` and is exercised by unit tests. None had
 * a route, so no screen could reach them. That is the same defect class as
 * Phase 9's — a capability built, tested, and reachable from nowhere.
 *
 * Every route here takes its workspace from the **session** (`T1148`), never the
 * body, and refuses a Room in another workspace by the opaque 404 that
 * `FR-ACC-024` requires — a caller learns nothing about what it may not see.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const PREFIX = 'v1';
const WS = 'ws_journey';
const USER = 'u_journey';
const PROJECT = 'pr_journey';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;
let roomId = '';
let candidateId = '';

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: USER,
    async seed(db, ids) {
      await db.query(
        `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
         VALUES ($1,$2,'Journey',$3,now())`,
        [PROJECT, ids.workspaceId, ids.userId],
      );
    },
  });
  app = harness.app;

  const opened = await request(app.getHttpServer())
    .post(`/${PREFIX}/rooms/requirement`)
    .set('Cookie', harness.cookie)
    .send({
      projectId: PROJECT,
      text: 'Approvers shall be notified within one business day of a submission.',
      sourceRef: 'journey-notes',
    });
  roomId = String(opened.body.roomObjectId);
  candidateId = String(opened.body.candidates?.[0]?.id ?? '');
}, 300_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

const authed = (method: 'post' | 'get', path: string) =>
  request(app.getHttpServer())[method](`/${PREFIX}${path}`).set('Cookie', harness.cookie);

suite('T1183 · GET candidates', () => {
  it('lists what intake extracted, with the epistemic label intact', async () => {
    const res = await authed('get', `/rooms/requirement/${roomId}/candidates`);
    expect(res.status).toBeLessThan(300);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // `FR-RQR-011` — every element carries exactly one label, and the screen
    // renders it. A candidate arriving unlabelled is unpresentable.
    expect(res.body[0].epistemic).toBeTruthy();
    expect(res.body[0].normalizedText).toContain('business day');
  });

  it('refuses without a session', async () => {
    const res = await request(app.getHttpServer()).get(
      `/${PREFIX}/rooms/requirement/${roomId}/candidates`,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('does not copy the register — a candidate carries a reference', async () => {
    // `FR-RQR-002`, `D-33`. The one boundary the tokens file calls most likely
    // to be crossed, asserted on the wire rather than in the store.
    const res = await authed('get', `/rooms/requirement/${roomId}/candidates`);
    for (const key of ['description', 'priority', 'type', 'title']) {
      expect(Object.keys(res.body[0]), `a candidate carries "${key}"`).not.toContain(key);
    }
  });
});

suite('T1183 · acceptance criteria', () => {
  it('sets measurable criteria on a candidate', async () => {
    const res = await authed(
      'post',
      `/rooms/requirement/${roomId}/candidates/${candidateId}/criteria`,
    ).send({
      acceptanceCriteria: ['A notification is delivered within 24 hours of submission.'],
      intendedForImplementation: true,
    });
    expect(res.status).toBeLessThan(300);
    expect(res.body.acceptanceCriteria).toHaveLength(1);
  });

  it('the change is readable back through the list', async () => {
    const res = await authed('get', `/rooms/requirement/${roomId}/candidates`);
    const row = (res.body as { id: string; acceptanceCriteria: string[] | null }[]).find(
      (c) => c.id === candidateId,
    );
    expect(row?.acceptanceCriteria).toHaveLength(1);
  });

  it('clearing criteria is allowed and blocks baseline again', async () => {
    // `FR-RQR-030` — null and `[]` are the same state and both block. The route
    // must accept the clearing rather than treating it as a malformed request.
    const cleared = await authed(
      'post',
      `/rooms/requirement/${roomId}/candidates/${candidateId}/criteria`,
    ).send({ acceptanceCriteria: null, intendedForImplementation: true });
    expect(cleared.status).toBeLessThan(300);
    expect(cleared.body.acceptanceCriteria).toBeNull();

    // Put it back — later assertions and the baseline gate depend on it.
    await authed('post', `/rooms/requirement/${roomId}/candidates/${candidateId}/criteria`).send({
      acceptanceCriteria: ['A notification is delivered within 24 hours of submission.'],
      intendedForImplementation: true,
    });
  });

  it('refuses a candidate in another Room', async () => {
    const other = await authed('post', '/rooms/requirement').send({
      projectId: PROJECT,
      text: 'A different piece of intent entirely.',
    });
    const res = await authed(
      'post',
      `/rooms/requirement/${String(other.body.roomObjectId)}/candidates/${candidateId}/criteria`,
    ).send({ acceptanceCriteria: ['x'], intendedForImplementation: true });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

suite('T1183 · clarifications', () => {
  let clarificationId = '';

  it('lists the questions raised for a Room', async () => {
    await authed('post', `/rooms/requirement/${roomId}/clarifications`).send({
      questions: [{ question: 'What counts as a business day?', blocksBaseline: true }],
      askedBy: USER,
    });

    const res = await authed('get', `/rooms/requirement/${roomId}/clarifications`);
    expect(res.status).toBeLessThan(300);
    expect(res.body.length).toBeGreaterThan(0);
    clarificationId = String(res.body[0].id);
    expect(res.body[0].answer).toBeNull();
  });

  it('answers one in place, and the answer is retained', async () => {
    // `FR-RQR-012` answerable in place; `FR-RQR-013` the answer is retained as
    // part of the record rather than discarded once resolved.
    const res = await authed(
      'post',
      `/rooms/requirement/${roomId}/clarifications/${clarificationId}/answer`,
    ).send({ answer: 'Monday to Friday, excluding public holidays.' });
    expect(res.status).toBeLessThan(300);
    expect(res.body.answer).toContain('Monday to Friday');

    const list = await authed('get', `/rooms/requirement/${roomId}/clarifications`);
    const row = (list.body as { id: string; answer: string | null; answeredBy: string }[]).find(
      (c) => c.id === clarificationId,
    );
    expect(row?.answer).toBeTruthy();
    // The answerer is the session's user, not a name the body supplied.
    expect(row?.answeredBy).toBe(USER);
  });

  it('refuses an empty answer', async () => {
    const res = await authed(
      'post',
      `/rooms/requirement/${roomId}/clarifications/${clarificationId}/answer`,
    ).send({ answer: '   ' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
