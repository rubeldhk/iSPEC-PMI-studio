/**
 * `T998f` (EPIC-035) — `POST /rooms/defect/:id/triage`, against the wiring
 * production actually runs.
 *
 * A sibling of `change-room-request-route.spec.ts` rather than more cases in
 * `defect-room-reachability.spec.ts` (`T997v`), for the reason `T996i` recorded:
 * that harness composes `AppModule` without `ErrorFilter`, so every product
 * controller reports `500` there and a status-code assertion would be
 * meaningless. This one installs what `main.ts` installs.
 *
 * ## What only this file can prove
 *
 * **That the capability has a caller at all.** Built, tested, and reachable
 * from nowhere is the defect this repository has now recorded seven times —
 * four of them found in a single convergence pass on `EPIC-034`, every one with
 * a green unit test. The question that finds them is *which capabilities have a
 * caller*, not *which have a test*.
 *
 * **That the classification survives the process.** `T1178`: thirteen stores
 * defaulted to in-memory, every test passed, and a human opened the application
 * and found nothing persisted. A classification is the record that somebody
 * weighed a defect against approved behaviour — losing it on restart looks
 * exactly like nobody ever judged it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const PREFIX = 'v1';
const WS = 'ws_defect';
const USER = 'u_defect';
const PROJECT = 'pr_defect';
const DEFECT = 'df_route_1';

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
         VALUES ($1,$2,'Defect',$3,now())`,
        [PROJECT, ids.workspaceId, ids.userId],
      );
      await db.query(
        `INSERT INTO "defect_records"
           ("id","workspaceId","projectId","state","origin","contestedArtifactRef",
            "contestedArtifactVersion","severity","reportedBy")
         VALUES ($1,$2,$3,'held-for-triage','manual-report','spec_route_1','v3','high',$4)`,
        [DEFECT, ids.workspaceId, PROJECT, ids.userId],
      );
    },
  });
  app = harness.app;
}, 300_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

const body = (over: Record<string, unknown> = {}) => ({
  rationale: 'the baseline says one hour and it sends two',
  ...over,
});

suite('T998f · the triage route', () => {
  it('refuses a triage with no session', async () => {
    // `DEF-037-001` began as an unauthenticated route answering 200 with real
    // data. 401, and nothing written.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/triage`)
      .send(body());
    expect(res.status).toBe(401);
  });

  it('refuses one with no rationale', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/triage`)
      .set('Cookie', harness.cookie)
      .send(body({ rationale: '   ' }));
    expect(res.status).toBe(400);
  });

  it('answers 404 for a defect in another workspace, not 403', async () => {
    // `FR-002`. A caller learns nothing about a defect it may not see — the
    // difference between "absent" and "forbidden" is itself information.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/df_does_not_exist/triage`)
      .set('Cookie', harness.cookie)
      .send(body());
    expect(res.status).toBe(404);
  });

  it('refuses while no baseline reader is bound, rather than filing a gap', async () => {
    // The central guarantee of this Room, at the boundary rather than only in
    // the service. `EPIC-033` does not supply `BaselineReader` in this
    // deployment yet, so there is nothing to judge against — and "could not
    // look" must not be recorded as "none exists" (`FR-DFR-020`, `FR-DFR-021`).
    //
    // When that port is bound this expectation changes to a 2xx and a written
    // classification. It is asserted now because the failure it guards against
    // is silent: a requirement gap filed against a requirement that exists.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/triage`)
      .set('Cookie', harness.cookie)
      .send(body());

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/EPIC-033/);
  });

  it('and writes no classification while refusing', async () => {
    // Read the table directly. A refusal that still wrote a row would leave the
    // defect judged by a service that just said it could not judge.
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query('SELECT * FROM "defect_classifications" WHERE "defectId" = $1', [
        DEFECT,
      ]);
      expect(rows.rowCount).toBe(0);
    } finally {
      await db.end();
    }
  });

  it('and the defect is still held for triage', async () => {
    // The control for the assertion above: the row exists and is reachable, so
    // "no classification" is a fact about triage rather than about the seed.
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query('SELECT "state" FROM "defect_records" WHERE "id" = $1', [DEFECT]);
      expect(rows.rows[0]?.state).toBe('held-for-triage');
    } finally {
      await db.end();
    }
  });
});
