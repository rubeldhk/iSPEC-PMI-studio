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
/** A second defect, already classified a change request, for the Phase 5 routes. */
const TRANSFERABLE = 'df_route_2';

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
      // `BaselineReader` is unbound in this deployment, so no classification can
      // be produced through the API. Seeding one directly is the only way to
      // reach the Phase 5 routes at all — and a route nobody can reach is the
      // defect this repository has now recorded seven times.
      await db.query(
        `INSERT INTO "defect_records"
           ("id","workspaceId","projectId","epicId","state","origin","contestedArtifactRef",
            "contestedArtifactVersion","severity","reportedBy")
         VALUES ($1,$2,$3,'EPIC-999','triaged','manual-report','b_route_1','v3','high',$4)`,
        [TRANSFERABLE, ids.workspaceId, PROJECT, ids.userId],
      );
      await db.query(
        `INSERT INTO "defect_classifications"
           ("id","workspaceId","defectId","outcome","destination","approvedBehaviourRef",
            "absenceRecorded","classifiedBy","classifiedByKind","rationale")
         VALUES ('cl_route_1',$1,$2,'change-request','change-room','rv_1',false,$3,'human',
                 'the system does what the baseline says; the reporter wants it changed')`,
        [ids.workspaceId, TRANSFERABLE, ids.userId],
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

/**
 * `T998p`, `T998r` — the Phase 5 routes, mounted.
 *
 * `BR-0057` is the reason this Room is not a bug tracker, and the transfer is
 * the whole of it. A transfer offered by a service nothing calls is the rule
 * described rather than enforced.
 */
suite('T998p · POST /rooms/defect/:id/transfer', () => {
  it('refuses with no session', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${TRANSFERABLE}/transfer`)
      .send({ offeredReason: 'x' });
    expect(res.status).toBe(401);
  });

  it('refuses an offer that does not say why', async () => {
    // `UX-0034`. An unexplained transfer button is a reclassification nobody
    // decided, and the person it is done to is usually the reporter.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${TRANSFERABLE}/transfer`)
      .set('Cookie', harness.cookie)
      .send({ offeredReason: '   ' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/UX-0034|FR-DFR-072/);
  });

  it('records the offer, with its reason', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${TRANSFERABLE}/transfer`)
      .set('Cookie', harness.cookie)
      .send({
        offeredReason: 'the baseline says one hour; you are asking for thirty minutes',
        evidenceRefs: ['ev_1'],
      });

    expect(res.status).toBeLessThan(300);
    expect(res.body.state).toBe('offered');
    expect(res.body.destination).toBe('change-room');
  });

  it('and the offer is in PostgreSQL, not in a process', async () => {
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query(
        'SELECT "state","offeredReason","targetRef" FROM "defect_routings" WHERE "defectId" = $1',
        [TRANSFERABLE],
      );
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0].offeredReason).toMatch(/thirty minutes/);
      // `SC-DFR-010` — an offer is a question, not a delivery.
      expect(rows.rows[0].targetRef).toBeNull();
    } finally {
      await db.end();
    }
  });

  it('and refuses to accept it while EPIC-034 is unbound', async () => {
    // Nothing is recorded as routed on the strength of having tried.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${TRANSFERABLE}/transfer/accept`)
      .set('Cookie', harness.cookie)
      .send({
        projectId: PROJECT,
        roomObjectId: 'ro_1',
        targetBaselineId: 'b_route_1',
        targetBaselineVersion: 2,
        requestedOutcome: 'notify within thirty minutes',
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/EPIC-034/);
  });

  it('while the defect stays here, not marked routed', async () => {
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query('SELECT "state" FROM "defect_records" WHERE "id" = $1', [
        TRANSFERABLE,
      ]);
      expect(rows.rows[0]?.state).toBe('triaged');
    } finally {
      await db.end();
    }
  });
});

suite('T998r · decline, return and gap routing', () => {
  it('a decline is refused with no reason, and accepted with one', async () => {
    // `FR-DFR-073` — both halves retained. The database CHECK says the same
    // thing; this is the route a person actually uses.
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    let routingId = '';
    try {
      const rows = await db.query('SELECT "id" FROM "defect_routings" WHERE "defectId" = $1', [
        TRANSFERABLE,
      ]);
      routingId = String(rows.rows[0]?.id ?? '');
    } finally {
      await db.end();
    }

    const bare = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${TRANSFERABLE}/transfer/decline`)
      .set('Cookie', harness.cookie)
      .send({ routingId, declinedReason: '  ' });
    expect(bare.status).toBe(400);

    const answered = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${TRANSFERABLE}/transfer/decline`)
      .set('Cookie', harness.cookie)
      .send({ routingId, declinedReason: 'the regulator requires the one-hour window' });
    expect(answered.status).toBeLessThan(300);
    expect(answered.body.state).toBe('declined');
    // The offer survives the decline.
    expect(answered.body.offeredReason).toMatch(/thirty minutes/);
  });

  it('transfer-return refuses with no session', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${TRANSFERABLE}/transfer-return`)
      .send({ routingId: 'x', refusalDetail: 'y' });
    expect(res.status).toBe(401);
  });

  it('and answers 404 for a routing that does not exist', async () => {
    // Reachability with a real answer: the route is mounted and reached the
    // service, which found nothing to return.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${TRANSFERABLE}/transfer-return`)
      .set('Cookie', harness.cookie)
      .send({ routingId: 'rt_nope', refusalDetail: 'the Change Room refused' });
    expect(res.status).toBe(404);
  });

  it('route-gap refuses a defect that is not a gap', async () => {
    // `FR-DFR-076` — this one is a change request, and a gap is the outcome
    // with no approved baseline to change.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${TRANSFERABLE}/route-gap`)
      .set('Cookie', harness.cookie)
      .send({ projectId: PROJECT, roomObjectId: 'ro_1', text: 'x' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/change-request|requirement gap/i);
  });
});

