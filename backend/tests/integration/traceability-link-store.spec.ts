/**
 * `T1324` (EPIC-041, extended) — traceability links survive the process that wrote them.
 *
 * `FR-LPW-041`, `R-041-7`. Found by `T1383`: the composed application's link
 * store was in memory, so `/trace` answered `requirementIds: []` for a
 * specification the database showed linked to every requirement. This drives
 * `PrismaTraceabilityLinkStore` through every `TraceabilityLinkStore` method
 * against a real PostgreSQL, including the append-only refusal of a duplicate.
 *
 * Written to FAIL before the store exists.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { PrismaTraceabilityLinkStore } from '../../src/modules/traceability/traceability-link.store.prisma.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_links';
let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let store: PrismaTraceabilityLinkStore;
let seq = 0;
const link = (over: Record<string, unknown> = {}) => ({
  id: `l_${(seq += 1)}`,
  workspaceId: WS,
  sourceType: 'specification' as const,
  sourceId: 'spec_1',
  targetType: 'requirement' as const,
  targetId: `req_${seq}`,
  relationship: 'generated_from' as const,
  createdAt: new Date(),
  ...over,
});

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const db = new Client({ connectionString: container.getConnectionUri() });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  await db.query(`INSERT INTO "organizations" ("id","name","updatedAt") VALUES ('org_default','Default',now()) ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'links',now())`, [WS]);
  await db.end();
  prisma = new PrismaClient({ datasourceUrl: container.getConnectionUri() });
  store = new PrismaTraceabilityLinkStore(prisma.traceabilityLink);
}, 600_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
}, 120_000);

suite('T1324 · PrismaTraceabilityLinkStore', () => {
  it('appends and reads back by source, by target and by workspace', async () => {
    const a = await store.append(link());
    const b = await store.append(link({ sourceId: 'spec_2' }));
    expect((await store.bySource(WS, 'specification', 'spec_1')).map((l) => l.id)).toContain(a.id);
    expect((await store.byTarget(WS, 'requirement', b.targetId)).map((l) => l.id)).toEqual([b.id]);
    expect((await store.linksForWorkspace(WS)).length).toBeGreaterThanOrEqual(2);
    expect(await store.linksForWorkspace('ws_other')).toEqual([]);
  });

  it('answers exists() for the five-part key and refuses an identical append', async () => {
    const l = link();
    await store.append(l);
    expect(await store.exists(l)).toBe(true);
    await expect(store.append({ ...l, id: 'dup' })).rejects.toThrow(/already exists/);
  });

  it('exposes no delete', () => {
    expect((store as unknown as Record<string, unknown>)['delete']).toBeUndefined();
    expect((store as unknown as Record<string, unknown>)['remove']).toBeUndefined();
  });
});
