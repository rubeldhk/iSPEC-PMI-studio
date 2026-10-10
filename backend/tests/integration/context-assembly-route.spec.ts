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
      // `FR-CTX-036` — the budget policy, configured as an operator would.
      // Without it assembly refuses with 400 before reaching the embedding
      // seam this suite exists to see refuse.
      await db.query(
        `INSERT INTO "context_budget_policies"
           ("id","workspaceId","retrievalLimit","tokensPerCandidate","costPerThousandTokens")
         VALUES ('bp_ctx',$1,40,500,0)`,
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

  it('and the refusal is recorded as a refused row — naming the seam, ranked by nothing', async () => {
    // `T1819`, `FR-CTX-065`, contract: "the refusals write a ContextPackage row".
    // This test first asserted the opposite — that an unbound seam left no row
    // because nothing was assembled. The contract is right and that was wrong:
    // with no row, "assembly was refused" and "assembly was never attempted"
    // are the same absence. The row names no model, because none ranked.
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query(
        `SELECT "state", "refusalReason", "embeddingModelId" FROM "context_packages" WHERE "workspaceId" = $1`,
        [WS],
      );
      expect(rows.rowCount).toBeGreaterThan(0);
      for (const row of rows.rows) {
        expect(row.state).toBe('refused');
        expect(row.refusalReason).toMatch(/EmbeddingPort/);
        expect(row.embeddingModelId).toBeNull();
      }
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

/**
 * `T1265` — inspection through the composed application. Packages are seeded
 * with SQL because `POST` refuses until an embedding provider exists; what is
 * under test is that the read routes return what was stored, as stored.
 */
suite('T1265 · GET /context/packages/:id and ?executionId=', () => {
  const EXEC = 'ex_context_1';
  const PKG = 'cp_context_1';

  beforeAll(async () => {
    if (noRuntime) return;
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      await db.query(
        `INSERT INTO "executions"
           ("id","correlationId","idempotencyKey","workspaceId","command","argsSanitized",
            "initiatorType","initiatorId","surface","contractVersion","assurance")
         VALUES ($1,'c_ctx','k_ctx',$2,'specify','{}'::jsonb,'agent','p_agent','fixture','1.0','local')`,
        [EXEC, WS],
      );
      await db.query(
        `INSERT INTO "context_packages"
           ("id","workspaceId","projectId","executionId","objective","actorId","actorRole",
            "budgetTokens","budgetCost","state","embeddingModelId")
         VALUES ($1,$2,$3,$4,'why does the booking notify twice',$5,'engineer',12000,40,'assembled','model-a')`,
        [PKG, WS, PROJECT, EXEC, USER],
      );
      await db.query(
        `INSERT INTO "context_items"
           ("id","workspaceId","packageId","sourceType","sourceId","sourceVersion",
            "authoritativeStatus","undeterminedReason","inclusionReason","relevanceScore")
         VALUES ('pi_ctx_1',$1,$2,'requirement','rq_1','v3','undetermined',
                 'provenance resolution is not yet bound','objective relevance 0.91',0.91)`,
        [WS, PKG],
      );
      await db.query(
        `INSERT INTO "context_exclusions"
           ("id","workspaceId","packageId","sourceType","sourceId","reason","detail")
         VALUES ('ex_ctx_1',$1,$2,'requirement','rq_2','permission','u_context may not read rq_2')`,
        [WS, PKG],
      );
    } finally {
      await db.end();
    }
  });

  it('refuses with no session', async () => {
    const res = await request(app.getHttpServer()).get(`/${PREFIX}/context/packages/${PKG}`);
    expect(res.status).toBe(401);
  });

  it('returns the package as stored: items, exclusions, drift and execution', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${PREFIX}/context/packages/${PKG}`)
      .set('Cookie', harness.cookie);

    expect(res.status).toBe(200);
    expect(res.body.package.id).toBe(PKG);
    expect(res.body.items.map((i: { sourceId: string }) => i.sourceId)).toEqual(['rq_1']);
    expect(res.body.exclusions.map((e: { reason: string }) => e.reason)).toEqual(['permission']);
    // `T1810` — the version reader asks the requirement register, and the
    // seeded `rq_1` is not in it: the source no longer resolves, and inspection
    // says so beside the retained item rather than claiming `unchanged`.
    expect(res.body.items[0].drift.kind).toBe('unresolvable');
    expect(res.body.execution).toMatchObject({ executionId: EXEC, consequential: 'undetermined' });
    // `T1816` — read from EPIC-037's own projection: the seeded execution has no
    // events, so it is still `registered` and nothing consumed the package.
    expect(res.body.execution.ran).toBe(false);
    expect(res.body.execution.consumption).toMatch(/nothing consumed this package/);
  });

  it('is 404 for a package that does not exist or is in another workspace', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${PREFIX}/context/packages/cp_nowhere`)
      .set('Cookie', harness.cookie);
    expect(res.status).toBe(404);
  });

  it('lists the packages an execution was given', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${PREFIX}/context/packages?executionId=${EXEC}`)
      .set('Cookie', harness.cookie);
    expect(res.status).toBe(200);
    expect(res.body.map((p: { package: { id: string } }) => p.package.id)).toEqual([PKG]);
  });

  it('and refuses a listing with no executionId — there is no workspace-wide listing', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${PREFIX}/context/packages`)
      .set('Cookie', harness.cookie);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/executionId/);
  });
});

