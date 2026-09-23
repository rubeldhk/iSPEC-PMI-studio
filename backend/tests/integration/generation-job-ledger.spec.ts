/**
 * `T1328` (EPIC-041) — the job ledger reads and writes the real `generation_jobs`.
 *
 * `FR-LPW-041`, `R-041-7`. `PrismaGenerationJobLedger` must satisfy both
 * interfaces the specifications module composes on one token: `JobStore`
 * (`findLive`, `create` — what `JobsService.submit` needs) and
 * `GenerationJobLedger` (`findById`, `listForProject`, `updateState` — what the
 * run path and the read surface need). Over the same rows as `PrismaJobStore`,
 * so a job the API created is the job the worker claims.
 *
 * Written to FAIL before `T1329` exists.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { PrismaGenerationJobLedger } from '../../src/modules/specifications/generation-job.ledger.prisma.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_ledger';
let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let ledger: PrismaGenerationJobLedger;

const request = (over: Record<string, unknown> = {}) => ({
  workspaceId: WS,
  projectId: 'pr_1',
  kind: 'generate_specification' as const,
  requestedById: 'u_1',
  engineName: 'fixture',
  engineVersion: '1',
  correlationId: 'corr-1',
  inputRefs: { requirementIds: ['r1'] },
  jobKey: `key_${Math.random().toString(36).slice(2)}`,
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
  await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'ledger',now())`, [WS]);
  await db.query(
    `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt") VALUES ('pr_1',$1,'P','u_1',now())`,
    [WS],
  );
  await db.end();
  prisma = new PrismaClient({ datasourceUrl: container.getConnectionUri() });
  ledger = new PrismaGenerationJobLedger(prisma.generationJob);
}, 600_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
}, 120_000);

suite('T1328 · PrismaGenerationJobLedger', () => {
  it('creates a queued job and finds it live by key', async () => {
    const req = request();
    const created = await ledger.create(req);
    expect(created.state).toBe('queued');
    expect(await ledger.findLive('pr_1', req.jobKey)).toMatchObject({ id: created.id });
  });

  it('reads the job view back with its inputs', async () => {
    const created = await ledger.create(request());
    const view = await ledger.findById(created.id);
    expect(view).toMatchObject({ id: created.id, workspaceId: WS, projectId: 'pr_1', state: 'queued', resultRef: null });
    expect(view!.createdAt).toBeInstanceOf(Date);
  });

  it('lists a project\'s jobs newest first', async () => {
    const a = await ledger.create(request());
    const b = await ledger.create(request());
    const ids = (await ledger.listForProject(WS, 'pr_1')).map((j) => j.id);
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id));
  });

  it('updates state, stamps startedAt once, and records resultRef', async () => {
    const created = await ledger.create(request());
    const running = await ledger.updateState(created.id, { state: 'running', startedAt: new Date('2026-09-03T10:00:00Z') });
    expect(running.state).toBe('running');
    const done = await ledger.updateState(created.id, { state: 'succeeded', endedAt: new Date(), resultRef: 'spec_9' });
    expect(done.resultRef).toBe('spec_9');
    expect(done.startedAt?.toISOString()).toBe('2026-09-03T10:00:00.000Z');
  });

  it('a finished job is no longer live — a retry creates a new one', async () => {
    const req = request();
    const created = await ledger.create(req);
    await ledger.updateState(created.id, { state: 'running' });
    await ledger.updateState(created.id, { state: 'failed', failureReason: 'engine_error', endedAt: new Date() });
    expect(await ledger.findLive('pr_1', req.jobKey)).toBeNull();
  });
});
