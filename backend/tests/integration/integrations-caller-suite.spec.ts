/**
 * `T2161`, `T2162`, `T2193` (EPIC-039, `SC-HUB-001`, `FR-HUB-060`,
 * `FR-HUB-062`, `US2` AS1–AS2, quickstart Q6, Q10) — ONE caller-level suite,
 * run twice against `AppModule` through the real route: once with the project
 * configured for the fixture adapters, once for the real adapter over recorded
 * responses served on loopback. The second run differs from the first only by
 * `PUT …/configuration` (and the credential the real provider needs).
 *
 * Any difference in contract shape between the runs is a defect in an adapter
 * or the contract, recorded in `defects/` before its fix (`T2162`).
 */
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contractFor, validate, type CapabilityName } from '@pmi/capability-contract';
import { Replay, startReplayServer, type Recording } from '@pmi/capability-contract/replay';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startIntegrationsApp, type IntegrationsApp } from '../helpers/integrations-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const here = dirname(fileURLToPath(import.meta.url));
const RECORDINGS = resolve(here, '../../../packages/capability-adapters/github/tests/recordings');
const RESEND_RECORDINGS = resolve(here, '../../../packages/capability-adapters/resend/tests/recordings');
const RESEND_KEY = 're_test_0123456789abcdefghijklmnopqrstuv';
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const APP_CREDENTIAL = JSON.stringify({ appId: '12345', installationId: '4242', privateKeyPem: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() });

let t: IntegrationsApp;
let replay: { url: string; close(): Promise<void> };
let sendReplay: Replay;
const ids: Record<string, string> = {};

const READS: { capability: CapabilityName; input: Record<string, unknown> }[] = [
  { capability: 'ReadRepository', input: { revision: 'main', mode: 'tree' } },
  { capability: 'ReadBuildStatus', input: { revision: SHA } },
  { capability: 'ReadTestResults', input: { revision: SHA } },
];

/** The caller-level suite. The same assertions, whatever serves the capability. */
async function callerSuite(expectAdapter: (c: CapabilityName) => string): Promise<Record<string, unknown>[]> {
  const outputs: Record<string, unknown>[] = [];
  for (const { capability, input } of READS) {
    const res = await request(t.api).post(`/v1/projects/${t.projectA}/capability-requests`).set('Cookie', t.cookie).send({ capability, major: 1, caller: 'room:change', input }).expect(200);
    expect(res.body.outcome, `${capability}: ${JSON.stringify(res.body.refusal ?? res.body.invocation)}`).toBe('resolved');
    expect(res.body.resolution.adapterKey).toBe(expectAdapter(capability));
    expect(res.body.invocation, `${capability}`).toEqual({ outcome: 'succeeded' });
    expect(validate(contractFor(capability, 1)!.outputSchema, res.body.result)).toEqual({ ok: true });
    outputs.push(res.body.result);
  }
  return outputs;
}

/** Keys of an object, recursively for its first-level children — the contract shape, not the values. */
function shape(v: unknown): unknown {
  if (Array.isArray(v)) return v.length === 0 ? [] : [shape(v[0])];
  if (v !== null && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, typeof (v as Record<string, unknown>)[k] === 'object' ? shape((v as Record<string, unknown>)[k]) : typeof (v as Record<string, unknown>)[k]]));
  return typeof v;
}

beforeAll(async () => {
  if (noRuntime) return;
  const recordings = [
    ...['2026-10-10.github-rest.json'].map((f) => JSON.parse(readFileSync(join(RECORDINGS, f), 'utf8')) as Recording),
    // T2193 — Resend's paths (/emails, /domains) do not overlap GitHub's; one loopback replay serves both.
    JSON.parse(readFileSync(join(RESEND_RECORDINGS, '2026-10-10.resend-email.json'), 'utf8')) as Recording,
  ];
  sendReplay = new Replay(recordings);
  replay = await startReplayServer(sendReplay);
  t = await startIntegrationsApp({ workspaceId: 'ws_suite', userId: 'u_suite' });
  t.bindPolicy();
  for (const key of ['fixture-git', 'fixture-ci', 'github-rest', 'fixture-notify', 'resend-email']) ids[key] = await t.register(key);
}, 600_000);

