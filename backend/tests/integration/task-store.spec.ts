/**
 * `T1324` (EPIC-041) — tasks survive the process that created them.
 *
 * `FR-LPW-041`, `R-041-7`. The `tasks` table has existed since EPIC-012 and the
 * composed application never wrote to it (PMI-DOC-004B §2.1). This drives
 * `PrismaTaskStore` against a real PostgreSQL through every `TaskStore` method,
 * including the one replacement path regeneration is allowed, and asserts the
 * EPIC-004 rule that another workspace's task is absent rather than forbidden.
 *
 * Written to FAIL before `T1325` exists.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { PrismaTaskStore } from '../../src/modules/tasks/tasks.store.prisma.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_tasks';
const OTHER = 'ws_other';
const SPEC = 'spec_1';
let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let store: PrismaTaskStore;
let seq = 0;
const row = (over: Record<string, unknown> = {}) => ({
  id: `t_${(seq += 1)}`,
  workspaceId: WS,
  specificationId: SPEC,
  description: `Task ${seq}`,
  status: 'not_started' as const,
  engineName: 'fixture',
  engineVersion: '1',
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
  for (const ws of [WS, OTHER]) {
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$1,now())`, [ws]);
  }
  await db.query(
    `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt") VALUES ('pr_1',$1,'P','u_1',now())`,
    [WS],
  );
  await db.query(
    `INSERT INTO "specifications" ("id","workspaceId","projectId","title","engineName","engineVersion","generatedAt","createdById","updatedById","updatedAt")
     VALUES ($1,$2,'pr_1','S','fixture','1',now(),'u_1','u_1',now())`,
    [SPEC, WS],
  );
  await db.end();
  prisma = new PrismaClient({ datasourceUrl: container.getConnectionUri() });
  store = new PrismaTaskStore(prisma.task);
}, 600_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
}, 120_000);

suite('T1324 · PrismaTaskStore', () => {
  it('creates many and lists them for the specification', async () => {
    const created = await store.createMany([row(), row()]);
    expect(created).toHaveLength(2);
    expect(created[0]!.createdAt).toBeInstanceOf(Date);
    const listed = await store.listForSpecification(WS, SPEC);
    expect(listed.map((t) => t.id)).toEqual(expect.arrayContaining(created.map((t) => t.id)));
  });

  it('finds by id, unscoped by design (the guard pattern, EPIC-004 F2)', async () => {
    const [t] = await store.createMany([row()]);
    expect(await store.findById(t!.id)).toMatchObject({ id: t!.id, status: 'not_started' });
    expect(await store.findById('nope')).toBeNull();
  });

  it('updates status within the workspace and refuses across it as not-found', async () => {
    const [t] = await store.createMany([row()]);
    const updated = await store.updateStatus(WS, t!.id, 'in_progress');
    expect(updated.status).toBe('in_progress');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(t!.updatedAt.getTime());
    await expect(store.updateStatus(OTHER, t!.id, 'done')).rejects.toThrow(/not found/i);
  });

  it('lists for several specifications at once', async () => {
    const listed = await store.listForSpecifications(WS, [SPEC, 'spec_none']);
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((t) => t.specificationId === SPEC)).toBe(true);
  });

  it('replaceForSpecification is the one sanctioned replacement path', async () => {
    const replaced = await store.replaceForSpecification(WS, SPEC, [row({ description: 'only one' })]);
    expect(replaced).toHaveLength(1);
    const listed = await store.listForSpecification(WS, SPEC);
    expect(listed.map((t) => t.description)).toEqual(['only one']);
  });

  it('exposes no delete', () => {
    // A store with no destructive operation cannot regress into one.
    expect((store as unknown as Record<string, unknown>)['delete']).toBeUndefined();
    expect((store as unknown as Record<string, unknown>)['remove']).toBeUndefined();
  });
});
