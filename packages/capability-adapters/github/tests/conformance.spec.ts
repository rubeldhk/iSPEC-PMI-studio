/**
 * `T2156` (EPIC-039, `FR-HUB-060`, `R-039-9`) — `github-rest` passes the shared
 * conformance suite for all three read capabilities, over RECORDED responses
 * served through an injected `fetch` — never the network.
 *
 * Scenarios are injected as overlays on the recordings: a rate-limited
 * provider, a rejected credential, an unknown revision, a run still in
 * progress, an unreachable repository, a provider error.
 *
 * Written to FAIL before `T2157` and `T2159`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { capabilityConformanceSuite, type CapabilityConformanceHarness, type ConformanceScenario } from '@pmi/capability-contract/conformance';
import { Replay, type RecordedResponse, type Recording, type SeenRequest } from '@pmi/capability-contract/replay';
import { createCredentialHandle, type AdapterContext, type CapabilityAdapter, type CapabilityName } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { GitHubRestAdapter } from '../src/index.js';

const BASE = 'https://api.github.test';
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const DIR = new URL('./recordings/', import.meta.url);
const load = (name: string): Recording => JSON.parse(readFileSync(new URL(name, DIR), 'utf8')) as Recording;
const BASE_RECORDING = load('2026-10-10.github-rest.json');
const NON_FINAL = load('2026-10-10.github-rest.non-final.json');

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const APP_SECRET = JSON.stringify({ appId: '12345', installationId: '4242', privateKeyPem: PEM });

interface Rig {
  replay: Replay;
  scenario: ConformanceScenario | null;
}
const rigs = new WeakMap<CapabilityAdapter, Rig>();

function overlayFor(rig: Rig): (req: SeenRequest, recorded: RecordedResponse | null) => RecordedResponse | null {
  const nonFinal = new Map(NON_FINAL.interactions.map((i) => [`${i.request.method} ${i.request.path}`, i.response]));
  return (req, recorded) => {
    const isMint = req.path.startsWith('/app/installations/');
    switch (rig.scenario) {
      case 'throttled':
        return isMint ? recorded : { status: 403, headers: { 'x-ratelimit-remaining': '0', 'retry-after': '60' }, json: { message: 'API rate limit exceeded' } };
      case 'credential-rejected':
        return isMint ? { status: 401, json: { message: 'A JSON web token could not be decoded' } } : recorded;
      case 'revision-not-found':
        if (/\/commits\/[^/]+(\/check-runs.*)?$/.test(req.path.split('?')[0]!) || req.path.includes('/check-runs')) return { status: 422, json: { message: `No commit found for SHA: ${SHA}` } };
        return recorded;
      case 'non-final':
        return nonFinal.get(`${req.method} ${req.path}`) ?? recorded;
      case 'unhealthy':
        return req.path === '/repos/acme/widgets' ? { status: 404, json: { message: 'Not Found' } } : recorded;
      case 'provider-error':
        return isMint ? recorded : { status: 502, json: { message: 'Server Error' } };
      default:
        return recorded;
    }
  };
}

function make(): GitHubRestAdapter {
  const rig: Rig = { replay: undefined as unknown as Replay, scenario: null };
  rig.replay = new Replay([BASE_RECORDING], { overlay: (req, rec) => overlayFor(rig)(req, rec) });
  const adapter = new GitHubRestAdapter({ fetch: rig.replay.fetch(BASE), clock: () => new Date('2026-10-10T12:00:00Z') });
  rigs.set(adapter, rig);
  return adapter;
}

function context(adapter: CapabilityAdapter, capability: CapabilityName): AdapterContext {
  const granted = { ReadRepository: ['contents:read'], ReadBuildStatus: ['checks:read', 'statuses:read'], ReadTestResults: ['actions:read'], SendNotification: [], Embed: [] }[capability];
  return {
    workspaceId: 'ws',
    projectId: 'pr',
    binding: { repository: 'acme/widgets', apiBaseUrl: BASE },
    credential: createCredentialHandle(APP_SECRET, 'github-app-installation'),
    scope: { requested: { access: 'read', resources: [] }, granted, narrowing: 'exact' },
    signal: new AbortController().signal,
    timeoutMs: 10_000,
  };
}

const PERMISSION_OF: [RegExp, string | null][] = [
  [/^\/app\/installations\//, null],
  [/^\/repos\/acme\/widgets$/, null],
  [/\/check-runs/, 'checks:read'],
  [/\/commits\/[^/]+\/status$/, 'statuses:read'],
  [/\/actions\//, 'actions:read'],
  [/\/(commits|git\/trees|contents)\//, 'contents:read'],
];

function harness(capability: CapabilityName, validInput: () => unknown, supports: ConformanceScenario[]): CapabilityConformanceHarness {
  return {
    capability,
    adapter: make,
    context: (a) => context(a, capability),
    validInput,
    inject: (a, s) => {
      rigs.get(a)!.scenario = s;
    },
    supports,
    credentialSecret: PEM.split('\n')[1]!,
    requests: (a) => rigs.get(a)!.replay.seen.map((r) => ({ method: r.method, url: r.path, headers: r.headers })),
    permissionFor: (r) => {
      const hit = PERMISSION_OF.find(([re]) => re.test(r.url.split('?')[0]!));
      return hit === undefined ? 'unknown' : hit[1];
    },
  };
}

capabilityConformanceSuite('github-rest', harness('ReadRepository', () => ({ revision: 'main', mode: 'tree' }), ['throttled', 'credential-rejected', 'revision-not-found', 'unhealthy', 'provider-error']));
capabilityConformanceSuite('github-rest', harness('ReadBuildStatus', () => ({ revision: SHA }), ['throttled', 'credential-rejected', 'revision-not-found', 'non-final', 'unhealthy', 'provider-error']));
capabilityConformanceSuite('github-rest', harness('ReadTestResults', () => ({ revision: SHA }), ['throttled', 'credential-rejected', 'non-final', 'unhealthy', 'provider-error']));

describe('T2156 · github-rest specifics', () => {
  it('sends the REST API version header and never a credential in a URL', async () => {
    const a = make();
    await a.invoke({ ...context(a, 'ReadBuildStatus'), capability: 'ReadBuildStatus', contractVersion: '1.0', input: { revision: SHA } });
    const seen = rigs.get(a)!.replay.seen.filter((r) => !r.path.startsWith('/app/'));
    expect(seen.length).toBeGreaterThan(0);
    for (const r of seen) {
      expect(r.headers['x-github-api-version']).toBe('2022-11-28');
      expect(r.url).not.toMatch(/ghs_|token=/);
    }
  });

  it('rolls up check runs and statuses: all success → success, final', async () => {
    const a = make();
    const r = await a.invoke({ ...context(a, 'ReadBuildStatus'), capability: 'ReadBuildStatus', contractVersion: '1.0', input: { revision: SHA } });
    expect(r).toMatchObject({ ok: true, output: { state: 'success', final: true } });
    expect((r as { output: { checks: unknown[] } }).output.checks).toHaveLength(3);
  });

  it('reads files and names the missing ones', async () => {
    const a = make();
    const r = await a.invoke({ ...context(a, 'ReadRepository'), capability: 'ReadRepository', contractVersion: '1.0', input: { revision: SHA, mode: 'files', paths: ['README.md', 'missing.md'] } });
    expect(r).toMatchObject({ ok: true, output: { files: [{ path: 'README.md', encoding: 'utf8' }], missing: ['missing.md'] } });
  });

  it('reads JUnit results from the artifact: the failing test is named', async () => {
    const a = make();
    const r = await a.invoke({ ...context(a, 'ReadTestResults'), capability: 'ReadTestResults', contractVersion: '1.0', input: { revision: SHA } });
    expect(r).toMatchObject({ ok: true, output: { final: true, result: 'FAILED', suites: 2, source: { artifactName: 'test-results', format: 'junit-xml' } } });
    expect((r as { output: { failedTests: string[] } }).output.failedTests).toEqual(['widgets/math.spec.ts > refuses a negative']);
  });

  it('declares itself for all three reads, with a credential required', () => {
    const d = new GitHubRestAdapter().descriptor;
    expect(d.implements.map((i) => i.capability)).toEqual(['ReadRepository', 'ReadBuildStatus', 'ReadTestResults']);
    expect(d.credentialRequired).toBe(true);
    expect(d.credentialKinds).toEqual([{ kind: 'github-app-installation', narrowing: 'per-request' }, { kind: 'github-token', narrowing: 'none' }]);
  });

  it('the recordings are dated and say where they came from', () => {
    for (const f of readdirSync(DIR)) {
      expect(f).toMatch(/^\d{4}-\d{2}-\d{2}\./);
      expect(load(f).provenance.length).toBeGreaterThan(40);
    }
  });
});