/**
 * `T1278` — the index routes. One source at a time; there is no rebuild-all
 * route (`R-038-6`).
 */
suite('T1278 · POST /context/index/reindex and GET /context/index/health', () => {
  it('refuses with no session', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/index/reindex`)
      .send({ sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1' });
    expect(res.status).toBe(401);
  });

  it('is 400 for a source class that is not indexable, naming it', async () => {
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      await db.query(
        `INSERT INTO "context_source_classes"
           ("id","workspaceId","sourceType","securityClassification","indexable")
         VALUES ('sc_dec',$1,'decision','restricted',false)`,
        [WS],
      );
    } finally {
      await db.end();
    }
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/index/reindex`)
      .set('Cookie', harness.cookie)
      .send({ sourceType: 'decision', sourceId: 'd_1', sourceVersion: 'v1' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/restricted/);
  });

  it('is 503 naming EmbeddingPort for an indexable source, while no provider exists', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/index/reindex`)
      .set('Cookie', harness.cookie)
      .send({ sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1' });
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).toMatch(/EmbeddingPort/);
  });

  it('has no rebuild-all route', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/index/rebuild`)
      .set('Cookie', harness.cookie)
      .send({});
    expect(res.status).toBe(404);
  });

  it('reports health, with the stale count known — zero entries, zero stale', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${PREFIX}/context/index/health`)
      .set('Cookie', harness.cookie);
    expect(res.status).toBe(200);
    // `T1810` bound a version reader, so the count is known rather than
    // `null`. The unknown case is `context-staleness.spec.ts`'s.
    expect(res.body).toMatchObject({ entryCount: 0, embeddingModelId: null, staleCount: 0, staleness: 'known' });
  });
});

/** `T1807` — the route refuses a project that is not a real boundary. */
suite('T1807 · POST /context/packages names a real project', () => {
  it('refuses a blank projectId with 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages`)
      .set('Cookie', harness.cookie)
      .send({ projectId: '  ', objective: 'why does the booking notify twice', budgetTokens: 12000, budgetCost: 40 });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/projectId[\s\S]*FR-CTX-050/);
  });

  it('refuses a projectId that is not in the workspace with 400, before any seam is reached', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages`)
      .set('Cookie', harness.cookie)
      .send({ projectId: 'pr_nowhere', objective: 'why does the booking notify twice', budgetTokens: 12000, budgetCost: 40 });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/no project pr_nowhere in this workspace/);
  });
});

/** `T1830` — binding a package assembled ahead of its execution, once. */
suite('T1830 · POST /context/packages/:id/execution', () => {
  const PKG = 'cp_unbound_1';
  const EXEC_A = 'ex_bind_a';
  const EXEC_B = 'ex_bind_b';

  beforeAll(async () => {
    if (noRuntime) return;
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      for (const [id, key] of [[EXEC_A, 'k_bind_a'], [EXEC_B, 'k_bind_b']]) {
        await db.query(
          `INSERT INTO "executions"
             ("id","correlationId","idempotencyKey","workspaceId","command","argsSanitized",
              "initiatorType","initiatorId","surface","contractVersion","assurance")
           VALUES ($1,'c_bind',$2,$3,'implement','{}'::jsonb,'agent','p_agent','fixture','1.0','local')`,
          [id, key, WS],
        );
      }
      await db.query(
        `INSERT INTO "context_packages"
           ("id","workspaceId","projectId","objective","actorId","actorRole",
            "budgetTokens","budgetCost","state","embeddingModelId")
         VALUES ($1,$2,$3,'prepared ahead of its execution',$4,'engineer',12000,40,'assembled','model-a')`,
        [PKG, WS, PROJECT, USER],
      );
    } finally {
      await db.end();
    }
  });

  it('binds an unbound package to a registered execution, and lists it there', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages/${PKG}/execution`)
      .set('Cookie', harness.cookie)
      .send({ executionId: EXEC_A });
    expect(res.status).toBe(200);
    expect(res.body.package.executionId).toBe(EXEC_A);
    const listed = await request(app.getHttpServer())
      .get(`/${PREFIX}/context/packages?executionId=${EXEC_A}`)
      .set('Cookie', harness.cookie);
    expect(listed.body.map((p: { package: { id: string } }) => p.package.id)).toEqual([PKG]);
  });

  it('refuses to re-point a bound package with 409', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages/${PKG}/execution`)
      .set('Cookie', harness.cookie)
      .send({ executionId: EXEC_B });
    expect(res.status).toBe(409);
  });

  it('is 404 for a package that is not in the workspace', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages/cp_nowhere/execution`)
      .set('Cookie', harness.cookie)
      .send({ executionId: EXEC_B });
    expect(res.status).toBe(404);
  });
});

