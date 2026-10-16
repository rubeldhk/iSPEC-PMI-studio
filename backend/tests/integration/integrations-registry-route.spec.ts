/**
 * `T2170` (EPIC-039, Constitution XI Tier 1, `SC-HUB-003`, `FR-HUB-072`,
 * quickstart Q3, Q15, Q16) — the registry through the REAL routes against
 * `AppModule`:
 *
 * - `GET /integrations/registry` lists `pmi-studio` first, and every lifecycle
 *   field of every entry is a value or *not applicable* with a reason;
 * - `GET /integrations/registry/:entryId` carries health history and recent
 *   resolutions with their explanations in one response;
 * - registering and retiring need the `EPIC-024` edit grant — a member without
 *   it gets `404`, never a confirmation;
 * - the capability routes list the five approved versions;
 * - health is checked by the job handler (the manual ticker), and a check older
 *   than the interval reads `unknown / stale`.
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rebootApp } from '../helpers/authenticated-app.js';
import { startIntegrationsApp, type IntegrationsApp } from '../helpers/integrations-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const SHA = 'a'.repeat(40);
const FACTS = ['provider', 'transport', 'version', 'compatibility', 'permissionScope', 'authorisation', 'configuration', 'health'] as const;

let t: IntegrationsApp;
let ci = '';

const get = (path: string, cookie = (): string => t.cookie) => request(t.api).get(`/v1${path}`).set('Cookie', cookie());

beforeAll(async () => {
  if (noRuntime) return;
  t = await startIntegrationsApp({ workspaceId: 'ws_reg', userId: 'u_reg' });
  ci = await t.register('fixture-ci');
  t.bindPolicy();
  await t.configure(t.projectA, 'ReadBuildStatus', [{ registryEntryId: ci }]).expect(200);
}, 600_000);

afterAll(async () => {
  await t?.stop();
}, 120_000);

function assertNeverBlank(entry: Record<string, unknown>): void {
  for (const field of FACTS) {
    const fact = entry[field] as { applicable?: unknown; value?: unknown; reason?: unknown } | undefined;
    expect(fact, `${String(entry['key'])}.${field}`).toBeDefined();
    if (fact!.applicable === true) expect(fact!.value, `${String(entry['key'])}.${field} value`).toBeDefined();
    else {
      expect(fact!.applicable, `${String(entry['key'])}.${field}`).toBe(false);
      expect(typeof fact!.reason === 'string' && (fact!.reason as string).length > 0, `${String(entry['key'])}.${field} reason`).toBe(true);
    }
  }
}

suite('T2170 · GET /integrations/registry (Q3, SC-HUB-003)', () => {
  it('lists pmi-studio first, then the surfaces, then registered adapters', async () => {
    const res = await get('/integrations/registry').expect(200);
    const keys = res.body.entries.map((e: { key: string }) => e.key);
    expect(keys[0]).toBe('pmi-studio');
    expect(keys).toEqual(expect.arrayContaining(['surface:ide-extension', 'surface:local-cli', 'surface:ci-cd', 'surface:managed-sandbox', 'fixture-ci']));
    expect(keys.indexOf('fixture-ci')).toBeGreaterThan(keys.indexOf('surface:managed-sandbox'));
    expect(res.body.omitted).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'surface:fixture' })]));
  });

  it('every field of every entry is a value or not-applicable with a reason — without a project', async () => {
    const res = await get('/integrations/registry').expect(200);
    for (const e of res.body.entries) assertNeverBlank(e);
    const fixture = res.body.entries.find((e: { key: string }) => e.key === 'fixture-ci');
    expect(fixture.configuration).toEqual({ applicable: false, reason: expect.stringContaining('no project selected') });
  });

  it('and with a project: configuration is a fact, and never a value', async () => {
    const res = await get(`/integrations/registry?projectId=${t.projectA}`).expect(200);
    for (const e of res.body.entries) assertNeverBlank(e);
    const fixture = res.body.entries.find((e: { key: string }) => e.key === 'fixture-ci');
    expect(fixture.configuration).toMatchObject({ applicable: true, value: { state: 'configured' } });
    expect(fixture.direction).toBe('outbound');
    expect(fixture.provider).toEqual({ applicable: true, value: 'fixture' });
  });

  it('a project in another workspace is 404', async () => {
    await get(`/integrations/registry?projectId=${t.foreignProject}`).expect(404);
  });
});

suite('T2170 · health through the job handler (Q15)', () => {
  it('reads unknown / never-checked before the first tick, healthy after it', async () => {
    const before = await get(`/integrations/registry?projectId=${t.projectA}`).expect(200);
    expect(before.body.entries.find((e: { key: string }) => e.key === 'fixture-ci').health).toMatchObject({ applicable: true, value: { state: 'unknown', reason: 'never-checked' } });
    await t.tick();
    const after = await get(`/integrations/registry?projectId=${t.projectA}`).expect(200);
    expect(after.body.entries.find((e: { key: string }) => e.key === 'fixture-ci').health).toMatchObject({ applicable: true, value: { state: 'healthy' } });
  });

  it('a check older than the interval reads unknown / stale — staleness is derived, never stored', async () => {
    // projectB has a configuration whose only check is an hour old.
    await t.configure(t.projectB, 'ReadBuildStatus', [{ registryEntryId: ci }]).expect(200);
    const old = new Date(Date.now() - 3_600_000);
    await t.sql(
      `INSERT INTO "integration_health_checks" ("id","workspaceId","projectId","registryEntryId","state","adapterVersion","source","checkedAt","durationMs") VALUES ($1,'ws_reg',$2,$3,'healthy','0.1.0','request',$4,1)`,
      [randomUUID(), t.projectB, ci, old],
    );
    const res = await get(`/integrations/registry?projectId=${t.projectB}`).expect(200);
    expect(res.body.entries.find((e: { key: string }) => e.key === 'fixture-ci').health).toMatchObject({ applicable: true, value: { state: 'unknown', reason: expect.stringMatching(/^stale/) } });
    await t.tick();
    const fresh = await get(`/integrations/registry?projectId=${t.projectB}`).expect(200);
    expect(fresh.body.entries.find((e: { key: string }) => e.key === 'fixture-ci').health.value.state).toBe('healthy');
  });
});

suite('T2170 · GET /integrations/registry/:entryId (FR-HUB-072)', () => {
  it('returns health history and recent resolutions, each refusal with its per-candidate explanation, in one response', async () => {
    // One resolved and one refused request, so both kinds are in the history.
    await request(t.api).post(`/v1/projects/${t.projectA}/capability-requests`).set('Cookie', t.cookie).send({ capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: { revision: SHA } }).expect(200);
    await t.configure(t.projectA, 'ReadBuildStatus', [{ registryEntryId: ci }], { permittedEnvironments: ['prod'] }).expect(200);
    const refused = await request(t.api).post(`/v1/projects/${t.projectA}/capability-requests`).set('Cookie', t.cookie).send({ capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: { revision: SHA } }).expect(200);
    expect(refused.body.outcome).toBe('refused');

    const res = await get(`/integrations/registry/${ci}?projectId=${t.projectA}`).expect(200);
    expect(res.body.entry).toMatchObject({ key: 'fixture-ci' });
    expect(res.body.healthHistory.length).toBeGreaterThan(0);
    expect(res.body.healthHistory[0]).toMatchObject({ state: 'healthy', source: 'scheduled' });
    const outcomes = res.body.resolutions.map((r: { outcome: string }) => r.outcome);
    expect(outcomes).toEqual(expect.arrayContaining(['resolved', 'refused']));
    const refusal = res.body.resolutions.find((r: { outcome: string }) => r.outcome === 'refused');
    expect(refusal.refusal.candidates).toEqual([expect.objectContaining({ entryKey: 'fixture-ci', ineligibleBecause: 'environment-not-permitted' })]);
    const resolved = res.body.resolutions.find((r: { outcome: string }) => r.outcome === 'resolved');
    expect(resolved.eligibleBecause).toContain('policy');
  });

  it('an inbound entry reads its facts and has no health history of its own', async () => {
    const list = await get('/integrations/registry').expect(200);
    const studio = list.body.entries[0];
    const res = await get(`/integrations/registry/${studio.id}`).expect(200);
    expect(res.body.entry.key).toBe('pmi-studio');
    expect(res.body.healthHistory).toEqual([]);
  });

  it('an unknown entry is 404', async () => {
    await get('/integrations/registry/nope').expect(404);
  });
});

suite('T2170 · registration and retirement need the edit grant (FR-HUB-029)', () => {
  it('a member without the grant gets 404 from POST and retire, and nothing changes', async () => {
    const other = await t.asUser('u_reg_other');
    await request(t.api).post('/v1/integrations/registry').set('Cookie', other).send({ key: 'fixture-git' }).expect(404);
    await request(t.api).post(`/v1/integrations/registry/${ci}/retire`).set('Cookie', other).expect(404);
    const list = await get('/integrations/registry').expect(200);
    expect(list.body.entries.map((e: { key: string }) => e.key)).not.toContain('fixture-git');
    expect(list.body.entries.find((e: { key: string }) => e.key === 'fixture-ci').status).toBe('active');
  });

  it('the creator registers, refuses a connector and an unknown key, and retires idempotently', async () => {
    await request(t.api).post('/v1/integrations/registry').set('Cookie', t.cookie).send({ key: 'pmi-studio' }).expect(400);
    await request(t.api).post('/v1/integrations/registry').set('Cookie', t.cookie).send({ key: 'no-such-adapter' }).expect(400);
    await request(t.api).post('/v1/integrations/registry').set('Cookie', t.cookie).send({ key: 'fixture-ci' }).expect(409);
    const git = await t.register('fixture-git');
    const first = await request(t.api).post(`/v1/integrations/registry/${git}/retire`).set('Cookie', t.cookie).expect(200);
    const again = await request(t.api).post(`/v1/integrations/registry/${git}/retire`).set('Cookie', t.cookie).expect(200);
    expect(first.body.status).toBe('retired');
    expect(again.body.audit.retiredAt).toBe(first.body.audit.retiredAt);
    const audit = await t.sql<{ action: string }>(`SELECT "action" FROM "audit_entries" WHERE "targetId" = $1 ORDER BY "occurredAt"`, [git]);
    expect(audit.map((a) => a.action)).toEqual(['create', 'lifecycle_transition']);
  });
});

suite('T2170 · the vocabulary (FR-HUB-003)', () => {
  it('lists the five approved v1 contracts', async () => {
    const res = await get('/integrations/capabilities').expect(200);
    expect(res.body.map((c: { name: string }) => c.name).sort()).toEqual(['Embed', 'ReadBuildStatus', 'ReadRepository', 'ReadTestResults', 'SendNotification']);
    expect(res.body.every((c: { status: string; version: string }) => c.status === 'approved' && c.version === '1.0')).toBe(true);
    expect(res.body.find((c: { name: string }) => c.name === 'Embed').scope).toBe('deployment');
  });

  it('returns one version in full, and 404 for one that does not exist', async () => {
    const res = await get('/integrations/capabilities/SendNotification/versions/1.0').expect(200);
    expect(res.body).toMatchObject({ name: 'SendNotification', status: 'approved', changesState: true });
    await get('/integrations/capabilities/SendNotification/versions/9.0').expect(404);
  });
});

suite('T2227 · a version the deployment changed is recorded at boot by system:catalog (FR-HUB-025)', () => {
  // The audit trail is what the boot compares with. Recording an older
  // observed version for fixture-ci stands in for "the previous deployment
  // ran 0.0.9"; the reboot then finds 0.1.0 in the catalog.
  it('one audit update with before/after on the reboot, and none on the next', async () => {
    await t.sql(
      `INSERT INTO "audit_entries" ("id","workspaceId","actorId","action","targetType","targetId","outcome","detail","occurredAt")
       VALUES ($1,'ws_reg','system:catalog','update','integration-registry-entry',$2,'success',$3::jsonb, now())`,
      [randomUUID(), ci, JSON.stringify({ key: 'fixture-ci', before: { version: '0.0.8' }, after: { version: '0.0.9' } })],
    );
    const changes = async () =>
      t.sql<{ detail: { before: { version: string }; after: { version: string } } }>(
        `SELECT "detail" FROM "audit_entries" WHERE "targetId" = $1 AND "actorId" = 'system:catalog' AND "action" = 'update' ORDER BY "occurredAt"`,
        [ci],
      );
    const first = await rebootApp(t.databaseUrl, { workspaceId: 'ws_reg', userId: 'u_reg' });
    await first.app.close();
    const after = await changes();
    expect(after.map((r) => r.detail)).toEqual([
      { key: 'fixture-ci', before: { version: '0.0.8' }, after: { version: '0.0.9' } },
      { key: 'fixture-ci', before: { version: '0.0.9' }, after: { version: '0.1.0' } },
    ]);
    const second = await rebootApp(t.databaseUrl, { workspaceId: 'ws_reg', userId: 'u_reg' });
    await second.app.close();
    expect(await changes()).toHaveLength(2);
  }, 300_000);
});
