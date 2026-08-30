/**
 * `T996i` (EPIC-034) — `POST /rooms/change/requests`, against the wiring
 * production actually runs.
 *
 * Two things are proven here that no unit test can prove, and that the bare
 * composed app in `change-room-reachability.spec.ts` cannot either:
 *
 * **The status codes are the real ones.** That harness composes `AppModule`
 * without `ErrorFilter`, so every product controller reports 500 there. This
 * one installs what `main.ts` installs.
 *
 * **The change request survives the process.** `T1178` is the reason: thirteen
 * stores defaulted to in-memory, every test passed, and a human opened the
 * application and found that nothing persisted. Here the row is written through
 * the endpoint and read back through a *different* request, so an in-memory
 * store bound by mistake would fail this file rather than a later human.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const PREFIX = 'v1';
const WS = 'ws_change';
const USER = 'u_change';
const PROJECT = 'pr_change';
const BASELINE = 'b_change_1';

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
         VALUES ($1,$2,'Change',$3,now())`,
        [PROJECT, ids.workspaceId, ids.userId],
      );
    },
  });
  app = harness.app;
}, 300_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

const body = (over: Record<string, unknown> = {}) => ({
  projectId: PROJECT,
  roomObjectId: 'ro_change_1',
  targetBaselineId: BASELINE,
  targetBaselineVersion: 2,
  requestedOutcome: 'require notification within one hour',
  reason: 'the regulator shortened the window',
  ...over,
});

suite('T996i · the route RULE-02 leads to', () => {
  it('refuses a request with no session', async () => {
    // `DEF-037-001` began as an unauthenticated GET that returned 200 with real
    // data. 401, and nothing written.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/change/requests`)
      .send(body());
    expect(res.status).toBe(401);
  });

  it('records one for a signed-in caller', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/change/requests`)
      .set('Cookie', harness.cookie)
      .send(body());

    expect(res.status).toBeLessThan(300);
    expect(res.body.targetBaselineId).toBe(BASELINE);
    expect(res.body.targetBaselineVersion).toBe(2);
    expect(res.body.state).toBe('open');
  });

  it('takes the requester and the workspace from the session, not the body', async () => {
    // `T1148`, `DEF-033-001`. A body that looks authoritative because nothing
    // visibly takes it away is how a caller writes into a workspace it cannot
    // see.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/change/requests`)
      .set('Cookie', harness.cookie)
      .send(body({ requester: 'u_someone_else', workspaceId: 'ws_elsewhere' }));

    expect(res.status).toBeLessThan(300);
    expect(res.body.requester).toBe(USER);
    expect(res.body.workspaceId).toBe(WS);
  });

  it('refuses one with no baseline', async () => {
    // `FR-CHR-010` at the boundary, not only in the service.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/change/requests`)
      .set('Cookie', harness.cookie)
      .send(body({ targetBaselineId: undefined, targetBaselineVersion: undefined }));

    expect(res.status).toBe(400);
  });
});

suite('T996i · and it is visible afterwards', () => {
  it('reads back what a previous request wrote', async () => {
    // The persistence proof. A different HTTP request, so nothing in the
    // service's own memory can satisfy it.
    const res = await request(app.getHttpServer())
      .get(`/${PREFIX}/rooms/change/requests`)
      .query({ baselineId: BASELINE })
      .set('Cookie', harness.cookie);

    expect(res.status).toBeLessThan(300);
    expect(Array.isArray(res.body)).toBe(true);
    // Three were raised above; the two that succeeded are open against this
    // baseline. `SC-CHR-001` — visible as traceable change control.
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.every((row: { requester: string }) => row.requester === USER)).toBe(true);
  });

  it('and the row is in PostgreSQL, not in a process', async () => {
    // The assertion the round-trip above does NOT make. Both requests hit the
    // same running application, so a store bound in-memory by mistake would
    // satisfy it perfectly — and that is precisely the mistake `T1178` found,
    // after every test passed and a human restarted the application.
    //
    // Reading the table directly is the only version of this proof that an
    // in-memory store cannot pass.
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query(
        'SELECT "requester", "state", "targetBaselineVersion" FROM "change_requests" WHERE "workspaceId" = $1 AND "targetBaselineId" = $2',
        [WS, BASELINE],
      );
      expect(rows.rowCount).toBeGreaterThanOrEqual(2);
      expect(rows.rows[0]?.requester).toBe(USER);
      expect(rows.rows[0]?.state).toBe('open');
    } finally {
      await db.end();
    }
  });

  it('requires the baseline to be named', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${PREFIX}/rooms/change/requests`)
      .set('Cookie', harness.cookie);
    expect(res.status).toBe(400);
  });

  it('refuses to list without a session', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${PREFIX}/rooms/change/requests`)
      .query({ baselineId: BASELINE });
    expect(res.status).toBe(401);
  });
});
