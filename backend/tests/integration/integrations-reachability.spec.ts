/**
 * `T2104` (EPIC-039, Constitution XI Tier 1) — the Integration Hub is reachable
 * through the REAL composed application.
 *
 * `DEF-005-001` is what an unregistered module looks like: built, tested, and
 * answered by nothing. This test imports the real `AppModule` and calls the
 * registry read and the vocabulary read through HTTP. Written to fail before
 * `T2105` registers the module (a `404`/HTML fallback, not the registry).
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let started: AuthenticatedApp;

beforeAll(async () => {
  if (noRuntime) return;
  started = await startAuthenticatedApp({ workspaceId: 'ws_reach', userId: 'u_reach' });
}, 600_000);

afterAll(async () => {
  await started?.close();
}, 120_000);

suite('T2104 · the Integration Hub answers through AppModule', () => {
  it('GET /v1/integrations/registry lists pmi-studio first', async () => {
    const res = await request(started.app.getHttpServer()).get('/v1/integrations/registry').set('Cookie', started.cookie).expect(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.entries[0].key).toBe('pmi-studio');
  });

  it('GET /v1/integrations/capabilities lists the five approved v1 contracts', async () => {
    const res = await request(started.app.getHttpServer()).get('/v1/integrations/capabilities').set('Cookie', started.cookie).expect(200);
    expect(res.body.map((c: { name: string }) => c.name).sort()).toEqual(['Embed', 'ReadBuildStatus', 'ReadRepository', 'ReadTestResults', 'SendNotification']);
  });

  it('POST /v1/projects/:id/capability-requests is mounted (an unknown project is 404 JSON, not the SPA fallback)', async () => {
    const res = await request(started.app.getHttpServer()).post('/v1/projects/nope/capability-requests').set('Cookie', started.cookie).send({ capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: {} });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
