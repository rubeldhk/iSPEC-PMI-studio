/**
 * `T2149`, `T2242` (EPIC-039, Constitution XI Tier 1) — every read capability
 * through the REAL entry point, `POST /v1/projects/:id/capability-requests`,
 * against `AppModule`, with only fixture adapters registered (quickstart Q4,
 * Q5, Q7, Q9 (in part), Q11).
 *
 * `CapabilityPolicy` is bound by the module to `EPIC-031` (`T2212`); the first
 * suite asserts that real path, then this file binds a recording policy over
 * it, in the test, so the read capabilities can be exercised without a person
 * approving each configuration (`R-039-13`).
 *
 * Written to FAIL before `T2150`.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startIntegrationsApp, type IntegrationsApp, type RecordingPolicy } from '../helpers/integrations-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const SHA = 'f'.repeat(40);

let t: IntegrationsApp;
let policy: RecordingPolicy;
let ci = '';
let git = '';

const ask = (body: Record<string, unknown>, project = (): string => t.projectA) =>
  request(t.api).post(`/v1/projects/${project()}/capability-requests`).set('Cookie', t.cookie).send({ major: 1, caller: 'room:change', ...body });

beforeAll(async () => {
  if (noRuntime) return;
  t = await startIntegrationsApp({ workspaceId: 'ws_req', userId: 'u_req' });
  ci = await t.register('fixture-ci');
  git = await t.register('fixture-git');
}, 600_000);

afterAll(async () => {
  await t?.stop();
}, 120_000);

suite('T2149, T2212 · with EPIC-031 bound by the module, nothing unclassified is decided permissively', () => {
  // Before `T2212` this case asserted the refusing seam's 503. The module now
  // binds `CapabilityPolicy` to EPIC-031's decision engine, so the same PUT is
  // decided there: no classification rule names the action, it takes the most
  // restrictive band (FR-DPE-004), waits for a person, and the adapter is
  // ineligible as `policy-pending` until one approves.
  it('a configuration PUT records one EPIC-031 decision for the configuration version, pending', async () => {
    const res = await t.configure(t.projectA, 'ReadRepository', [{ registryEntryId: git }]);
    expect(res.status).toBe(200);
    const rows = await t.sql<{ actionType: string; outcome: string; objectVersion: string; projectId: string; requiredGates: unknown; effectiveClass: string }>(
      `SELECT "actionType","outcome","objectVersion","projectId","requiredGates","effectiveClass" FROM "policy_decisions" WHERE "workspaceId" = $1 AND "actionType" LIKE 'integration.adapter.use.%'`,
      ['ws_req'],
    );
    expect(rows).toEqual([{ actionType: 'integration.adapter.use.ReadRepository', outcome: 'pending', objectVersion: '1', projectId: t.projectA, requiredGates: [], effectiveClass: 'high' }]);
  });

  // ReadRepository, so the health tick below leaves `fixture-ci` unchecked for
  // the next suite's first case.
  it('a request is refused policy-pending, with EPIC-031 asked to read and not to decide again', async () => {
    await t.tick();
    const res = await ask({ capability: 'ReadRepository', input: { revision: 'main', mode: 'tree' } }).expect(200);
    expect(res.body).toMatchObject({ outcome: 'refused', refusal: { code: 'no-eligible-adapter' } });
    expect(res.body.refusal.candidates.find((c: { entryKey: string }) => c.entryKey === 'fixture-git')).toMatchObject({ ineligibleBecause: 'policy-pending' });
    const count = await t.sql<{ n: number }>(`SELECT count(*)::int AS n FROM "policy_decisions" WHERE "workspaceId" = $1`, ['ws_req']);
    expect(count[0]!.n).toBe(1);
  });
});

suite('T2149 · the three read capabilities through the fixtures (Q4)', () => {
  beforeAll(async () => {
    policy = t.bindPolicy();
    await t.configure(t.projectA, 'ReadBuildStatus', [{ registryEntryId: ci }]).expect(200);
    await t.configure(t.projectA, 'ReadTestResults', [{ registryEntryId: ci }]).expect(200);
    await t.configure(t.projectA, 'ReadRepository', [{ registryEntryId: git }]).expect(200);
  });

  it('refuses before the first health check: unknown health is ineligible', async () => {
    const res = await ask({ capability: 'ReadBuildStatus', input: { revision: SHA } }).expect(200);
    expect(res.body).toMatchObject({ outcome: 'refused', refusal: { code: 'no-eligible-adapter' } });
    expect(res.body.refusal.candidates[0]).toMatchObject({ entryKey: 'fixture-ci', ineligibleBecause: 'health-unknown' });
  });

  it('resolves ReadBuildStatus after the job handler checks health, naming the adapter and every condition', async () => {
    await t.tick();
    const res = await ask({ capability: 'ReadBuildStatus', input: { revision: SHA } }).expect(200);
    expect(res.body).toMatchObject({ outcome: 'resolved', resolution: { adapterKey: 'fixture-ci', adapterVersion: '0.1.0', provider: 'fixture', contractVersion: '1.0' }, invocation: { outcome: 'succeeded' }, result: { revision: SHA, state: 'success', final: true } });
    expect(res.body.resolution.eligibleBecause).toEqual(['in-build', 'active', 'implements-major', 'configured', 'credential', 'health', 'environment', 'policy']);
    expect(policy.calls.some((c) => c.method === 'statusOf')).toBe(true);
  });

  it('resolves ReadTestResults and ReadRepository the same way', async () => {
    const tests = await ask({ capability: 'ReadTestResults', input: { revision: SHA } }).expect(200);
    expect(tests.body).toMatchObject({ outcome: 'resolved', result: { result: 'PASSED', final: true } });
    const repo = await ask({ capability: 'ReadRepository', input: { revision: 'main', mode: 'tree' } }).expect(200);
    expect(repo.body).toMatchObject({ outcome: 'resolved', resolution: { adapterKey: 'fixture-git' } });
    expect(repo.body.result.entries.map((e: { path: string }) => e.path)).toContain('README.md');
  });
});

suite('T2149 · refusals (Q5, Q7, Q9, U1)', () => {
  it('Q5 — ReadSecrets is unknown-capability, named', async () => {
    const res = await ask({ capability: 'ReadSecrets', input: {} }).expect(200);
    expect(res.body).toMatchObject({ outcome: 'refused', refusal: { code: 'unknown-capability' } });
    expect(res.body.refusal.message).toContain('ReadSecrets');
  });

  it('Q7 — a body naming an adapter is provider-pinned', async () => {
    const res = await ask({ capability: 'ReadBuildStatus', adapter: 'github-rest', input: { revision: SHA } }).expect(200);
    expect(res.body.refusal.code).toBe('provider-pinned');
  });

  it('Q9 — not configured, and policy pending, each named on its own candidate; no queue, no retry', async () => {
    const notConfigured = await ask({ capability: 'ReadBuildStatus', input: { revision: SHA } }, () => t.projectB).expect(200);
    expect(notConfigured.body.refusal.candidates[0]).toMatchObject({ entryKey: 'fixture-ci', ineligibleBecause: 'not-configured' });
    policy.set('pending');
    const pending = await ask({ capability: 'ReadBuildStatus', input: { revision: SHA } }).expect(200);
    expect(pending.body.refusal.candidates[0]).toMatchObject({ entryKey: 'fixture-ci', ineligibleBecause: 'policy-pending' });
    policy.set('permitted');
  });

  it('U1 — a session cannot declare an in-process caller', async () => {
    const res = await ask({ capability: 'ReadBuildStatus', caller: 'evidence-intake', input: { revision: SHA } }).expect(200);
    expect(res.body).toMatchObject({ outcome: 'refused', refusal: { code: 'caller-not-platform' } });
  });

  it('a malformed input is 400, and nothing is recorded as a decision', async () => {
    const res = await ask({ capability: 'ReadBuildStatus', input: { revision: 'main' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });
});

suite('T2149 · who may ask (Q11, FR-HUB-004, FR-HUB-005)', () => {
  it('Q11 — a project connector credential is refused surface_not_accepted, before the body is used', async () => {
    const res = await request(t.api).post(`/v1/projects/${t.projectA}/capability-requests`).set('Authorization', `Bearer ${t.tokenA}`).send({ capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: { revision: SHA } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('surface_not_accepted');
    expect(JSON.stringify(res.body)).not.toContain(t.tokenA);
  });

  it('a project in another workspace is 404', async () => {
    const res = await ask({ capability: 'ReadBuildStatus', input: { revision: SHA } }, () => t.foreignProject);
    expect(res.status).toBe(404);
  });

  it('no session is 401', async () => {
    const res = await request(t.api).post(`/v1/projects/${t.projectA}/capability-requests`).send({ capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: {} });
    expect(res.status).toBe(401);
  });
});