/**
 * `T998v` — the evidence-check routes, mounted.
 *
 * `ADR-0016`'s failure mode is closed by a service that depends on nothing
 * external, so unlike most of this Room these routes work end to end. A check
 * nobody can raise or answer would leave the guarantee described rather than
 * offered.
 */
/**
 * `T999a`, `T999c` — the front door, through the real routes.
 *
 * Intake is the one path in this Room that depends on nothing external, so it
 * works end to end rather than refusing. That makes it the only place a route
 * test can prove the whole journey — report, held, linked — against PostgreSQL.
 */
suite('T999a · POST /rooms/defect/reports', () => {
  it('refuses with no session', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/reports`)
      .send({ projectId: PROJECT, origin: 'monitoring' });
    expect(res.status).toBe(401);
  });

  it('accepts a linked report and writes it to PostgreSQL', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/reports`)
      .set('Cookie', harness.cookie)
      .send({
        projectId: PROJECT,
        epicId: 'EPIC-035',
        origin: 'production-incident',
        contestedArtifactRef: 'spec_route',
        contestedArtifactVersion: 'v2',
        severity: 'high',
      });

    expect(res.status).toBeLessThan(300);
    expect(res.body.heldFor).toBeNull();

    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query(
        'SELECT "origin","epicId","state","reportedBy" FROM "defect_records" WHERE "id" = $1',
        [res.body.defect.id],
      );
      expect(rows.rows[0].origin).toBe('production-incident');
      expect(rows.rows[0].epicId).toBe('EPIC-035');
      expect(rows.rows[0].state).toBe('triaged');
      // `FR-DFR-013` — the session says who filed it, never the body.
      expect(rows.rows[0].reportedBy).toBe(USER);

      // `FR-DFR-082` — the escape row exists from the moment the defect does.
      const escape = await db.query(
        'SELECT "origin","escapePoint" FROM "defect_escape_records" WHERE "defectId" = $1',
        [res.body.defect.id],
      );
      expect(escape.rowCount).toBe(1);
      expect(escape.rows[0].origin).toBe('production-incident');
      expect(escape.rows[0].escapePoint).toBeNull();
    } finally {
      await db.end();
    }
  });

  it('cannot be filed in another person’s name', async () => {
    // `strip` removes it before the service ever sees it, so this is not a
    // rejection — it is the field not existing.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/reports`)
      .set('Cookie', harness.cookie)
      .send({
        projectId: PROJECT,
        epicId: 'EPIC-035',
        origin: 'manual-report',
        contestedArtifactRef: 'spec_route',
        contestedArtifactVersion: 'v2',
        severity: 'low',
        reportedBy: 'somebody-else',
      });

    expect(res.status).toBeLessThan(300);
    expect(res.body.defect.reportedBy).toBe(USER);
  });

  it('refuses an origin nobody declared', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/reports`)
      .set('Cookie', harness.cookie)
      .send({
        projectId: PROJECT,
        epicId: 'EPIC-035',
        origin: 'slack-thread',
        contestedArtifactRef: 'spec_route',
        contestedArtifactVersion: 'v2',
        severity: 'low',
      });
    expect(res.status).toBe(400);
  });

  it('holds an unlinkable report, names why, and lists it', async () => {
    // `FR-DFR-012`, `SC-DFR-006` — the whole journey in one request each.
    const filed = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/reports`)
      .set('Cookie', harness.cookie)
      .send({
        projectId: PROJECT,
        origin: 'monitoring',
        contestedArtifactRef: 'spec_route',
        contestedArtifactVersion: 'v2',
        severity: 'medium',
      });

    expect(filed.status).toBeLessThan(300);
    expect(filed.body.defect.state).toBe('held-for-triage');
    expect(filed.body.heldFor).toMatch(/epic/i);

    const held = await request(app.getHttpServer())
      .get(`/${PREFIX}/rooms/defect/held`)
      .set('Cookie', harness.cookie);
    expect(held.status).toBe(200);
    expect(held.body.map((row: { id: string }) => row.id)).toContain(filed.body.defect.id);

    // `held` is not read as an id by the `:id` route above it.
    expect(held.body).toBeInstanceOf(Array);

    const linked = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${filed.body.defect.id}/link-epic`)
      .set('Cookie', harness.cookie)
      .send({ epicId: 'EPIC-035' });
    expect(linked.status).toBeLessThan(300);

    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query(
        'SELECT "epicId","state" FROM "defect_records" WHERE "id" = $1',
        [filed.body.defect.id],
      );
      expect(rows.rows[0].epicId).toBe('EPIC-035');
      expect(rows.rows[0].state).toBe('triaged');
    } finally {
      await db.end();
    }

    const after = await request(app.getHttpServer())
      .get(`/${PREFIX}/rooms/defect/held`)
      .set('Cookie', harness.cookie);
    expect(after.body.map((row: { id: string }) => row.id)).not.toContain(filed.body.defect.id);
  });

  it('and refuses to link a blank Epic', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/link-epic`)
      .set('Cookie', harness.cookie)
      .send({ epicId: '   ' });
    expect(res.status).toBe(400);
  });
});