afterAll(async () => {
  await t?.stop();
  await replay?.close();
}, 120_000);

suite('T2161 · the caller-level suite, twice (SC-HUB-001)', () => {
  let fixtureOutputs: Record<string, unknown>[] = [];
  let realOutputs: Record<string, unknown>[] = [];

  it('run 1 — the project configured for the fixture adapters', async () => {
    await t.configure(t.projectA, 'ReadRepository', [{ registryEntryId: ids['fixture-git']! }]).expect(200);
    await t.configure(t.projectA, 'ReadBuildStatus', [{ registryEntryId: ids['fixture-ci']! }]).expect(200);
    await t.configure(t.projectA, 'ReadTestResults', [{ registryEntryId: ids['fixture-ci']! }]).expect(200);
    await t.tick();
    fixtureOutputs = await callerSuite((c) => (c === 'ReadRepository' ? 'fixture-git' : 'fixture-ci'));
  });

  it('run 2 — the same suite after ONLY a configuration change to github-rest (recorded responses)', async () => {
    const binding = { repository: 'acme/widgets', apiBaseUrl: replay.url };
    for (const capability of ['ReadRepository', 'ReadBuildStatus', 'ReadTestResults']) {
      await t.configure(t.projectA, capability, [{ registryEntryId: ids['github-rest']!, binding }]).expect(200);
    }
    // The real provider needs a credential; setting it runs the health check at once.
    await request(t.api).put(`/v1/projects/${t.projectA}/integrations/credentials/${ids['github-rest']}`).set('Cookie', t.cookie).send({ kind: 'github-app-installation', value: APP_CREDENTIAL }).expect(204);
    realOutputs = await callerSuite(() => 'github-rest');
  });

  it('both runs return the same contract shapes', () => {
    expect(realOutputs).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      const required = contractFor(READS[i]!.capability, 1)!.outputSchema.required ?? [];
      for (const k of required) {
        expect(fixtureOutputs[i]).toHaveProperty(k);
        expect(realOutputs[i]).toHaveProperty(k);
      }
      expect(Object.keys(shape(realOutputs[i]) as object).filter((k) => required.includes(k))).toEqual(Object.keys(shape(fixtureOutputs[i]) as object).filter((k) => required.includes(k)));
    }
  });

  it('the switch is a recorded configuration change (FR-HUB-062): audited update with before and after', async () => {
    const db = new Client({ connectionString: t.databaseUrl });
    await db.connect();
    try {
      const rows = await db.query(`SELECT "detail" FROM "audit_entries" WHERE "workspaceId" = 'ws_suite' AND "targetType" = 'capability-configuration' AND "action" = 'update' ORDER BY "occurredAt"`);
      const switched = rows.rows.map((r) => r.detail as { capability: string; before: { adapters: { key: string }[] } | null; after: { adapters: { key: string }[] } }).filter((d) => d.before !== null);
      expect(switched.map((d) => `${d.capability}: ${d.before!.adapters[0]!.key} → ${d.after.adapters[0]!.key}`).sort()).toEqual([
        'ReadBuildStatus: fixture-ci → github-rest',
        'ReadRepository: fixture-git → github-rest',
        'ReadTestResults: fixture-ci → github-rest',
      ]);
    } finally {
      await db.end();
    }
  });
});

