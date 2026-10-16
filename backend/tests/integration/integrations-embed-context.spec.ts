/**
 * `T2217` (EPIC-039, `SC-HUB-009`, `FR-HUB-085`, `FR-HUB-087`, quickstart Q19)
 * — `EPIC-038`'s two embedding routes through the REAL `AppModule`, with
 * `EmbeddingPort` filled by the Hub (`T2218`).
 *
 * - **Bound** (`PMI_EMBED_ADAPTER=fixture-embed`): `POST /context/index/reindex`
 *   indexes a real requirement and `POST /context/packages` assembles a ranked
 *   package — neither answers the `503` naming `EmbeddingPort`, and both record
 *   the fixture's model identity.
 * - **Unbound** (no `PMI_EMBED_ADAPTER`): both answer `503` naming
 *   `EmbeddingPort`, and the message now carries the Hub's explanation of why
 *   its `Embed` binding is not usable — the refusal tells an operator what to
 *   set, not only that something is missing.
 *
 * `fixture-embed` is the deterministic letter-bag model: this shows the seam
 * is filled and composes, **not** that ranking is by meaning — that is
 * `EPIC-038`'s `T1282`, which needs a real model (`T2220`).
 *
 * Deterministic: no clock, no network, no provider — the same answers in 100%
 * of runs. One database: the unbound half reboots `AppModule` against it with
 * `PMI_EMBED_ADAPTER` removed, as an operator would (`rebootApp`) — a second
 * container in one file is not something the shared Prisma client survives.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rebootApp } from '../helpers/authenticated-app.js';
import { startIntegrationsApp, type IntegrationsApp } from '../helpers/integrations-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const FIXTURE_MODEL = 'fixture-embed:fixture-letters@sha256:fixture-letters-1';

async function configureContext(t: IntegrationsApp, workspaceId: string): Promise<void> {
  // `FR-CTX-036` — configuration an operator supplies, seeded as such.
  await t.sql(
    `INSERT INTO "context_source_classes" ("id","workspaceId","sourceType","securityClassification","indexable")
     VALUES ($1,$2,'requirement','internal',true)`,
    [`sc_${workspaceId}`, workspaceId],
  );
  await t.sql(
    `INSERT INTO "context_budget_policies" ("id","workspaceId","retrievalLimit","tokensPerCandidate","costPerThousandTokens")
     VALUES ($1,$2,40,500,0)`,
    [`bp_${workspaceId}`, workspaceId],
  );
}

async function requirement(t: Pick<IntegrationsApp, 'api' | 'cookie' | 'projectA'>, description = 'Customers receive two identical booking notification emails.'): Promise<{ id: string; contentHash: string }> {
  const res = await request(t.api)
    .post(`/v1/projects/${t.projectA}/requirements`)
    .set('Cookie', t.cookie)
    .send({ description, type: 'functional', priority: 'p1' });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { id: res.body.id, contentHash: res.body.contentHash };
}

type Http = Pick<IntegrationsApp, 'api' | 'cookie' | 'projectA'>;
const reindex = (t: Http, body: Record<string, unknown>) =>
  request(t.api).post('/v1/context/index/reindex').set('Cookie', t.cookie).send(body);
const assemble = (t: Http) =>
  request(t.api)
    .post('/v1/context/packages')
    .set('Cookie', t.cookie)
    .send({ projectId: t.projectA, objective: 'booking notification sent twice', budgetTokens: 12000, budgetCost: 40 });

const IDS = { workspaceId: 'ws_embed', userId: 'u_embed' };
let t: IntegrationsApp;
let unbound: INestApplication | null = null;
const savedAdapter = process.env['PMI_EMBED_ADAPTER'];

beforeAll(async () => {
  if (noRuntime) return;
  t = await startIntegrationsApp(IDS, { PMI_EMBED_ADAPTER: 'fixture-embed' });
  await configureContext(t, IDS.workspaceId);
}, 600_000);

afterAll(async () => {
  await unbound?.close();
  await t?.stop();
  if (savedAdapter === undefined) delete process.env['PMI_EMBED_ADAPTER'];
  else process.env['PMI_EMBED_ADAPTER'] = savedAdapter;
}, 120_000);

suite('T2217 · Embed bound to fixture-embed — EPIC-038 stops answering 503 (Q19, SC-HUB-009)', () => {
  let req = { id: '', contentHash: '' };

  beforeAll(async () => {
    req = await requirement(t);
  }, 120_000);

  it('POST /context/index/reindex indexes a real requirement through the Hub', async () => {
    const res = await reindex(t, { sourceType: 'requirement', sourceId: req.id, sourceVersion: req.contentHash });
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
    expect(JSON.stringify(res.body)).not.toMatch(/EmbeddingPort/);
    const health = await request(t.api).get('/v1/context/index/health').set('Cookie', t.cookie).expect(200);
    expect(health.body).toMatchObject({ entryCount: 1, embeddingModelId: FIXTURE_MODEL });
  });

  it('POST /context/packages assembles a ranked package, recording the model identity', async () => {
    const res = await assemble(t);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/EmbeddingPort/);
    const rows = await t.sql<{ state: string; embeddingModelId: string | null }>(
      `SELECT "state","embeddingModelId" FROM "context_packages" WHERE "workspaceId" = $1`,
      [IDS.workspaceId],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.state !== 'refused' && r.embeddingModelId === FIXTURE_MODEL)).toBe(true);
  });

  it('each embed() was one deployment-scope resolution recorded by the Hub, with the model identity', async () => {
    const rows = await t.sql<{ outcome: string; caller: string; modelIdentity: { modelId: string } | null }>(
      `SELECT "outcome","caller","modelIdentity" FROM "capability_resolutions" WHERE "capability" = 'Embed' AND "scope" = 'deployment'`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const r of rows) expect(r).toMatchObject({ outcome: 'resolved', caller: 'context-assembly', modelIdentity: expect.objectContaining({ modelId: FIXTURE_MODEL }) });
  });
});

suite('T2217 · Embed unbound — the 503 names EmbeddingPort and carries the Hub’s explanation (FR-HUB-085)', () => {
  let http: Http;
  let req = { id: '', contentHash: '' };

  beforeAll(async () => {
    // Reboot against the same database with no Embed binding at all.
    delete process.env['PMI_EMBED_ADAPTER'];
    const booted = await rebootApp(t.databaseUrl, IDS);
    unbound = booted.app;
    http = { api: booted.app.getHttpServer(), cookie: booted.cookie, projectA: t.projectA };
    req = await requirement(http, 'A booking confirmation is sent once per booking.');
  }, 300_000);

  it('POST /context/index/reindex → 503 naming EmbeddingPort, with the Hub explanation', async () => {
    const res = await reindex(http, { sourceType: 'requirement', sourceId: req.id, sourceVersion: req.contentHash });
    expect(res.status, JSON.stringify(res.body)).toBe(503);
    const body = JSON.stringify(res.body);
    expect(body).toMatch(/EmbeddingPort/);
    expect(body).toMatch(/Integration Hub's Embed binding is not usable/);
    // It tells the operator what to set, not only that something is missing.
    expect(body).toMatch(/PMI_EMBED_ADAPTER is not set/);
  });

  it('POST /context/packages → 503 naming EmbeddingPort, with the Hub explanation, still refusing rather than degrading', async () => {
    const res = await assemble(http);
    expect(res.status, JSON.stringify(res.body)).toBe(503);
    const body = JSON.stringify(res.body);
    expect(body).toMatch(/EmbeddingPort/);
    expect(body).toMatch(/Integration Hub's Embed binding is not usable/);
    expect(body).toMatch(/FR-CTX-013/);
    expect(body).toMatch(/unranked|degraded/i);
  });

  it('GET /context/index/health names no model rather than a placeholder', async () => {
    const res = await request(http.api).get('/v1/context/index/health').set('Cookie', http.cookie).expect(200);
    expect(res.body.embeddingModelId).toBeNull();
  });
});
