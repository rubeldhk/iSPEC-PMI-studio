/**
 * `T2124`, `T2244` (EPIC-039) — the database refuses what the services refuse.
 *
 * Raw SQL, around the services: a service is one caller, and "a resolution can
 * never be rewritten" is a claim about what can exist in the database at all.
 * Prisma's migration planning treats hand-written triggers and CHECKs as
 * extras a later `migrate dev` may drop silently; this file is what turns such
 * a drop into a red suite.
 *
 * Written to FAIL before `T2125`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_hub';
let container: StartedPostgreSqlContainer;
let db: Client;
let seq = 0;
const id = (p: string): string => `${p}_${(seq += 1)}`;

async function insert(table: string, row: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
  const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
  await db.query(`INSERT INTO "${table}" (${cols}) VALUES (${params})`, Object.values(row));
}

async function entry(key = id('k')): Promise<string> {
  const rid = id('re');
  await insert('integration_registry_entries', { id: rid, workspaceId: WS, key, direction: 'outbound', status: 'active', listedOrder: seq, registeredBy: 'u_1', registeredAt: new Date() });
  return rid;
}

async function resolution(over: Record<string, unknown> = {}): Promise<string> {
  const rid = id('res');
  await insert('capability_resolutions', {
    id: rid,
    workspaceId: WS,
    scope: 'project',
    projectId: 'pr_1',
    caller: 'room:change',
    actorPrincipalId: 'u_1',
    capability: 'ReadBuildStatus',
    requestedMajor: 1,
    outcome: 'refused',
    refusalCode: 'no-eligible-adapter',
    reasons: JSON.stringify({ candidates: [] }),
    decidedAt: new Date(),
    ...over,
  });
  return rid;
}

async function health(entryId: string, over: Record<string, unknown> = {}): Promise<void> {
  await insert('integration_health_checks', {
    id: id('hc'),
    workspaceId: WS,
    projectId: 'pr_1',
    registryEntryId: entryId,
    state: 'healthy',
    adapterVersion: '0.1.0',
    source: 'request',
    checkedAt: new Date(),
    durationMs: 3,
    ...over,
  });
}

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  db = new Client({ connectionString: container.getConnectionUri() });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'hub',now())`, [WS]);
  await db.query(`INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt") VALUES ('u_1',$1,'u1@example.test','U','x',now())`, [WS]);
  await db.query(`INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt") VALUES ('pr_1',$1,'P','u_1',now())`, [WS]);
}, 300_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
}, 120_000);

suite('T2124 · the decision tables are append-only (reject_mutation)', () => {
  it('capability_resolutions refuses UPDATE and DELETE', async () => {
    const r = await resolution();
    await expect(db.query(`UPDATE "capability_resolutions" SET "outcome" = 'resolved' WHERE "id" = $1`, [r])).rejects.toThrow(/append-only/);
    await expect(db.query(`DELETE FROM "capability_resolutions" WHERE "id" = $1`, [r])).rejects.toThrow(/append-only/);
  });

  it('capability_invocations refuses UPDATE and DELETE', async () => {
    const r = await resolution({ outcome: 'resolved', refusalCode: null, adapterKey: 'fixture-ci', contractVersion: '1.0' });
    await insert('capability_invocations', { resolutionId: r, workspaceId: WS, projectId: 'pr_1', outcome: 'succeeded', durationMs: 5, endedAt: new Date() });
    await expect(db.query(`UPDATE "capability_invocations" SET "outcome" = 'failed' WHERE "resolutionId" = $1`, [r])).rejects.toThrow(/append-only/);
    await expect(db.query(`DELETE FROM "capability_invocations" WHERE "resolutionId" = $1`, [r])).rejects.toThrow(/append-only/);
  });

  it('integration_health_checks refuses UPDATE and DELETE', async () => {
    const e = await entry();
    await health(e);
    await expect(db.query(`UPDATE "integration_health_checks" SET "state" = 'unhealthy' WHERE "registryEntryId" = $1`, [e])).rejects.toThrow(/append-only/);
    await expect(db.query(`DELETE FROM "integration_health_checks" WHERE "registryEntryId" = $1`, [e])).rejects.toThrow(/append-only/);
  });

  it('deployment_capability_bindings refuses UPDATE and DELETE (I1 — the boot record)', async () => {
    await insert('deployment_capability_bindings', { id: 'dcb_1', capability: 'Embed', providerBinding: '{}', reindexRequired: false, health: 'unhealthy', reason: 'not-bound', observedBy: 'system:deployment-config', observedAt: new Date() });
    await expect(db.query(`UPDATE "deployment_capability_bindings" SET "health" = 'healthy' WHERE "id" = 'dcb_1'`)).rejects.toThrow(/append-only/);
    await expect(db.query(`DELETE FROM "deployment_capability_bindings" WHERE "id" = 'dcb_1'`)).rejects.toThrow(/append-only/);
  });

  it('notification_deliveries are immutable after insert', async () => {
    const r = await resolution({ capability: 'SendNotification' });
    await insert('notification_deliveries', { id: 'nd_1', workspaceId: WS, projectId: 'pr_1', cause: '{"kind":"decision-waiting","ref":"d1"}', recipients: ['a@example.test'], resolutionId: r, outcome: 'refused' });
    await expect(db.query(`UPDATE "notification_deliveries" SET "outcome" = 'delivered' WHERE "id" = 'nd_1'`)).rejects.toThrow(/append-only/);
  });
});

suite('T2124 · the vocabulary: approved contract versions are write-once', () => {
  it('seeds the five v1 contracts as approved', async () => {
    const rows = await db.query(`SELECT "name","major","minor","status","scope","changesState" FROM "capability_contract_versions" ORDER BY "name"`);
    expect(rows.rows.map((r) => `${r.name}@${r.major}.${r.minor}:${r.status}:${r.scope}:${r.changesState}`)).toEqual([
      'Embed@1.0:approved:deployment:false',
      'ReadBuildStatus@1.0:approved:project:false',
      'ReadRepository@1.0:approved:project:false',
      'ReadTestResults@1.0:approved:project:false',
      'SendNotification@1.0:approved:project:true',
    ]);
  });

  it('refuses any change to an approved row except status → retired', async () => {
    await expect(db.query(`UPDATE "capability_contract_versions" SET "changesState" = true WHERE "name" = 'ReadRepository'`)).rejects.toThrow(/immutable/);
    await expect(db.query(`DELETE FROM "capability_contract_versions" WHERE "name" = 'ReadRepository'`)).rejects.toThrow(/immutable/);
    await db.query(`UPDATE "capability_contract_versions" SET "status" = 'retired' WHERE "name" = 'ReadRepository'`);
    await expect(db.query(`UPDATE "capability_contract_versions" SET "status" = 'approved' WHERE "name" = 'ReadRepository'`)).rejects.toThrow(/immutable/);
  });

  it('(name, major, minor) is unique', async () => {
    await expect(
      db.query(`INSERT INTO "capability_contract_versions" ("id","name","scope","major","minor","status","document","inputSchema","outputSchema","errorCategories","requiredScope","changesState","createdBy") SELECT 'x', "name","scope","major","minor",'draft',"document","inputSchema","outputSchema","errorCategories","requiredScope","changesState",'u' FROM "capability_contract_versions" WHERE "name" = 'Embed'`),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});

suite('T2124 · keys, scopes and credentials', () => {
  it('(workspaceId, key) is unique in the registry', async () => {
    await entry('github-rest');
    await expect(entry('github-rest')).rejects.toThrow(/unique|duplicate/i);
  });

  it('a project-scope resolution without projectId or workspaceId violates the CHECK; a deployment one needs neither', async () => {
    await expect(resolution({ projectId: null })).rejects.toThrow(/check/i);
    await expect(resolution({ workspaceId: null })).rejects.toThrow(/check/i);
    await expect(resolution({ scope: 'deployment', workspaceId: null, projectId: null, capability: 'Embed', caller: 'context-assembly' })).resolves.toBeDefined();
  });

  it('one credential per (project, adapter); projectId is required (I1 — no deployment credential in v1)', async () => {
    const e = await entry();
    const row = { workspaceId: WS, projectId: 'pr_1', registryEntryId: e, kind: 'fixture-token', ciphertext: Buffer.from('c'), iv: Buffer.alloc(12), authTag: Buffer.alloc(16), keyId: 'k1', setBy: 'u_1', setAt: new Date() };
    await insert('integration_credentials', { id: id('cr'), ...row });
    await expect(insert('integration_credentials', { id: id('cr'), ...row })).rejects.toThrow(/unique|duplicate/i);
    await expect(insert('integration_credentials', { id: id('cr'), ...row, projectId: null, registryEntryId: await entry() })).rejects.toThrow(/null/i);
  });

  it('a non-healthy check must carry a reason', async () => {
    const e = await entry();
    await expect(health(e, { state: 'unhealthy' })).rejects.toThrow(/check/i);
  });
});

suite('T2244 (analysis U2) · the health lease: one RECORDED scheduled check per pair per interval', () => {
  it('a second scheduled row for the same pair and bucket is a no-op under ON CONFLICT DO NOTHING', async () => {
    const e = await entry();
    const write = async (): Promise<number> => {
      const r = await db.query(
        `INSERT INTO "integration_health_checks" ("id","workspaceId","projectId","registryEntryId","state","adapterVersion","source","intervalBucket","checkedAt","durationMs")
         VALUES ($1,$2,'pr_1',$3,'healthy','0.1.0','scheduled',42,now(),4) ON CONFLICT DO NOTHING`,
        [id('hc'), WS, e],
      );
      return r.rowCount ?? 0;
    };
    expect(await write()).toBe(1);
    expect(await write()).toBe(0);
  });

  it('request observations are not constrained by the lease', async () => {
    const e = await entry();
    await health(e, { state: 'degraded', reason: 'provider-throttled', source: 'request' });
    await health(e, { state: 'degraded', reason: 'provider-throttled', source: 'request' });
    const n = await db.query(`SELECT count(*)::int AS n FROM "integration_health_checks" WHERE "registryEntryId" = $1`, [e]);
    expect(n.rows[0].n).toBe(2);
  });

  it('a scheduled row must carry its bucket', async () => {
    const e = await entry();
    await expect(health(e, { source: 'scheduled' })).rejects.toThrow(/check/i);
  });
});
