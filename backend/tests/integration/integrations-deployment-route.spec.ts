/**
 * `T2204` (EPIC-039, API contract §4a, analysis I1, `US7` AS4, quickstart Q21)
 * — the deployment's `Embed` binding through the real `AppModule`.
 *
 * Boot with `PMI_EMBED_ADAPTER=fixture-embed` and read
 * `GET /integrations/deployment/capabilities`; reboot against the SAME database
 * with `ollama-embed` (recordings served by a loopback replay, never the
 * network) and observe a new row with `reindexRequired: true`; reboot unchanged
 * and observe no new row. `PUT`/`DELETE` on the binding and any deployment
 * credential route answer `404` — there is no such route.
 *
 * Written to FAIL before `T2205`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Replay, startReplayServer, type Recording } from '@pmi/capability-contract/replay';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { embedOverlay } from '../../../packages/capability-adapters/ollama/tests/embed-replay.js';
import { rebootApp } from '../helpers/authenticated-app.js';
import { startIntegrationsApp, type IntegrationsApp } from '../helpers/integrations-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const here = dirname(fileURLToPath(import.meta.url));
const RECORDING = JSON.parse(readFileSync(join(resolve(here, '../../../packages/capability-adapters/ollama/tests/recordings'), '2026-10-10.ollama-embed.json'), 'utf8')) as Recording;
const DIGEST = '0a109f422b47e3a30ba2b10eca18548e944e8a23073ee3f3e947efcf3c45e59f';
const IDS = { workspaceId: 'ws_deploy', userId: 'u_deploy' };

let t: IntegrationsApp;
let replay: { url: string; close(): Promise<void> };
const extra: INestApplication[] = [];
const saved = { adapter: process.env['PMI_EMBED_ADAPTER'], binding: process.env['PMI_EMBED_BINDING'] };

beforeAll(async () => {
  if (noRuntime) return;
  replay = await startReplayServer(new Replay([RECORDING], { overlay: embedOverlay(RECORDING) }));
  t = await startIntegrationsApp(IDS, { PMI_EMBED_ADAPTER: 'fixture-embed' });
}, 600_000);

afterAll(async () => {
  for (const app of extra) await app.close();
  await t?.stop();
  await replay?.close();
  for (const [k, v] of [['PMI_EMBED_ADAPTER', saved.adapter], ['PMI_EMBED_BINDING', saved.binding]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}, 120_000);

async function rows(): Promise<{ adapterKey: string | null; modelId: string | null; previousModelId: string | null; reindexRequired: boolean }[]> {
  return t.sql(`SELECT "adapterKey", "modelId", "previousModelId", "reindexRequired" FROM "deployment_capability_bindings" WHERE "capability" = 'Embed' ORDER BY "observedAt", "createdAt"`);
}

async function reboot(env: Record<string, string>): Promise<{ app: INestApplication; cookie: string }> {
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  const booted = await rebootApp(t.databaseUrl, IDS);
  extra.push(booted.app);
  return booted;
}

suite('T2204 · the deployment binding through AppModule (API §4a, Q21)', () => {
  it('boot 1 — fixture-embed: the read route shows it bound, eligible, with its model', async () => {
    const res = await request(t.api).get('/v1/integrations/deployment/capabilities').set('Cookie', t.cookie).expect(200);
    expect(res.body.capabilities).toEqual([
      expect.objectContaining({ capability: 'Embed', scope: 'deployment', adapterKey: 'fixture-embed', eligible: true, dimension: 27, modelId: 'fixture-embed:fixture-letters@sha256:fixture-letters-1', health: 'healthy' }),
    ]);
    expect(await rows()).toEqual([{ adapterKey: 'fixture-embed', modelId: 'fixture-embed:fixture-letters@sha256:fixture-letters-1', previousModelId: null, reindexRequired: true }]);
  });

  it('a reader without the registry grant gets 404', async () => {
    const stranger = await t.asUser('u_stranger');
    await request(t.api).get('/v1/integrations/deployment/capabilities').set('Cookie', stranger).expect(404);
  });

  it('there is no write route: PUT/DELETE on the binding and every deployment credential route are 404', async () => {
    await request(t.api).put('/v1/integrations/deployment/capabilities/Embed').set('Cookie', t.cookie).send({ adapterKey: 'ollama-embed' }).expect(404);
    await request(t.api).delete('/v1/integrations/deployment/capabilities/Embed').set('Cookie', t.cookie).expect(404);
    await request(t.api).put('/v1/integrations/deployment/credentials/any').set('Cookie', t.cookie).send({ kind: 'bearer-token', value: 'x' }).expect(404);
    await request(t.api).delete('/v1/integrations/deployment/credentials/any').set('Cookie', t.cookie).expect(404);
    expect(await rows()).toHaveLength(1);
  });

  it('boot 2 — ollama-embed over the replay: a new row, reindexRequired, naming the previous model', async () => {
    const { app, cookie } = await reboot({ PMI_EMBED_ADAPTER: 'ollama-embed', PMI_EMBED_BINDING: JSON.stringify({ baseUrl: replay.url, model: 'nomic-embed-text' }) });
    const res = await request(app.getHttpServer()).get('/v1/integrations/deployment/capabilities').set('Cookie', cookie).expect(200);
    expect(res.body.capabilities[0]).toMatchObject({ adapterKey: 'ollama-embed', eligible: true, dimension: 768, modelId: `ollama-embed:nomic-embed-text@${DIGEST}` });
    const all = await rows();
    expect(all).toHaveLength(2);
    expect(all[1]).toEqual({ adapterKey: 'ollama-embed', modelId: `ollama-embed:nomic-embed-text@${DIGEST}`, previousModelId: 'fixture-embed:fixture-letters@sha256:fixture-letters-1', reindexRequired: true });
  });

  it('boot 3 — unchanged configuration: no new row', async () => {
    await reboot({ PMI_EMBED_ADAPTER: 'ollama-embed', PMI_EMBED_BINDING: JSON.stringify({ baseUrl: replay.url, model: 'nomic-embed-text' }) });
    expect(await rows()).toHaveLength(2);
  });
});
