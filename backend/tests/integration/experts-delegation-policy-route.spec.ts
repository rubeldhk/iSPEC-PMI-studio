/**
 * `T1986` (EPIC-047) — the delegation policy through its real routes.
 *
 * `FR-EXP-009`, `FR-EXP-033`, analysis finding C1. Without a policy no
 * delegation is ever permitted, so the policy must be settable through the
 * product — by an author, validated whole, recorded with who and when.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const PREFIX = 'v1';
const WS = 'ws_policy';
const AUTHOR = 'u_policy';
const READER = 'u_policy_reader';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;
let readerCookie = '';

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: AUTHOR,
    async seed(db, ids) {
      await db.query(
        `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
         VALUES ($1,$2,$3,'Reader','unused',now())`,
        [READER, ids.workspaceId, `${READER}@example.test`],
      );
      await db.query(
        `INSERT INTO "access_grants" ("id","workspaceId","artifactType","artifactId","userId","level","grantedById")
         VALUES ('g_pa',$1,'expert-registry',$1,$2,'edit',$2), ('g_pr',$1,'expert-registry',$1,$3,'read',$2)`,
        [ids.workspaceId, ids.userId, READER],
      );
    },
  });
  app = harness.app;
  const { SessionService } = await import('../../src/modules/auth/sessions.js');
  const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
  const session = app.get(SessionService, { strict: false }).create({
    userId: READER, workspaceId: WS, email: `${READER}@example.test`, displayName: 'Reader',
  });
  readerCookie = `${SESSION_COOKIE}=${session.token}`;
}, 600_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

const api = () => request(app.getHttpServer());
const policy = {
  maxDepth: 2,
  maxFanOut: 3,
  allowedPairs: [{ from: 'test-engineer', to: 'reviewer' }],
  maxUnattendedBand: 'medium',
};

suite('T1986 · GET/PUT /experts/delegation-policy', () => {
  it('is 404 until a policy is set — no policy, no delegation', async () => {
    expect((await api().get(`/${PREFIX}/experts/delegation-policy`).set('Cookie', harness.cookie)).status).toBe(404);
  });

  it('PUT replaces it whole and records who and when', async () => {
    const put = await api().put(`/${PREFIX}/experts/delegation-policy`).set('Cookie', harness.cookie).send(policy);
    expect(put.status).toBe(200);
    const got = await api().get(`/${PREFIX}/experts/delegation-policy`).set('Cookie', harness.cookie);
    expect(got.body).toMatchObject({ ...policy, workspaceId: WS, updatedBy: AUTHOR });
    expect(typeof got.body.updatedAt).toBe('string');
    const again = await api()
      .put(`/${PREFIX}/experts/delegation-policy`)
      .set('Cookie', harness.cookie)
      .send({ ...policy, maxDepth: 1, allowedPairs: [] });
    expect([again.status, again.body.maxDepth, again.body.allowedPairs]).toEqual([200, 1, []]);
  });

  it('rejects depth or fan-out below 1, and an unknown band', async () => {
    for (const bad of [{ maxDepth: 0 }, { maxFanOut: 0 }, { maxUnattendedBand: 'extreme' }]) {
      const res = await api().put(`/${PREFIX}/experts/delegation-policy`).set('Cookie', harness.cookie).send({ ...policy, ...bad });
      expect(res.status).toBe(400);
    }
  });

  it('a reader reads the policy but cannot change it (FR-EXP-009)', async () => {
    expect((await api().get(`/${PREFIX}/experts/delegation-policy`).set('Cookie', readerCookie)).status).toBe(200);
    expect((await api().put(`/${PREFIX}/experts/delegation-policy`).set('Cookie', readerCookie).send(policy)).status).toBe(403);
  });
});
