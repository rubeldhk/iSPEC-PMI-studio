/**
 * `T1244` (EPIC-038) — the assembly routes, through the composed application
 * against PostgreSQL.
 *
 * Constitution XI Tier 1. `T1224` proves the module is in the graph; this
 * proves the routes it contributes are reachable and behave as
 * [contracts/context-api.md](../../../specs/038-engineering-context/contracts/context-api.md)
 * says.
 *
 * ## Most of this asserts a refusal, and that is the honest state
 *
 * `EmbeddingPort` has **no owner anywhere in the programme** (`FR-CTX-013`), so
 * `POST /context/packages` answers `503` in every deployment until somebody
 * builds one. That is not a gap in this Epic — it is `R-038-1`'s finding, and
 * the route existing and refusing is what makes it visible rather than
 * theoretical.
 *
 * The refusal is asserted to **name the seam**, because a `503` saying nothing
 * is the same defect with a better number — `GovernanceSeamUnboundError`'s own
 * doc comment states the rule and this is where it is checked.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const PREFIX = 'v1';
const WS = 'ws_context';
const USER = 'u_context';
const PROJECT = 'pr_context';

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
         VALUES ($1,$2,'Context',$3,now())`,
        [PROJECT, ids.workspaceId, ids.userId],
      );
      // `FR-CTX-036` — configuration, seeded the way an operator would supply
      // it rather than created by the code under test.
      await db.query(
        `INSERT INTO "context_source_classes"
           ("id","workspaceId","sourceType","securityClassification","indexable")
         VALUES ('sc_req',$1,'requirement','internal',true),
                ('sc_inc',$1,'incident-note','restricted',false)`,
        [ids.workspaceId],
      );
    },
  });
  app = harness.app;
}, 600_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

suite('T1244 · POST /context/packages', () => {
  it('refuses with no session', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages`)
      .send({ projectId: PROJECT, objective: 'why does the booking notify twice' });
    expect(res.status).toBe(401);
  });

  it('refuses a blank objective before reaching any seam', async () => {
    // `FR-CTX-032`. A `400` rather than a `503`: the caller can fix this one,
    // and reporting an unbound seam would send them to chase somebody else's
    // Epic for their own mistake.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages`)
      .set('Cookie', harness.cookie)
      .send({ projectId: PROJECT, objective: '   ', budgetTokens: 12000, budgetCost: 40 });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/objective|FR-CTX-032/i);
  });

  it('and answers 503 while the embedding provider is unbound', async () => {
    // `FR-CTX-012`, `R-038-1`. The Epic's central unowned dependency, visible
    // through a route rather than described in a document.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages`)
      .set('Cookie', harness.cookie)
      .send({
        projectId: PROJECT,
        objective: 'why does the booking notify twice',
        budgetTokens: 12000,
        budgetCost: 40,
      });

    expect(res.status).toBe(503);
  });

  it('**naming the seam**, so the 503 is actionable', async () => {
    // A 503 saying nothing is the same defect with a better number.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages`)
      .set('Cookie', harness.cookie)
      .send({
        projectId: PROJECT,
        objective: 'why does the booking notify twice',
        budgetTokens: 12000,
        budgetCost: 40,
      });

    const body = JSON.stringify(res.body);
    expect(body).toMatch(/EmbeddingPort/);
    expect(body).toMatch(/FR-CTX-013/);
  });

  it('and says an unranked package would be a different thing, not a degraded one', async () => {
    // The reasoning travels with the refusal. Somebody reading this at three in
    // the morning should not have to find `R-038-1` to know why it did not just
    // return something.
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages`)
      .set('Cookie', harness.cookie)
      .send({
        projectId: PROJECT,
        objective: 'why does the booking notify twice',
        budgetTokens: 12000,
        budgetCost: 40,
      });
    expect(JSON.stringify(res.body)).toMatch(/unranked|degraded/i);
  });

  it('and nothing is written when it refuses', async () => {
    // A refusal from an unbound seam is not the same as `FR-CTX-065`'s refused
    // package: nothing was assembled, nothing was judged, and a row claiming
    // otherwise would describe an attempt that never happened.
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query('SELECT count(*)::int AS n FROM "context_packages"');
      expect(rows.rows[0].n).toBe(0);
    } finally {
      await db.end();
    }
  });
});

suite('T1244 · GET /context/sources', () => {
  it('refuses with no session', async () => {
    const res = await request(app.getHttpServer()).get(`/${PREFIX}/context/sources`);
    expect(res.status).toBe(401);
  });

  it('lists the approved source set, so nobody reads configuration files', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${PREFIX}/context/sources`)
      .set('Cookie', harness.cookie);

    expect(res.status).toBe(200);
    expect(res.body.map((c: { sourceType: string }) => c.sourceType).sort()).toEqual([
      'incident-note',
      'requirement',
    ]);
  });

  it('and shows which are indexable, which is why a document may never be retrieved', async () => {
    // `FR-CTX-015`. The two facts are separate: `incident-note` is classified
    // and deliberately outside the corpus, and this listing is where somebody
    // finds that out without asking.
    const res = await request(app.getHttpServer())
      .get(`/${PREFIX}/context/sources`)
      .set('Cookie', harness.cookie);

    const byType = Object.fromEntries(
      res.body.map((c: { sourceType: string; indexable: boolean }) => [c.sourceType, c.indexable]),
    );
    expect(byType).toEqual({ requirement: true, 'incident-note': false });
  });

  it('and never another workspace’s configuration', async () => {
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      await db.query(
        `INSERT INTO "context_source_classes"
           ("id","workspaceId","sourceType","securityClassification","indexable")
         VALUES ('sc_other','ws_elsewhere','secret-type','secret',true)`,
      );
    } finally {
      await db.end();
    }

    const res = await request(app.getHttpServer())
      .get(`/${PREFIX}/context/sources`)
      .set('Cookie', harness.cookie);

    expect(res.body.map((c: { sourceType: string }) => c.sourceType)).not.toContain('secret-type');
  });
});
