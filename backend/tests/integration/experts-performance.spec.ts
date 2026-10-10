/**
 * `T1984` (EPIC-047) — the performance targets of `R-047-15`, measured.
 *
 * Against PostgreSQL through the real store, because the costs that matter are
 * round trips: a dispatch check reads the Expert, its versions and the
 * approval; a delegation tree walks one query per node. Ports are in-test
 * bindings that answer at once, so what is measured is this Epic's own work —
 * the run itself and context assembly are excluded, as `R-047-15` states.
 *
 * | Operation | Target (p95) |
 * |---|---|
 * | Dispatch check (to the point the runner is called) | < 300 ms |
 * | Delegation tree of 156 sessions (depth 3 × fan-out 5) | < 500 ms |
 * | Contract version compare | < 200 ms |
 * | List 100 Experts (`GET /experts`'s service) | < 1.2 s |
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
import {
  accessFrom,
  contract,
  evidenceKnowing,
  expert,
  gatewaysFor,
  recordingApprovals,
  recordingContext,
  recordingExecutions,
  runner,
  version,
} from '../helpers/expert-fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let container: StartedPostgreSqlContainer;
let store: ExpertsStore;
let disconnect: () => Promise<void>;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
}

async function time(n: number, run: () => Promise<unknown>): Promise<number> {
  await run(); // warm
  const samples: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const start = performance.now();
    await run();
    samples.push(performance.now() - start);
  }
  return p95(samples);
}

const session = (executionId: string, parent: string | null, depth: number): ExpertSession => ({
  executionId, workspaceId: 'ws_1', expertId: 'ex_test', contractVersionId: 'cv_1', delegatedFromExecutionId: parent, actorId: 'u_1',
  depth, model: 'm', usedFallback: false, fallbackReason: null,
  effectiveAuthority: { capabilities: [], tools: [], permissions: [], prohibitedActions: [] },
  toolObservation: 'unobserved', unattended: false, reviewRequired: false, outcome: 'succeeded',
  startedAt: '2026-10-09T09:00:00.000Z', endedAt: '2026-10-09T09:01:00.000Z',
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
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const { PrismaExpertsStore } = await import('../../src/modules/experts/experts.store.prisma.js');
  store = new PrismaExpertsStore(prisma as never);
  disconnect = () => prisma.$disconnect();

  await store.addExpert(expert());
  await store.addVersion(version({ decisionId: 'd_ok' }));
  await store.addVersion(version({ id: 'cv_2', version: 2, contract: contract({ riskClass: 'high' }) }));
  for (let i = 0; i < 99; i += 1) {
    await store.addExpert(expert({ id: `ex_${i}`, key: `expert-${i}` }));
    await store.addVersion(version({ id: `cv_x${i}`, expertId: `ex_${i}`, decisionId: 'd_ok' }));
  }
  // Depth 3 × fan-out 5: 1 + 5 + 25 + 125 = 156 sessions.
  await store.addSession(session('root', null, 0));
  let level = ['root'];
  for (let depth = 1; depth <= 3; depth += 1) {
    const next: string[] = [];
    for (const parent of level) {
      for (let k = 0; k < 5; k += 1) {
        const id = `${parent}.${k}`;
        await store.addSession(session(id, parent, depth));
        next.push(id);
      }
    }
    level = next;
  }
}, 600_000);

afterAll(async () => {
  await disconnect?.();
  await container?.stop();
}, 120_000);

suite('T1984 · R-047-15 performance targets', () => {
  it('dispatch check p95 < 300 ms', async () => {
    const { DispatchService } = await import('../../src/modules/experts/dispatch.service.js');
    const approvals = recordingApprovals();
    approvals.resolve('d_ok', 'approved');
    // A runner that throws stops the dispatch exactly where the check ends.
    const stop = runner({}, async () => {
      throw new Error('stop here');
    });
    const service = new DispatchService(store, {
      access: accessFrom({ 'u_1:specification:sp_1': 'read' }),
      ports: {
        gateways: gatewaysFor({ 'claude-opus-5-5': [stop] }),
        approvals,
        evidence: evidenceKnowing('implementation@1'),
        context: recordingContext(),
        executions: { ...recordingExecutions(), register: async () => ({ executionId: `exe_${Math.random()}` }) },
      },
    });
    const ask = {
      expertId: 'ex_test', command: 'implement', objective: 'o', projectId: 'pr_1', capabilities: ['test'],
      tools: ['run-tests'], actions: [], targets: [{ artifactType: 'specification', artifactId: 'sp_1', action: 'read' as const }],
    };
    const measured = await time(20, () => service.dispatch({ workspaceId: 'ws_1', userId: 'u_1', role: 'engineer' }, ask).catch(() => undefined));
    expect(measured).toBeLessThan(300);
  });

  it('a 156-session delegation tree p95 < 500 ms', async () => {
    const { delegationTree } = await import('../../src/modules/experts/delegation.service.js');
    const tree = await delegationTree(store, 'ws_1', 'root');
    expect(tree.node.children).toHaveLength(5);
    expect(await time(10, () => delegationTree(store, 'ws_1', 'root'))).toBeLessThan(500);
  });

  it('contract version compare p95 < 200 ms', async () => {
    const { RegistryService } = await import('../../src/modules/experts/registry.service.js');
    const { Authoring } = await import('../../src/modules/experts/authoring.js');
    const service = new RegistryService(store, {
      authoring: new Authoring(accessFrom({ 'u_1:expert-registry:ws_1': 'read' })),
      approvals: recordingApprovals(),
      evidence: evidenceKnowing(),
    });
    expect(await time(20, () => service.compare('ws_1', 'u_1', 'ex_test', 1, 2))).toBeLessThan(200);
  });

  it('listing 100 Experts p95 < 1.2 s', async () => {
    const { RegistryService } = await import('../../src/modules/experts/registry.service.js');
    const { Authoring } = await import('../../src/modules/experts/authoring.js');
    const approvals = recordingApprovals();
    approvals.resolve('d_ok', 'approved');
    const service = new RegistryService(store, {
      authoring: new Authoring(accessFrom({ 'u_1:expert-registry:ws_1': 'read' })),
      approvals,
      evidence: evidenceKnowing(),
    });
    expect(await service.list('ws_1', 'u_1')).toHaveLength(100);
    expect(await time(5, () => service.list('ws_1', 'u_1'))).toBeLessThan(1200);
  });
});