/** `T1842` — a budget that is not a budget is a 400, before anything is read. */
suite('T1842 · POST /context/packages validates its budget', () => {
  it.each([
    ['a non-numeric token budget', { budgetTokens: 'lots', budgetCost: 40 }],
    ['a negative token budget', { budgetTokens: -1, budgetCost: 40 }],
    ['a fractional token budget', { budgetTokens: 1.5, budgetCost: 40 }],
    ['a non-numeric cost budget', { budgetTokens: 12000, budgetCost: 'free' }],
    ['a negative cost budget', { budgetTokens: 12000, budgetCost: -0.01 }],
  ])('refuses %s with 400 naming the budget', async (_label, budget) => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages`)
      .set('Cookie', harness.cookie)
      .send({ projectId: PROJECT, objective: 'why does the booking notify twice', ...budget });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/budget[\s\S]*FR-CTX-031/);
  });
});

/** `T1835` — the refusal body names the row, and that row opens. */
suite('T1835 · a refusal can be opened by the id it returns', () => {
  it('the 503 carries the refused package id, and GET /context/packages/:id shows the refusal', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages`)
      .set('Cookie', harness.cookie)
      .send({ projectId: PROJECT, objective: 'why does the booking notify twice', budgetTokens: 12000, budgetCost: 40 });
    expect(res.status).toBe(503);
    const id = res.body.error?.details?.packageId;
    expect(typeof id).toBe('string');

    const opened = await request(app.getHttpServer())
      .get(`/${PREFIX}/context/packages/${id}`)
      .set('Cookie', harness.cookie);
    expect(opened.status).toBe(200);
    expect(opened.body.package).toMatchObject({ state: 'refused', embeddingModelId: null });
    expect(opened.body.package.refusalReason).toMatch(/EmbeddingPort/);
  });
});

/**
 * `T1846` — through the composed application and EPIC-037's own registry: an
 * execution held by another workspace, or by none, is refused before ranking,
 * and the two refusals read alike.
 */
