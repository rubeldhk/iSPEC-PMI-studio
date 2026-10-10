/**
 * T862f — the `R-032-7` performance targets, measured against PostgreSQL.
 *
 * | Measure | Target |
 * |---|---|
 * | evidence write | p95 < 60 ms |
 * | Contract evaluation at the gate, **50 items** | p95 < 150 ms |
 * | unmet-items query | p95 < 100 ms |
 * | rollup, **10,000 evidence items** in scope | p95 < 500 ms |
 *
 * Measured through the real Prisma repository and the real gate and service —
 * below HTTP, because the targets are the store's and the gate's, and the HTTP
 * stack's cost is not this Epic's to budget. The figures are printed so the
 * closing report records what was measured rather than that a test passed.
 *
 * Measured on the developer machine against a Testcontainers PostgreSQL; a
 * shared CI runner is noisier, so the thresholds are the targets themselves,
 * not tighter ones.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { PrismaEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_perf';
const TEST = predicateTypeFor('test-result');
const principal = { workspaceId: WS, userId: 'u1' };

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
}

async function time<T>(fn: () => Promise<T>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

const figures: Record<string, number> = {};

suite('T862f · R-032-7 — the evidence store meets its performance targets', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let svc: EvidenceService;
  let gate: CompletionGate;
  let repository: PrismaEvidenceRepository;

  const fiftyItems = {
    workClass: 'fifty',
    contractVersion: 1,
    items: Array.from({ length: 50 }, (_, i) => ({
      itemId: `item-${i}`,
      description: `item ${i}`,
      acceptingPredicateTypes: [`${TEST}#${i}`.replace('#', '/item-')],
    })),
  };
  const twenty = {
    workClass: 'twenty',
    contractVersion: 1,
    items: Array.from({ length: 20 }, (_, i) => ({
      itemId: `t-${i}`,
      description: `t ${i}`,
      acceptingPredicateTypes: [TEST],
    })),
  };

  const contribution = (workId: string, predicateType: string) => ({
    attestation: {
      _type: 'https://in-toto.io/Statement/v1',
      subject: [{ name: 'a', digest: { gitCommit: 'd'.repeat(40) } }],
      predicateType,
      predicate: { result: 'PASSED' },
    },
    attestedArtifact: { id: 'a1', version: 1 },
    attachedTo: { type: 'task', id: workId },
    producedAt: '2026-10-07T00:00:00Z',
    source: { uri: 'pmi:perf' },
    projectId: 'p_perf',
  });

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'perf',now())`, [WS]);

    // The 10,000-item rollup scope, bulk-loaded: 500 pieces of work × 20 items.
    await db.query(
      `INSERT INTO "work_evidence_bindings" ("id","workspaceId","projectId","workRefType","workRefId","workClass",
         "contractVersion","subjectArtifactType","subjectArtifactId","subjectVersion")
       SELECT 'wb_' || g, $1, 'p_rollup', 'task', 'R-' || g, 'twenty', 1, 'file', 'a1', 1 FROM generate_series(1, 500) g`,
      [WS],
    );
    await db.query(
      `INSERT INTO "evidence_items" ("id","workspaceId","projectId","type","attestsArtifactId","attestsArtifactVersion",
         "source","producedAt","integrityValid","subjectDigest","subjectName","storage","payload","integrity",
         "attachedToType","attachedToId")
       SELECT 'ev_' || g, $1, 'p_rollup', $2, 'a1', 1, 'pmi:perf', now(), true,
              '{"gitCommit":"dddd"}', 'a', 'stored', '{"predicate":{"result":"PASSED"}}',
              '{"algorithm":"sha256","value":"x"}', 'task', 'R-' || (1 + (g % 500))
       FROM generate_series(1, 10000) g`,
      [WS, TEST],
    );
    await db.end();

    prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
    repository = new PrismaEvidenceRepository(prisma);
    const catalog = ContractCatalog.fromDefinitions([fiftyItems, twenty]);
    gate = new CompletionGate(repository, catalog, null);
    svc = new EvidenceService(repository, catalog, gate, { canRead: async () => true }, null);

    await svc.bind(principal, {
      workRef: { type: 'task', id: 'G-50' },
      workClass: 'fifty',
      projectId: 'p_perf',
      subject: { type: 'file', id: 'a1', version: 1 },
    });
    for (const item of fiftyItems.items) {
      await svc.contribute(principal, contribution('G-50', item.acceptingPredicateTypes[0]!));
    }
  }, 600_000);

  afterAll(async () => {
    console.log('[T862f] measured p95 (ms):', JSON.stringify(figures));
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('writes evidence at p95 < 60 ms', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 100; i += 1) samples.push(await time(() => svc.contribute(principal, contribution('W', TEST))));
    figures['write'] = p95(samples);
    expect(figures['write']).toBeLessThan(60);
  }, 120_000);

  it('evaluates a 50-item Contract at the gate at p95 < 150 ms', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 50; i += 1) {
      samples.push(await time(() => gate.evaluate(WS, { type: 'task', id: 'G-50' })));
    }
    const evaluation = await gate.evaluate(WS, { type: 'task', id: 'G-50' });
    expect(evaluation.evaluated && evaluation.status.satisfied).toBe(true);
    figures['evaluate50'] = p95(samples);
    expect(figures['evaluate50']).toBeLessThan(150);
  }, 120_000);

  it('answers the unmet query at p95 < 100 ms', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 50; i += 1) samples.push(await time(() => svc.unmet(principal, { type: 'task', id: 'G-50' })));
    figures['unmet'] = p95(samples);
    expect(figures['unmet']).toBeLessThan(100);
  }, 120_000);

  it('rolls up 10,000 evidence items at p95 < 500 ms', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 10; i += 1) samples.push(await time(() => svc.rollup(principal, 'p_rollup')));
    const rollup = await svc.rollup(principal, 'p_rollup');
    expect(rollup.inFlight).toBe(500);
    figures['rollup10k'] = p95(samples);
    expect(figures['rollup10k']).toBeLessThan(500);
  }, 600_000);
});
