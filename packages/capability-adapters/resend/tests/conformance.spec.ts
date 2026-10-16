/**
 * `T2189` (EPIC-039, `US6`, `FR-HUB-060`, `R-039-9`) — `resend-email` passes the
 * shared conformance suite for `SendNotification` over RECORDED responses served
 * through an injected `fetch` — never the network.
 *
 * - `POST /emails` carries `Idempotency-Key` (CC-10);
 * - the health probe `GET /domains`: `401 restricted_api_key` reads *healthy,
 *   `narrowed-at-issue`* (a sending-only key), `200` reads *healthy,
 *   `not-narrowable`* (a full-access key), any other `401` reads
 *   `credential-rejected`;
 * - `429` with `retry-after` → `provider-throttled` with the hint.
 *
 * Written to FAIL before `T2190`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { capabilityConformanceSuite, type ConformanceScenario } from '@pmi/capability-contract/conformance';
import { Replay, type RecordedResponse, type Recording, type SeenRequest } from '@pmi/capability-contract/replay';
import { createCredentialHandle, type AdapterContext, type CapabilityAdapter } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { RESEND_DESCRIPTOR, ResendEmailAdapter } from '../src/index.js';

const BASE = 'https://api.resend.test';
const KEY = 're_test_0123456789abcdefghijklmnopqrstuv';
const DIR = new URL('./recordings/', import.meta.url);
const load = (name: string): Recording => JSON.parse(readFileSync(new URL(name, DIR), 'utf8')) as Recording;
const SEND_ONLY = load('2026-10-10.resend-email.json');
const FULL_ACCESS = load('2026-10-10.resend-email.full-access.json');

interface Rig {
  replay: Replay;
  scenario: ConformanceScenario | null;
}
const rigs = new WeakMap<CapabilityAdapter, Rig>();

function overlay(rig: Rig): (req: SeenRequest, recorded: RecordedResponse | null) => RecordedResponse | null {
  return (_req, recorded) => {
    switch (rig.scenario) {
      case 'throttled':
        return { status: 429, headers: { 'retry-after': '2' }, json: { statusCode: 429, name: 'rate_limit_exceeded', message: 'Too many requests.' } };
      case 'credential-rejected':
      case 'unhealthy':
        return { status: 401, json: { statusCode: 401, name: 'validation_error', message: 'API key is invalid' } };
      case 'provider-error':
        return { status: 500, json: { statusCode: 500, name: 'internal_server_error', message: 'An unexpected error occurred.' } };
      default:
        return recorded;
    }
  };
}

function make(recordings: Recording[] = [SEND_ONLY]): ResendEmailAdapter {
  const rig: Rig = { replay: undefined as unknown as Replay, scenario: null };
  rig.replay = new Replay(recordings, { overlay: (req, rec) => overlay(rig)(req, rec) });
  const adapter = new ResendEmailAdapter({ fetch: rig.replay.fetch(BASE) });
  rigs.set(adapter, rig);
  return adapter;
}

function context(_a: CapabilityAdapter): AdapterContext {
  return {
    workspaceId: 'ws',
    projectId: 'pr',
    binding: { from: 'PMI Studio <notify@acme.test>', apiBaseUrl: BASE },
    credential: createCredentialHandle(KEY, 'resend-api-key'),
    scope: { requested: { access: 'write', resources: ['notification.send'] }, granted: ['emails:send'], narrowing: 'narrowed-at-issue' },
    signal: new AbortController().signal,
    timeoutMs: 10_000,
  };
}

const INPUT = { recipients: [{ address: 'reviewer@example.test' }], subject: 'Build finished', body: { text: 'The build finished.' }, idempotencyKey: 'notif-42' };

capabilityConformanceSuite('resend-email', {
  capability: 'SendNotification',
  adapter: () => make(),
  context,
  validInput: () => ({ ...INPUT }),
  inject: (a, s) => {
    rigs.get(a)!.scenario = s;
  },
  supports: ['throttled', 'credential-rejected', 'unhealthy', 'provider-error'],
  credentialSecret: KEY,
  requests: (a) => rigs.get(a)!.replay.seen.map((r) => ({ method: r.method, url: r.path, headers: r.headers })),
  permissionFor: (r) => (r.method === 'POST' && r.url === '/emails' ? 'emails:send' : r.url === '/domains' ? null : 'unknown'),
  idempotencyKeysSeen: (a) => rigs.get(a)!.replay.seen.map((r) => r.headers['idempotency-key']).filter((k): k is string => typeof k === 'string'),
});

describe('T2189 · resend-email specifics', () => {
  it('POST /emails carries the key as a bearer, Idempotency-Key, and the contract input as Resend fields', async () => {
    const a = make();
    const r = await a.invoke({ ...context(a), capability: 'SendNotification', contractVersion: '1.0', input: INPUT });
    expect(r).toMatchObject({ ok: true, output: { delivered: true, providerMessageId: '4ef9a417-02e9-4d39-ad75-9611e0fcc33c' } });
    const [sent] = rigs.get(a)!.replay.seen;
    expect(sent!.headers['idempotency-key']).toBe('notif-42');
    expect(sent!.headers['authorization']).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(sent!.body!)).toEqual({ from: 'PMI Studio <notify@acme.test>', to: ['reviewer@example.test'], subject: 'Build finished', text: 'The build finished.' });
    expect(sent!.url).not.toContain(KEY);
  });

  it('GET /domains → 401 restricted_api_key reads healthy, narrowed-at-issue (a sending-only key)', async () => {
    const a = make();
    expect(await a.checkHealth(context(a))).toEqual({ state: 'healthy', narrowing: 'narrowed-at-issue' });
  });

  it('GET /domains → 200 reads healthy, not-narrowable (a full-access key)', async () => {
    const a = make([FULL_ACCESS]);
    expect(await a.checkHealth(context(a))).toEqual({ state: 'healthy', narrowing: 'not-narrowable' });
  });

  it('any other 401 reads credential-rejected, and the detail holds no key', async () => {
    const a = make();
    rigs.get(a)!.scenario = 'credential-rejected';
    const h = await a.checkHealth(context(a));
    expect(h).toMatchObject({ state: 'unhealthy', reason: 'credential-rejected' });
    expect(JSON.stringify(h)).not.toContain(KEY);
  });

  it('429 with retry-after → provider-throttled with the hint, and health degraded', async () => {
    const a = make();
    rigs.get(a)!.scenario = 'throttled';
    expect(await a.invoke({ ...context(a), capability: 'SendNotification', contractVersion: '1.0', input: INPUT })).toMatchObject({ ok: false, errorCategory: 'provider-throttled', retryAfterSeconds: 2 });
    expect(await a.checkHealth(context(a))).toMatchObject({ state: 'degraded', reason: 'provider-throttled', retryAfterSeconds: 2 });
  });

  it('without a from address in the binding it refuses before calling Resend', async () => {
    const a = make();
    const r = await a.invoke({ ...context(a), binding: { apiBaseUrl: BASE }, capability: 'SendNotification', contractVersion: '1.0', input: INPUT });
    expect(r).toMatchObject({ ok: false, errorCategory: 'adapter-fault' });
    expect(rigs.get(a)!.replay.seen).toEqual([]);
  });

  it('declares SendNotification with an at-issue key and a required credential', () => {
    expect(RESEND_DESCRIPTOR).toMatchObject({ key: 'resend-email', provider: 'resend', transport: 'native-api', credentialRequired: true, credentialKinds: [{ kind: 'resend-api-key', narrowing: 'at-issue' }] });
    expect(RESEND_DESCRIPTOR.implements).toEqual([{ capability: 'SendNotification', majors: [1] }]);
  });

  it('the recordings are dated and say where they came from', () => {
    for (const f of readdirSync(DIR)) {
      expect(f).toMatch(/^\d{4}-\d{2}-\d{2}\./);
      expect(load(f).provenance.length).toBeGreaterThan(40);
    }
  });
});
