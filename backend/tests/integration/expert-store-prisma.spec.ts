/**
 * `T1911` (EPIC-047) — the PostgreSQL store behaves as the in-memory one does.
 *
 * The same promises as `T1907`, against the real schema: workspace scoping on
 * every read, a decision recorded once, a retirement kept as first written, an
 * assignment superseded once — and conflicts surfacing as `ConflictError`
 * rather than as a raw driver error a caller would have to recognise.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { ConflictError } from '../../src/core/errors.js';
import type { ExpertsStore } from '../../src/modules/experts/experts.store.js';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { contract, expert, version } from '../helpers/expert-fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let container: StartedPostgreSqlContainer;
let store: ExpertsStore;
let disconnect: () => Promise<void>;

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const url = container.getConnectionUri();
  const db = new Client({ connectionString: url });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  for (const ws of ['ws_1', 'ws_2']) {
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'w',now())`, [ws]);
  }
  await db.query(
    `INSERT INTO "tasks" ("id","workspaceId","description","engineName","engineVersion","updatedAt")
     VALUES ('t_1','ws_1','T','spec-kit','0.14.3',now())`,
  );
  await db.end();

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const { PrismaExpertsStore } = await import('../../src/modules/experts/experts.store.prisma.js');
  store = new PrismaExpertsStore(prisma as never);
  disconnect = () => prisma.$disconnect();
}, 600_000);

afterAll(async () => {
  await disconnect?.();
  await container?.stop();
}, 120_000);

suite('T1911 · PrismaExpertsStore', () => {
  it('round-trips an Expert and its contract, scoped by workspace', async () => {
    await store.addExpert(expert());
    await store.addVersion(version());
    expect((await store.findExpert('ws_1', 'ex_test'))?.key).toBe('test-engineer');
    expect((await store.findExpertByKey('ws_1', 'test-engineer'))?.id).toBe('ex_test');
    expect(await store.findExpert('ws_2', 'ex_test')).toBeNull();
    expect(await store.listExperts('ws_2')).toEqual([]);
    const [v] = await store.versionsFor('ws_1', 'ex_test');
    expect(v?.contract).toEqual(contract());
    expect(v?.decisionId).toBeNull();
    expect(await store.versionsFor('ws_2', 'ex_test')).toEqual([]);
  });

  it('a duplicate key is a ConflictError', async () => {
    await expect(store.addExpert(expert({ id: 'ex_dup' }))).rejects.toBeInstanceOf(ConflictError);
  });

  it('records a decision once', async () => {
    await store.recordDecision('ws_1', 'cv_1', 'd_1');
    await expect(store.recordDecision('ws_1', 'cv_1', 'd_2')).rejects.toBeInstanceOf(ConflictError);
    expect((await store.versionsFor('ws_1', 'ex_test'))[0]?.decisionId).toBe('d_1');
  });

  it('retires once, keeping who and when', async () => {
    await store.retireExpert('ws_1', 'ex_test', 'u_2', '2026-10-10T00:00:00.000Z');
    await store.retireExpert('ws_1', 'ex_test', 'u_3', '2026-10-11T00:00:00.000Z');
    const row = await store.findExpert('ws_1', 'ex_test');
    expect([row?.status, row?.retiredBy, row?.retiredAt]).toEqual(['retired', 'u_2', '2026-10-10T00:00:00.000Z']);
  });

  it('supersedes an assignment once', async () => {
    await store.addAssignment({
      id: 'as_1', workspaceId: 'ws_1', taskId: 't_1', assigneeKind: 'expert', assigneeId: 'ex_test',
      rule: 'capabilities cover the task', state: 'standing', decisionId: null,
      assignedBy: 'u_1', assignedAt: '2026-10-09T09:00:00.000Z', supersededAt: null, supersededBy: null,
    });
    await store.supersedeAssignment('ws_1', 'as_1', 'u_2', '2026-10-10T00:00:00.000Z');
    await expect(store.supersedeAssignment('ws_1', 'as_1', 'u_3', '2026-10-11T00:00:00.000Z')).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await store.assignmentsFor('ws_1', 't_1'))[0]?.supersededBy).toBe('u_2');
    expect(await store.assignmentsFor('ws_2', 't_1')).toEqual([]);
  });

  it('replaces the delegation policy whole', async () => {
    const policy = {
      workspaceId: 'ws_1', maxDepth: 3, maxFanOut: 5, allowedPairs: [{ from: 'a', to: '*' }],
      maxUnattendedBand: 'medium' as const, updatedBy: 'u_1', updatedAt: '2026-10-09T09:00:00.000Z',
    };
    await store.putPolicy(policy);
    await store.putPolicy({ ...policy, maxDepth: 2 });
    expect(await store.policyFor('ws_1')).toEqual({ ...policy, maxDepth: 2 });
    expect(await store.policyFor('ws_2')).toBeNull();
  });

  it('T2004 · a session keeps its originating actor, and ends once', async () => {
    const at = '2026-10-09T09:00:00.000Z';
    await store.addSession({
      executionId: 'exe_actor', workspaceId: 'ws_1', expertId: 'ex_test', contractVersionId: 'cv_1',
      delegatedFromExecutionId: null, actorId: 'u_1', depth: 0, model: 'm', usedFallback: false, fallbackReason: null,
      effectiveAuthority: { capabilities: [], tools: [], permissions: [], prohibitedActions: [] },
      toolObservation: 'unobserved', unattended: false, reviewRequired: false, outcome: null, startedAt: at, endedAt: null,
    });
    expect((await store.findSession('ws_1', 'exe_actor'))?.actorId).toBe('u_1');
    await expect(store.endSession('ws_1', 'exe_actor', { outcome: 'succeeded', endedAt: at })).resolves.toBe(true);
    await expect(store.endSession('ws_1', 'exe_actor', { outcome: 'stopped-by-parent', endedAt: at })).resolves.toBe(false);
    expect((await store.findSession('ws_1', 'exe_actor'))?.outcome).toBe('succeeded');
  });

  it('T2006 · concurrent charges to one limit both land, and only the crossing one says so', async () => {
    await store.putLimit({
      executionId: 'exe_actor', limit: 'tokens', value: 1000, requested: null, enforcement: 'unenforceable',
      consumed: null, consumedReason: 'not yet reported', reached: 'no', detectedAt: null,
    });
    const at = '2026-10-09T09:05:00.000Z';
    const charges = await Promise.all(
      Array.from({ length: 6 }, () => store.chargeLimit('ws_1', 'exe_actor', 'tokens', 200, at)),
    );
    expect(charges.filter((c) => c?.crossed)).toHaveLength(1);
    const row = (await store.limitsFor('ws_1', 'exe_actor')).find((l) => l.limit === 'tokens');
    expect(row).toMatchObject({ consumed: 1200, consumedReason: null, reached: 'detected-late', detectedAt: at });
    await store.noteUnreported('ws_1', 'exe_actor', 'tokens', 'unreported');
    expect((await store.limitsFor('ws_1', 'exe_actor')).find((l) => l.limit === 'tokens')?.consumedReason).toBeNull();
    expect(await store.chargeLimit('ws_2', 'exe_actor', 'tokens', 1, at)).toBeNull();
  });
});
