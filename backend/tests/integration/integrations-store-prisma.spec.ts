/**
 * `T2129` (EPIC-039) — the behaviour `integrations-store.spec.ts` asserts of the
 * in-memory store, against PostgreSQL: scoping, append-only decisions, the
 * credential view without ciphertext, the U2 lease, and the round trips the
 * services rely on.
 *
 * Written to FAIL before `T2130`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaIntegrationsStore } from '../../src/modules/integrations/integrations.store.prisma.js';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_store';
let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let store: PrismaIntegrationsStore;
const now = new Date('2026-10-10T12:00:00Z');

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const db = new Client({ connectionString: container.getConnectionUri() });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  for (const ws of [WS, 'ws_other']) await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'w',now())`, [ws]);
  await db.query(`INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt") VALUES ('u_1',$1,'s@example.test','U','x',now())`, [WS]);
  await db.query(`INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt") VALUES ('p',$1,'P','u_1',now())`, [WS]);
  await db.end();
  prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
  store = new PrismaIntegrationsStore(prisma);
}, 300_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
}, 120_000);

suite('T2129 · the vocabulary', () => {
  it('reads the five seeded contracts', async () => {
    expect((await store.listContracts()).map((c) => `${c.name}@${c.major}.${c.minor}:${c.status}`)).toEqual([
      'Embed@1.0:approved',
      'ReadBuildStatus@1.0:approved',
      'ReadRepository@1.0:approved',
      'ReadTestResults@1.0:approved',
      'SendNotification@1.0:approved',
    ]);
  });
});

suite('T2129 · scoping and the registry', () => {
  it('scopes every read to its workspace and keeps retirement one way', async () => {
    const e = await store.createEntry({ workspaceId: WS, key: 'fixture-ci', direction: 'outbound', listedOrder: 10, registeredBy: 'u_1', registeredAt: now });
    expect(await store.findEntry('ws_other', e.id)).toBeNull();
    expect(await store.listEntries('ws_other')).toEqual([]);
    const retired = await store.retireEntry(WS, e.id, 'u_1', now);
    expect(retired).toMatchObject({ status: 'retired', retiredBy: 'u_1' });
    expect(await store.retireEntry(WS, e.id, 'u_2', now)).toMatchObject({ retiredBy: 'u_1' });
    await expect(store.listEntries('')).rejects.toThrow(/workspace scope/i);
  });

  it('upserts a configuration and increments its version', async () => {
    const e = await store.createEntry({ workspaceId: WS, key: 'fixture-git', direction: 'outbound', listedOrder: 11, registeredBy: 'u_1', registeredAt: now });
    const base = { workspaceId: WS, projectId: 'p', capability: 'ReadRepository', adapters: [{ registryEntryId: e.id, preference: 1 }], permitDegraded: false, permittedEnvironments: ['local'], onNotNarrowable: 'proceed-and-record' as const, healthIntervalSeconds: 300, providerBinding: { [e.id]: { repository: 'o/r' } }, decisionId: 'd1', updatedBy: 'u_1' };
    expect((await store.putConfiguration(base)).configVersion).toBe(1);
    const second = await store.putConfiguration({ ...base, decisionId: 'd2' });
    expect(second).toMatchObject({ configVersion: 2, decisionId: 'd2', providerBinding: { [e.id]: { repository: 'o/r' } } });
    expect(await store.getConfiguration('ws_other', 'p', 'ReadRepository')).toBeNull();
    expect((await store.listActiveConfigurations(10)).map((c) => c.capability)).toContain('ReadRepository');
  });
});

suite('T2129 · credentials: the status view never carries ciphertext', () => {
  it('round-trips through the vault port and reads status without it', async () => {
    const e = await store.createEntry({ workspaceId: WS, key: 'github-rest', direction: 'outbound', listedOrder: 12, registeredBy: 'u_1', registeredAt: now });
    await store.vaultPort().putCredentialRow({ workspaceId: WS, projectId: 'p', registryEntryId: e.id, kind: 'github-token', ciphertext: Buffer.from('sealed'), iv: Buffer.alloc(12, 1), authTag: Buffer.alloc(16, 2), keyId: 'k1', setBy: 'u_1', setAt: now });
    const status = await store.credentialStatus(WS, 'p', e.id);
    expect(Object.keys(status!).sort()).toEqual(['id', 'kind', 'projectId', 'registryEntryId', 'setAt', 'setBy', 'workspaceId']);
    const row = await store.vaultPort().readCredentialRow(WS, 'p', e.id);
    expect(row!.ciphertext.toString()).toBe('sealed');
    expect(await store.vaultPort().deleteCredentialRow(WS, 'p', e.id)).toBe(true);
    expect(await store.credentialStatus(WS, 'p', e.id)).toBeNull();
  });
});

suite('T2129 · decisions are appended, never changed', () => {
  it('appends a resolution and one invocation; a second invocation is refused by the key', async () => {
    const r = await store.appendResolution({ workspaceId: WS, scope: 'project', projectId: 'p', caller: 'room:change', actorPrincipalId: 'u_1', executionId: null, capability: 'ReadBuildStatus', requestedMajor: 1, contractVersion: '1.0', outcome: 'resolved', refusalCode: null, registryEntryId: null, adapterKey: 'fixture-ci', adapterVersion: '0.1.0', provider: 'fixture', modelIdentity: null, scopeGranted: { granted: ['x'] }, reasons: { rule: 'only-eligible', candidates: [{ entryKey: 'fixture-ci' }] }, decidedAt: now });
    await store.appendInvocation({ resolutionId: r.id, workspaceId: WS, projectId: 'p', outcome: 'succeeded', errorCategory: null, providerRequestId: null, retryAfterSeconds: null, durationMs: 4, endedAt: now });
    await expect(store.appendInvocation({ resolutionId: r.id, workspaceId: WS, projectId: 'p', outcome: 'failed', errorCategory: 'timed-out', providerRequestId: null, retryAfterSeconds: null, durationMs: 4, endedAt: now })).rejects.toThrow();
    expect((await store.findInvocation(r.id))!.outcome).toBe('succeeded');
    expect((await store.listResolutions(WS, { projectId: 'p' }))[0]!.id).toBe(r.id);
    expect(await store.findResolution('ws_other', r.id)).toBeNull();
  });

  it('a deployment-scope resolution needs no workspace (Embed — I1)', async () => {
    const r = await store.appendResolution({ workspaceId: null, scope: 'deployment', projectId: null, caller: 'context-assembly', actorPrincipalId: 'system:context-assembly', executionId: null, capability: 'Embed', requestedMajor: 1, contractVersion: '1.0', outcome: 'resolved', refusalCode: null, registryEntryId: null, adapterKey: 'fixture-embed', adapterVersion: '0.1.0', provider: 'fixture', modelIdentity: { model: 'fixture-letters', version: '1', dimension: 27 }, scopeGranted: null, reasons: {}, decidedAt: now });
    expect((await store.findResolution(null, r.id))!.modelIdentity).toEqual({ model: 'fixture-letters', version: '1', dimension: 27 });
  });

  it('finds an entry\'s refusals by its key among the evaluated candidates', async () => {
    const e = (await store.findEntryByKey(WS, 'fixture-ci'))!;
    await store.appendResolution({ workspaceId: WS, scope: 'project', projectId: 'p', caller: 'room:change', actorPrincipalId: 'u_1', executionId: null, capability: 'ReadBuildStatus', requestedMajor: 1, contractVersion: null, outcome: 'refused', refusalCode: 'no-eligible-adapter', registryEntryId: null, adapterKey: null, adapterVersion: null, provider: null, modelIdentity: null, scopeGranted: null, reasons: { rule: 'no-eligible-adapter', candidates: [{ entryKey: 'fixture-ci', firstFailure: 'retired' }] }, decidedAt: new Date(now.getTime() + 1000) });
    const rows = await store.listResolutions(WS, { registryEntryId: e.id });
    expect(rows.map((r) => r.outcome)).toEqual(['refused', 'resolved']);
  });
});

suite('T2129 · health and the U2 lease', () => {
  it('reads the latest check, and records one scheduled check per bucket', async () => {
    const e = (await store.findEntryByKey(WS, 'fixture-git'))!;
    await store.appendCheck({ workspaceId: WS, projectId: 'p', registryEntryId: e.id, state: 'degraded', reason: 'provider-throttled', retryAfterSeconds: 30, adapterVersion: '0.1.0', source: 'request', checkedAt: now, durationMs: 0 });
    expect(await store.latestCheck(WS, 'p', e.id)).toMatchObject({ state: 'degraded', retryAfterSeconds: 30, source: 'request', intervalBucket: null });
    const row = { workspaceId: WS, projectId: 'p', registryEntryId: e.id, state: 'healthy' as const, adapterVersion: '0.1.0', checkedAt: new Date(now.getTime() + 5000), durationMs: 2, intervalBucket: 5 };
    expect(await store.recordScheduledCheck(row)).toBe(true);
    expect(await store.recordScheduledCheck(row)).toBe(false);
    expect(await store.latestCheck(WS, 'p', e.id)).toMatchObject({ state: 'healthy', source: 'scheduled', intervalBucket: 5 });
    expect(await store.latestCheck('ws_other', 'p', e.id)).toBeNull();
  });
});

suite('T2129 · intake, deliveries and the deployment record', () => {
  it('creates, updates and finds due intakes', async () => {
    const i = await store.createIntake({ workspaceId: WS, projectId: 'p', workRef: { type: 'task', id: 't1' }, contractItemId: 'item', capability: 'ReadTestResults', revision: 'a'.repeat(40), attestedArtifact: { id: 'art', version: '1' }, state: 'pending', reason: null, resolutionIds: [], attestationId: null, attempts: 0, nextAttemptAt: null, giveUpAt: new Date(now.getTime() + 1800_000), requestedBy: 'u_1' });
    expect((await store.listDueIntakes(now, 10)).map((x) => x.id)).toContain(i.id);
    const u = await store.updateIntake(WS, i.id, { attempts: 1, resolutionIds: ['r1'], nextAttemptAt: new Date(now.getTime() + 120_000) });
    expect(u).toMatchObject({ attempts: 1, resolutionIds: ['r1'] });
    expect((await store.listDueIntakes(now, 10)).map((x) => x.id)).not.toContain(i.id);
  });

  it('appends deliveries and deployment observations', async () => {
    await store.appendDelivery({ workspaceId: WS, projectId: 'p', cause: { kind: 'decision-waiting', ref: 'd' }, recipients: ['a@example.test'], resolutionId: null, outcome: 'refused', providerMessageId: null, failureReason: 'credential-material-in-content' });
    expect((await store.listDeliveries(WS, 'p'))[0]).toMatchObject({ outcome: 'refused', recipients: ['a@example.test'] });
    await store.appendObservation({ capability: 'Embed', adapterKey: 'fixture-embed', providerBinding: {}, observedModel: { model: 'fixture-letters', version: '1', dimension: 27 }, modelId: 'fixture-embed:fixture-letters@1', previousModelId: null, reindexRequired: true, health: 'healthy', reason: null, observedBy: 'system:deployment-config', observedAt: now });
    expect(await store.latestObservation('Embed')).toMatchObject({ modelId: 'fixture-embed:fixture-letters@1', reindexRequired: true });
  });
});
