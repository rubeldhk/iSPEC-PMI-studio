/**
 * `T2248` (EPIC-039, analysis C2, `SC-HUB-008`, `R-039-15`) — the owner path,
 * timed from the instants the platform itself records.
 *
 * The owner configures a project for `github-rest` (recorded responses on
 * loopback, never the network) and sets its credential. Setting it runs the
 * health check at once (`credential-set`), so the next request resolves to the
 * new adapter without waiting for a scheduler tick. The test reads the recorded
 * instants — the credential's `setAt`, the `credential-set` health row and the
 * first `resolved` resolution, with the registration as the path's start — and asserts credential-set → first eligible
 * resolution < 60 s and the whole owner path < 5 minutes.
 *
 * `CapabilityPolicy` is bound in the test (a recording policy): `EPIC-031`'s
 * approval is the human part of the path and is not what `SC-HUB-008` times.
 */
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Replay, startReplayServer, type Recording } from '@pmi/capability-contract/replay';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startIntegrationsApp, type IntegrationsApp } from '../helpers/integrations-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const here = dirname(fileURLToPath(import.meta.url));
const RECORDINGS = resolve(here, '../../../packages/capability-adapters/github/tests/recordings');
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const APP_CREDENTIAL = JSON.stringify({ appId: '12345', installationId: '4242', privateKeyPem: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() });

let t: IntegrationsApp;
let replay: { url: string; close(): Promise<void> };

beforeAll(async () => {
  if (noRuntime) return;
  const recordings = [JSON.parse(readFileSync(join(RECORDINGS, '2026-10-10.github-rest.json'), 'utf8')) as Recording];
  replay = await startReplayServer(new Replay(recordings));
  t = await startIntegrationsApp({ workspaceId: 'ws_ttfr', userId: 'u_ttfr' });
  t.bindPolicy();
}, 600_000);

afterAll(async () => {
  await t?.stop();
  await replay?.close();
}, 120_000);

suite('T2248 · credential-set → first eligible resolution (SC-HUB-008)', () => {
  it('the owner path is timed from the recorded instants', async () => {
    const entry = await t.register('github-rest');
    await t.configure(t.projectA, 'ReadBuildStatus', [{ registryEntryId: entry, binding: { repository: 'acme/widgets', apiBaseUrl: replay.url } }]).expect(200);

    // Before the credential: the adapter is ineligible, and says why.
    const before = await request(t.api).post(`/v1/projects/${t.projectA}/capability-requests`).set('Cookie', t.cookie).send({ capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: { revision: SHA } }).expect(200);
    expect(before.body).toMatchObject({ outcome: 'refused', refusal: { candidates: [{ entryKey: 'github-rest', ineligibleBecause: 'credential-missing' }] } });

    await request(t.api).put(`/v1/projects/${t.projectA}/integrations/credentials/${entry}`).set('Cookie', t.cookie).send({ kind: 'github-app-installation', value: APP_CREDENTIAL }).expect(204);

    // No tick: the credential-set check is what makes the adapter eligible.
    const after = await request(t.api).post(`/v1/projects/${t.projectA}/capability-requests`).set('Cookie', t.cookie).send({ capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: { revision: SHA } }).expect(200);
    expect(after.body, JSON.stringify(after.body.refusal)).toMatchObject({ outcome: 'resolved', resolution: { adapterKey: 'github-rest' }, invocation: { outcome: 'succeeded' } });

    // Every instant is read from the database, so all are in one clock and one
    // representation (TIMESTAMP without zone, written by the application).
    const [registered] = await t.sql<{ registeredAt: Date }>(`SELECT "registeredAt" FROM "integration_registry_entries" WHERE "id" = $1`, [entry]);
    const [cred] = await t.sql<{ setAt: Date }>(`SELECT "setAt" FROM "integration_credentials" WHERE "projectId" = $1 AND "registryEntryId" = $2`, [t.projectA, entry]);
    const [check] = await t.sql<{ checkedAt: Date; state: string }>(`SELECT "checkedAt", "state" FROM "integration_health_checks" WHERE "projectId" = $1 AND "registryEntryId" = $2 AND "source" = 'credential-set' ORDER BY "checkedAt" LIMIT 1`, [t.projectA, entry]);
    const [first] = await t.sql<{ decidedAt: Date }>(`SELECT "decidedAt" FROM "capability_resolutions" WHERE "projectId" = $1 AND "adapterKey" = 'github-rest' AND "outcome" = 'resolved' ORDER BY "decidedAt" LIMIT 1`, [t.projectA]);
    expect(cred, 'the credential row records when it was set').toBeDefined();
    expect(check, 'the immediate health check is recorded').toMatchObject({ state: 'healthy' });
    expect(first, 'the first eligible resolution is recorded').toBeDefined();

    const setToCheck = check!.checkedAt.getTime() - cred!.setAt.getTime();
    const setToResolution = first!.decidedAt.getTime() - cred!.setAt.getTime();
    const wholePath = first!.decidedAt.getTime() - registered!.registeredAt.getTime();
    expect(setToCheck).toBeGreaterThanOrEqual(0);
    expect(setToResolution).toBeGreaterThanOrEqual(0);
    expect(setToResolution, `credential-set → first eligible resolution took ${setToResolution} ms`).toBeLessThan(60_000);
    expect(wholePath, `the owner path took ${wholePath} ms`).toBeLessThan(5 * 60_000);
  });
});