suite('T998v · POST /rooms/defect/:id/evidence-check', () => {
  it('raise refuses with no session', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/evidence-check/raise`)
      .send({ testId: 'x', outcome: 'pass' });
    expect(res.status).toBe(401);
  });

  it('and refuses to raise one for a failing run', async () => {
    // A failing reproduction test is the ordinary state: the defect
    // reproduces. There is nothing to explain.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/evidence-check/raise`)
      .set('Cookie', harness.cookie)
      .send({ testId: 'dt_x', outcome: 'fail' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/FR-DFR-044/);
  });

  it('raises one for a passing run, offering three paths and choosing none', async () => {
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    let testId = '';
    try {
      const rows = await db.query('SELECT "id" FROM "defect_tests" WHERE "defectId" = $1', [
        DEFECT,
      ]);
      testId = String(rows.rows[0]?.id ?? '');
    } finally {
      await db.end();
    }

    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/evidence-check/raise`)
      .set('Cookie', harness.cookie)
      .send({ testId, outcome: 'pass', evidenceRef: 'ev_run_1' });

    expect(res.status).toBeLessThan(300);
    expect(res.body.paths).toHaveLength(3);

    const db2 = new Client({ connectionString: harness.databaseUrl });
    await db2.connect();
    try {
      // `FR-DFR-044` — raising is a question. Nothing has been answered.
      const rows = await db2.query(
        'SELECT * FROM "defect_evidence_checks" WHERE "defectId" = $1',
        [DEFECT],
      );
      expect(rows.rowCount).toBe(0);
    } finally {
      await db2.end();
    }
  });

  it('refuses a path nobody declared', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/evidence-check`)
      .set('Cookie', harness.cookie)
      .send({ testId: 'dt_x', path: 'close-it', reason: 'because' });
    expect(res.status).toBe(400);
  });

  it('and records the one a person chose, in PostgreSQL', async () => {
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    let testId = '';
    try {
      const rows = await db.query('SELECT "id" FROM "defect_tests" WHERE "defectId" = $1', [
        DEFECT,
      ]);
      testId = String(rows.rows[0]?.id ?? '');
    } finally {
      await db.end();
    }

    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/evidence-check`)
      .set('Cookie', harness.cookie)
      .send({
        testId,
        path: 'investigate-further',
        reason: 'the run passed against staging and the report was against production',
      });
    expect(res.status).toBeLessThan(300);
    // `SC-DFR-004` — no classification was written by choosing a path.
    expect(res.body.next).toBeNull();

    const db2 = new Client({ connectionString: harness.databaseUrl });
    await db2.connect();
    try {
      const checks = await db2.query(
        'SELECT "path","resolvedBy" FROM "defect_evidence_checks" WHERE "defectId" = $1',
        [DEFECT],
      );
      expect(checks.rowCount).toBe(1);
      expect(checks.rows[0].path).toBe('investigate');
      expect(checks.rows[0].resolvedBy).toBe(USER);

      const classifications = await db2.query(
        'SELECT * FROM "defect_classifications" WHERE "defectId" = $1',
        [DEFECT],
      );
      expect(classifications.rowCount).toBe(0);
    } finally {
      await db2.end();
    }
  });

  it('and choosing reclassify hands back the route, still writing no classification', async () => {
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    let testId = '';
    try {
      const rows = await db.query('SELECT "id" FROM "defect_tests" WHERE "defectId" = $1', [
        DEFECT,
      ]);
      testId = String(rows.rows[0]?.id ?? '');
    } finally {
      await db.end();
    }

    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/defect/${DEFECT}/evidence-check`)
      .set('Cookie', harness.cookie)
      .send({ testId, path: 'reclassify', reason: 'the behaviour is what the baseline asks for' });

    expect(res.status).toBeLessThan(300);
    expect(res.body.next).toMatch(/reevaluate/);

    const db2 = new Client({ connectionString: harness.databaseUrl });
    await db2.connect();
    try {
      const rows = await db2.query('SELECT * FROM "defect_classifications" WHERE "defectId" = $1', [
        DEFECT,
      ]);
      expect(rows.rowCount).toBe(0);
    } finally {
      await db2.end();
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