/** `T2193` — `SendNotification` through the same entry point, by both of its callers. */
async function notifySuite(expectAdapter: string, n: number): Promise<Record<string, unknown>[]> {
  const outputs: Record<string, unknown>[] = [];
  const input = { recipients: [{ address: 'reviewer@example.test' }], subject: 'A decision is waiting', body: { text: 'Decision dec_1 needs you.' }, idempotencyKey: `suite-${expectAdapter}-${n}` };
  // A Room, over HTTP.
  const res = await request(t.api).post(`/v1/projects/${t.projectA}/capability-requests`).set('Cookie', t.cookie).send({ capability: 'SendNotification', major: 1, caller: 'room:change', input }).expect(200);
  expect(res.body.outcome, JSON.stringify(res.body.refusal ?? res.body.invocation)).toBe('resolved');
  expect(res.body.resolution.adapterKey).toBe(expectAdapter);
  expect(res.body.invocation).toEqual({ outcome: 'succeeded' });
  expect(validate(contractFor('SendNotification', 1)!.outputSchema, res.body.result)).toEqual({ ok: true });
  outputs.push(res.body.result);
  // notification-dispatch, in process — the caller a session cannot claim (U1).
  const out = await t.hub.notifications.notify({ workspaceId: 'ws_suite', userId: 'u_suite' }, t.projectA, { cause: { kind: 'decision-waiting', ref: 'dec_1' }, recipients: [{ userId: 'u_suite', address: 'reviewer@example.test' }], subject: 'A decision is waiting', body: { text: 'Decision dec_1 needs you.' } });
  expect(out.outcome, JSON.stringify(out)).toBe('delivered');
  const [row] = await t.sql<{ caller: string; adapterKey: string }>(`SELECT "caller", "adapterKey" FROM "capability_resolutions" WHERE "id" = $1`, [out.resolutionId]);
  expect(row).toEqual({ caller: 'notification-dispatch', adapterKey: expectAdapter });
  return outputs;
}

suite('T2193 · SendNotification in the caller-level suite, twice (SC-HUB-001, Q10)', () => {
  let fixtureOutputs: Record<string, unknown>[] = [];
  let realOutputs: Record<string, unknown>[] = [];

  it('notification-dispatch is not accepted over HTTP (U1)', async () => {
    const res = await request(t.api).post(`/v1/projects/${t.projectA}/capability-requests`).set('Cookie', t.cookie).send({ capability: 'SendNotification', major: 1, caller: 'notification-dispatch', input: { recipients: [{ address: 'a@example.test' }], subject: 's', body: { text: 't' }, idempotencyKey: 'u1' } }).expect(200);
    expect(res.body).toMatchObject({ outcome: 'refused', refusal: { code: 'caller-not-platform' } });
  });

  it('run 1 — fixture-notify', async () => {
    await t.configure(t.projectA, 'SendNotification', [{ registryEntryId: ids['fixture-notify']! }]).expect(200);
    await t.tick();
    fixtureOutputs = await notifySuite('fixture-notify', 1);
  });

  it('run 2 — the same suite after ONLY a configuration change to resend-email (recorded responses), with a sending-only key', async () => {
    await t.configure(t.projectA, 'SendNotification', [{ registryEntryId: ids['resend-email']!, binding: { from: 'PMI Studio <notify@acme.test>', apiBaseUrl: replay.url } }]).expect(200);
    await request(t.api).put(`/v1/projects/${t.projectA}/integrations/credentials/${ids['resend-email']}`).set('Cookie', t.cookie).send({ kind: 'resend-api-key', value: RESEND_KEY }).expect(204);
    realOutputs = await notifySuite('resend-email', 2);
    const sent = sendReplay.seen.filter((r) => r.method === 'POST' && r.path === '/emails');
    expect(sent).toHaveLength(2);
    expect(sent.every((r) => typeof r.headers['idempotency-key'] === 'string')).toBe(true);
  });

  it('both runs return the same contract shape', () => {
    const required = contractFor('SendNotification', 1)!.outputSchema.required ?? [];
    expect(Object.keys(shape(realOutputs[0]) as object).filter((k) => required.includes(k))).toEqual(Object.keys(shape(fixtureOutputs[0]) as object).filter((k) => required.includes(k)));
  });
});
