/**
 * `T2534` (EPIC-047 Convergence) — fan-out holds under concurrency, in
 * PostgreSQL.
 *
 * `FR-EXP-033`. Concurrent `addDelegateSession` calls under one parent, each on
 * its own connection-pool turn, must together stop at the bound: the parent's
 * row is locked for the count and the insert, so a second caller counts the
 * first caller's committed row.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import type { ExpertSession } from '../../src/modules/experts/expert.types.js';
import type { ExpertsStore } from '../../src/modules/experts/experts.store.js';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { expert, version } from '../helpers/expert-fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let container: StartedPostgreSqlContainer;
let store: ExpertsStore;
let disconnect: () => Promise<void>;

const row = (executionId: string, parent: string | null): ExpertSession => ({
  executionId, workspaceId: 'ws_1', expertId: 'ex_test', contractVersionId: 'cv_1', delegatedFromExecutionId: parent,
  actorId: 'u_1', depth: parent === null ? 0 : 1, model: 'm', usedFallback: false, fallbackReason: null,
  effectiveAuthority: { capabilities: [], tools: [], permissions: [], prohibitedActions: [] },
  toolObservation: 'unobserved', unattended: false, reviewRequired: false, outcome: null,
  startedAt: '2026-10-09T09:00:00.000Z', endedAt: null,
});

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const url = container.getConnectionUri();
  const db = new Client({ connectionString: url });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('ws_1','w',now())`);
  await db.end();
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: `${url}?connection_limit=8` } } });
  const { PrismaExpertsStore } = await import('../../src/modules/experts/experts.store.prisma.js');
  store = new PrismaExpertsStore(prisma as never);
  disconnect = () => prisma.$disconnect();
  await store.addExpert(expert());
  await store.addVersion(version());
  await store.addSession(row('root', null));
}, 600_000);

afterAll(async () => {
  await disconnect?.();
  await container?.stop();
}, 120_000);

suite('T2534 · PrismaExpertsStore.addDelegateSession', () => {
  it('six concurrent delegations under a bound of two: exactly two rows', async () => {
    const results = await Promise.all(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => store.addDelegateSession(row(id, 'root'), 2)),
    );
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await store.childrenOf('ws_1', 'root')).toHaveLength(2);
  });

  it('a parent in another workspace is not found, so nothing is inserted', async () => {
    expect(await store.addDelegateSession({ ...row('x', 'root'), workspaceId: 'ws_other' }, 5)).toBe(false);
  });
});
