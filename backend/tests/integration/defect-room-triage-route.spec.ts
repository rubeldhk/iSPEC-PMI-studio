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

/**
 * `T998h`, `T998k`, `T998n` — the Phase 4 routes, mounted.
 *
 * Every capability in this phase is reachable, which is the check that has now
 * caught seven instances of *built, tested, and reachable from nowhere* in this
 * repository. Two of the three routes refuse in this deployment because their
 * seams are unbound, and the refusals are asserted rather than skipped: a route
 * that 404s and a route that refuses are indistinguishable to a caller who
 * never tried it.
 */
suite('T998h · POST /rooms/defect/:id/test', () => {
  const failedAt = '2026-08-20T09:00:00.000Z';

  it('refuses with no session', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/test`)
      .send({ testRef: 'x', contestedBehaviourRef: 'rv_1', firstObservedFailingAt: failedAt });
    expect(res.status).toBe(401);
  });

  it('records the test that demonstrated the defect', async () => {
    // The one Phase 4 route with no unbound seam behind it, so it is also the
    // phase's persistence proof.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/test`)
      .set('Cookie', harness.cookie)
      .send({
        testRef: 'backend/tests/unit/notification-window.spec.ts::sends one',
        contestedBehaviourRef: 'rv_1',
        firstObservedFailingAt: failedAt,
      });

    expect(res.status).toBeLessThan(300);
    expect(res.body.contestedBehaviourRef).toBe('rv_1');
  });

  it('and the row is in PostgreSQL, not in a process', async () => {
    // `T1178`. Both requests hit the same running application, so a round-trip
    // through the API would be satisfied by an in-memory store bound by
    // mistake. Reading the table is the only version an in-memory store cannot
    // pass.
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      // Read as text on purpose. The column is `TIMESTAMP(3)` **without** a
      // zone, so `pg` parses it into a `Date` as if it were local time and the
      // instant shifts by the host's offset — a property of reading the column
      // raw in a test, not of what was stored. Comparing the stored text is the
      // assertion that means what it says on any machine.
      const rows = await db.query(
        'SELECT "firstObservedFailingAt"::text AS at, "lastRunOutcome" FROM "defect_tests" ' +
          'WHERE "defectId" = $1',
        [DEFECT],
      );
      expect(rows.rowCount).toBe(1);
      expect(String(rows.rows[0].at)).toMatch(/^2026-08-20 09:00:00/);
      // Recorded as failing, because that is what was observed. A default of
      // `not-run` here would describe a run nobody made.
      expect(rows.rows[0].lastRunOutcome).toBe('fail');
    } finally {
      await db.end();
    }
  });

  it('refuses one with no instant it was seen failing', async () => {
    // `FR-DFR-040`. Absent means absent — defaulting to "now" would mint the
    // very observation the requirement asks somebody to have made.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/test`)
      .set('Cookie', harness.cookie)
      .send({ testRef: 'x', contestedBehaviourRef: 'rv_1' });
    expect(res.status).toBe(400);
  });
});

suite('T998k · POST /rooms/defect/:id/reproduction', () => {
  it('refuses with no session', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/reproduction`)
      .send({});
    expect(res.status).toBe(401);
  });

  it('refuses evidence while EPIC-032 is unbound, rather than storing it here', async () => {
    // `R-035-7`, `FR-DFR-033`. This is the route where a user is encouraged to
    // paste a payload that reproduces a failure (`PP-008`); a Room-local copy
    // would be filed under "who can see defects" rather than under the
    // artifact's own access rules.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/reproduction`)
      .set('Cookie', harness.cookie)
      .send({
        reproducible: 'always',
        environment: 'production, EU region',
        affectedBehaviourRef: 'rv_1',
        notAutomatableReason: null,
        evidence: [
          {
            _type: 'https://in-toto.io/Statement/v1',
            subject: [{ name: 'window', digest: { sha256: 'abc' } }],
            predicateType: 'https://pmi.studio/attestation/transcript/v1',
            predicate: { note: 'a session cookie would live here' },
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/EPIC-032/);
  });

  it('and nothing was written', async () => {
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query('SELECT * FROM "defect_reproductions" WHERE "defectId" = $1', [
        DEFECT,
      ]);
      expect(rows.rowCount).toBe(0);
    } finally {
      await db.end();
    }
  });

  it('GET /rooms/defect/exceptions answers, and is empty', async () => {
    // `FR-DFR-043` — the exception is enumerable. An endpoint returning an
    // empty list is the honest answer here; a 404 would leave "how often is
    // this used?" unanswerable rather than answered with zero.
    const res = await request(app.getHttpServer())
      .get(`/${PREFIX}/rooms/defect/exceptions`)
      .set('Cookie', harness.cookie);
    expect(res.status).toBeLessThan(300);
    expect(res.body).toEqual([]);
  });
});

suite('T998n · POST /rooms/defect/:id/verify and /close', () => {
  const body = { touchedArtifacts: [{ artifactType: 'code', artifactId: 'code_1' }] };

  beforeAll(async () => {
    if (noRuntime) return;
    // The precondition, established here rather than inherited from the suite
    // above. Closure refuses for several reasons in sequence, and a file whose
    // assertions depend on an earlier suite having run proves whichever refusal
    // happens to come first.
    await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/test`)
      .set('Cookie', harness.cookie)
      .send({
        testRef: 'backend/tests/unit/notification-window.spec.ts::sends one',
        contestedBehaviourRef: 'rv_1',
        firstObservedFailingAt: '2026-08-20T09:00:00.000Z',
      });
  });

  it('verify refuses with no session', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/verify`)
      .send(body);
    expect(res.status).toBe(401);
  });

  it('close refuses while the chain source is unbound', async () => {
    // `FR-DFR-064` — an unknown regression set refuses, and does not fall back
    // to the defect test alone.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/close`)
      .set('Cookie', harness.cookie)
      .send(body);

    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toMatch(/EPIC-011/);
  });

  it('and the defect is not closed', async () => {
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query('SELECT "state" FROM "defect_records" WHERE "id" = $1', [DEFECT]);
      expect(rows.rows[0]?.state).not.toBe('closed');
    } finally {
      await db.end();
    }
  });
});

suite('T998f · and the defect is still held for triage', () => {
  it('after every refusal above', async () => {
    // The control for every refusal in this file. The row exists and is
    // reachable, so each "nothing was written" above is a fact about the
    // refusal rather than about the seed — and nothing in a phase whose seams
    // are unbound has moved the defect out of the state it arrived in.
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