suite('T1846 · POST /context/packages refuses an execution the workspace does not hold', () => {
  const FOREIGN_WS = 'ws_other_tenant';
  const FOREIGN_EXEC = 'ex_other_tenant';

  beforeAll(async () => {
    if (noRuntime) return;
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'Other tenant',now())`, [FOREIGN_WS]);
      await db.query(
        `INSERT INTO "executions"
           ("id","correlationId","idempotencyKey","workspaceId","command","argsSanitized",
            "initiatorType","initiatorId","surface","contractVersion","assurance")
         VALUES ($1,'c_other','k_other',$2,'implement','{}'::jsonb,'agent','p_agent','fixture','1.0','local')`,
        [FOREIGN_EXEC, FOREIGN_WS],
      );
    } finally {
      await db.end();
    }
  });

  async function attempt(executionId: string) {
    return request(app.getHttpServer())
      .post(`/${PREFIX}/context/packages`)
      .set('Cookie', harness.cookie)
      .send({ projectId: PROJECT, objective: 'why does the booking notify twice', budgetTokens: 12000, budgetCost: 40, executionId });
  }

  it("another workspace's execution is a 400, and no package is bound to it", async () => {
    const res = await attempt(FOREIGN_EXEC);
    expect(res.status).toBe(400);
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query(`SELECT count(*)::int AS n FROM "context_packages" WHERE "executionId" = $1`, [FOREIGN_EXEC]);
      expect(rows.rows[0].n).toBe(0);
    } finally {
      await db.end();
    }
  });

  it('and reads exactly like an id that exists nowhere', async () => {
    const foreign = await attempt(FOREIGN_EXEC);
    const nowhere = await attempt('ex_nowhere_at_all');
    expect(foreign.status).toBe(nowhere.status);
    expect(foreign.body.error.message.replace(FOREIGN_EXEC, '<id>')).toBe(
      nowhere.body.error.message.replace('ex_nowhere_at_all', '<id>'),
    );
  });
});

/** `T1848` — the body is a budget, typed, in range; never coerced. */
suite('T1848 · POST /context/packages type-checks its body', () => {
  it.each([
    ['a missing token budget', { budgetCost: 40 }],
    ['a null token budget', { budgetTokens: null, budgetCost: 40 }],
    ['an empty-string token budget', { budgetTokens: '', budgetCost: 40 }],
    ['a boolean token budget', { budgetTokens: true, budgetCost: 40 }],
    ['an array token budget', { budgetTokens: [], budgetCost: 40 }],
    ['a token budget beyond the column', { budgetTokens: 3_000_000_000, budgetCost: 40 }],
    ['a missing cost budget', { budgetTokens: 12000 }],
    ['a cost budget beyond the column', { budgetTokens: 12000, budgetCost: 1e9 }],
    ['a non-array essentialSources', { budgetTokens: 12000, budgetCost: 40, essentialSources: 'rq_1' }],
    ['a malformed essential source', { budgetTokens: 12000, budgetCost: 40, essentialSources: [{ sourceId: 7 }] }],
  ])('refuses %s with 400 and writes no row', async (_label, body) => {
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const before = (await db.query(`SELECT count(*)::int AS n FROM "context_packages"`)).rows[0].n;
      const res = await request(app.getHttpServer())
        .post(`/${PREFIX}/context/packages`)
        .set('Cookie', harness.cookie)
        .send({ projectId: PROJECT, objective: 'why does the booking notify twice', ...body });
      expect(res.status).toBe(400);
      const after = (await db.query(`SELECT count(*)::int AS n FROM "context_packages"`)).rows[0].n;
      expect(after).toBe(before);
    } finally {
      await db.end();
    }
  });
});

/** `T1858` — the text fields are text; nothing is coerced or silently dropped. */
suite('T1858 · POST /context/packages type-checks its text fields', () => {
  it.each([
    ['an object objective', { objective: {} }],
    ['a numeric objective', { objective: 42 }],
    ['a numeric projectId', { projectId: 7 }],
    ['a numeric executionId', { executionId: 123 }],
    ['an object executionId', { executionId: { id: 'ex_1' } }],
  ])('refuses %s with 400 and writes no row', async (_label, override) => {
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const before = (await db.query(`SELECT count(*)::int AS n FROM "context_packages"`)).rows[0].n;
      const res = await request(app.getHttpServer())
        .post(`/${PREFIX}/context/packages`)
        .set('Cookie', harness.cookie)
        .send({
          projectId: PROJECT,
          objective: 'why does the booking notify twice',
          budgetTokens: 12000,
          budgetCost: 40,
          ...override,
        });
      expect(res.status).toBe(400);
      const after = (await db.query(`SELECT count(*)::int AS n FROM "context_packages"`)).rows[0].n;
      expect(after).toBe(before);
    } finally {
      await db.end();
    }
  });
});
