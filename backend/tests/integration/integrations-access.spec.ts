/**
 * `T2210` (EPIC-039, `US8`, `FR-HUB-076`) — the registry is deny-by-default
 * through the REAL routes against `AppModule`.
 *
 * A member of the workspace **without** `EPIC-024` read on
 * `{ artifactType: 'integration-registry', artifactId: workspaceId }` gets
 * `404` from every registry route — the list, an entry, the vocabulary, one
 * contract version, the deployment binding, and the two writes — with the same
 * body an unknown entry gets, so the refusal does not confirm that the registry
 * (or the entry) exists. Granting read through the access routes opens the
 * reads and nothing else: the writes stay `404` until edit is granted.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startIntegrationsApp, type IntegrationsApp } from '../helpers/integrations-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const WORKSPACE = 'ws_access';

let t: IntegrationsApp;
let entry = '';
let reader = '';

type Route = { readonly name: string; readonly send: (cookie: string) => request.Test; readonly write: boolean };

const ROUTES: readonly Route[] = [
  { name: 'GET /integrations/registry', write: false, send: (c) => request(t.api).get('/v1/integrations/registry').set('Cookie', c) },
  { name: 'GET /integrations/registry?projectId', write: false, send: (c) => request(t.api).get(`/v1/integrations/registry?projectId=${t.projectA}`).set('Cookie', c) },
  { name: 'GET /integrations/registry/:entryId', write: false, send: (c) => request(t.api).get(`/v1/integrations/registry/${entry}`).set('Cookie', c) },
  { name: 'GET /integrations/capabilities', write: false, send: (c) => request(t.api).get('/v1/integrations/capabilities').set('Cookie', c) },
  { name: 'GET /integrations/capabilities/:name/versions/:version', write: false, send: (c) => request(t.api).get('/v1/integrations/capabilities/ReadRepository/versions/1.0').set('Cookie', c) },
  { name: 'GET /integrations/deployment/capabilities', write: false, send: (c) => request(t.api).get('/v1/integrations/deployment/capabilities').set('Cookie', c) },
  { name: 'POST /integrations/registry', write: true, send: (c) => request(t.api).post('/v1/integrations/registry').set('Cookie', c).send({ key: 'fixture-git' }) },
  { name: 'POST /integrations/registry/:entryId/retire', write: true, send: (c) => request(t.api).post(`/v1/integrations/registry/${entry}/retire`).set('Cookie', c) },
];

beforeAll(async () => {
  if (noRuntime) return;
  t = await startIntegrationsApp({ workspaceId: WORKSPACE, userId: 'u_access_owner' });
  entry = await t.register('fixture-ci');
  reader = await t.asUser('u_access_reader');
}, 600_000);

afterAll(async () => {
  await t?.stop();
}, 120_000);

suite('T2210 · a reader without EPIC-024 read gets 404 from every registry route (FR-HUB-076)', () => {
  it('the owner (seeded with edit) reads every route — the control that makes the 404s mean something', async () => {
    for (const route of ROUTES.filter((r) => !r.write)) {
      const res = await route.send(t.cookie);
      expect(res.status, route.name).toBe(200);
    }
  });

  it.each(ROUTES.map((r) => [r.name, r] as const))('%s → 404 without the grant', async (_name, route) => {
    const res = await route.send(reader);
    expect(res.status, route.name).toBe(404);
    // Indistinguishable from absence: the body names no registry, entry or grant.
    const unknown = await request(t.api).get('/v1/integrations/registry/does-not-exist').set('Cookie', t.cookie).expect(404);
    expect(res.body?.error?.code, route.name).toBe(unknown.body?.error?.code);
    expect(JSON.stringify(res.body), route.name).not.toMatch(/fixture-ci|pmi-studio|integration-registry|grant/i);
  });

  it('nothing changed: the refused writes registered and retired nothing', async () => {
    const res = await request(t.api).get('/v1/integrations/registry').set('Cookie', t.cookie).expect(200);
    const keys = res.body.entries.map((e: { key: string }) => e.key);
    expect(keys).not.toContain('fixture-git');
    expect(res.body.entries.find((e: { id: string }) => e.id === entry).status).toBe('active');
  });

  it('granting read opens the reads and nothing else', async () => {
    await request(t.api)
      .post(`/v1/artifacts/integration-registry/${WORKSPACE}/grants`)
      .set('Cookie', t.cookie)
      .send({ userId: 'u_access_reader', level: 'read' })
      .expect(201);
    for (const route of ROUTES) {
      const res = await route.send(reader);
      expect(res.status, route.name).toBe(route.write ? 404 : 200);
    }
  });
});
