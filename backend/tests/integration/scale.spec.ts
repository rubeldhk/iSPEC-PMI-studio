/**
 * T147 — SC-009: listing, search, and traceability views return in under
 * 1 second at the 95th percentile with 500 specifications in one project
 * (quantified 2026-08-07).
 *
 * A mocked repository would pass while the real one degrades — so this seeds
 * 500 specifications (each with a version and traceability links) into a real
 * PostgreSQL via Testcontainers and measures the REAL store code paths:
 * `PrismaSpecificationStore.listForProject`, `.findScoped` (the search
 * candidate source), and `.findIdsForRequirement` (the traceability read).
 *
 * RAID R-04: needs a container runtime; skipped loudly by name where none.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import {
  PrismaSpecificationStore,
  type SpecificationDelegates,
} from '../../src/modules/specifications/specifications-read.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const SPECS = 500;
const REQUIREMENTS = 50;
const SAMPLES = 40;
const P95_LIMIT_MS = 1000;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

async function measure(fn: () => Promise<unknown>): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  return samples;
}

suite('T147 · SC-009 — p95 under 1s with 500 specifications in one project', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let store: PrismaSpecificationStore;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();

    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }

    // ------------------------------------------------------------- seed
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('ws_scale','Scale',now())`);
    await db.query(
      `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
       VALUES ('u_scale','ws_scale','scale@example.test','Scale','$argon2id$probe',now())`,
    );
    await db.query(
      `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
       VALUES ('p_scale','ws_scale','Scale probe','u_scale',now())`,
    );
    await db.query(
      `INSERT INTO "requirements"
         ("id","workspaceId","projectId","reference","description","type","priority","contentHash","updatedAt")
       SELECT 'req_'||i,'ws_scale','p_scale','REQ-'||lpad(i::text,3,'0'),
              'The system shall satisfy requirement '||i,'functional','p1','hash_'||i,now()
       FROM generate_series(1,${REQUIREMENTS}) AS s(i)`,
    );
    // 500 specifications, each with a current version and 2 requirement links.
    await db.query(
      `INSERT INTO "specifications"
         ("id","workspaceId","projectId","title","engineName","engineVersion","generatedAt","createdById","updatedAt","updatedById")
       SELECT 's_'||i,'ws_scale','p_scale','Specification '||i||' — settlement path '||i,
              'fixture','1.0.0',now(),'u_scale',now() - (i||' seconds')::interval,'u_scale'
       FROM generate_series(1,${SPECS}) AS s(i)`,
    );
    await db.query(
      `INSERT INTO "specification_versions"
         ("id","workspaceId","specificationId","versionNumber","contentRaw","contentParsed","lifecycleStateAtCreation","authoredById")
       SELECT 'sv_'||i,'ws_scale','s_'||i,1,
              '# Specification '||i||E'\\n\\nThe system shall settle batch '||i||' in one transaction.',
              '{}','draft','u_scale'
       FROM generate_series(1,${SPECS}) AS s(i)`,
    );
    await db.query(
      `UPDATE "specifications" SET "currentVersionId"='sv_'||substring("id" from 3) WHERE "workspaceId"='ws_scale'`,
    );
    await db.query(
      `INSERT INTO "traceability_links"
         ("id","workspaceId","sourceType","sourceId","targetType","targetId","relationship")
       SELECT 'tl_'||i||'_'||j,'ws_scale','specification','s_'||i,'requirement','req_'||(((i+j) % ${REQUIREMENTS})+1),'derived_from'
       FROM generate_series(1,${SPECS}) AS s(i), generate_series(0,1) AS t(j)`,
    );
    await db.end();

    prisma = new PrismaClient({ datasources: { db: { url } } });
    const delegates = {
      specification: prisma.specification,
      specificationVersion: prisma.specificationVersion,
      generationJob: prisma.generationJob,
      traceabilityLink: prisma.traceabilityLink,
    } as unknown as SpecificationDelegates;
    store = new PrismaSpecificationStore(delegates, (fn) =>
      prisma.$transaction((tx) => fn(tx as unknown as SpecificationDelegates)),
    );
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('seeded the full volume — the measurement is at 500, not at whatever survived', async () => {
    const { total } = await store.listForProject('ws_scale', 'p_scale', { offset: 0, limit: 1 });
    expect(total).toBe(SPECS);
  });

  it(`listing: p95 < ${P95_LIMIT_MS}ms for a page of 20 with total count`, { timeout: 120_000 }, async () => {
    const samples = await measure(() =>
      store.listForProject('ws_scale', 'p_scale', { offset: 200, limit: 20 }),
    );
    expect(p95(samples)).toBeLessThan(P95_LIMIT_MS);
  });

  it(`search: p95 < ${P95_LIMIT_MS}ms to load and scan all 500 candidates with content`, { timeout: 120_000 }, async () => {
    const samples = await measure(async () => {
      const candidates = await store.findScoped('ws_scale', 'p_scale');
      // The matcher's work rides the same clock: this is the view's real cost.
      return candidates.filter(
        (c) => c.specification.title.includes('settlement') || c.content.includes('batch 42'),
      );
    });
    expect(p95(samples)).toBeLessThan(P95_LIMIT_MS);
  });

  it(`traceability: p95 < ${P95_LIMIT_MS}ms to resolve a requirement's derived specifications`, { timeout: 120_000 }, async () => {
    const samples = await measure(async () => {
      // Sweep different requirements so a warm row cache cannot flatter the number.
      for (let r = 1; r <= 5; r++) {
        await store.findIdsForRequirement('ws_scale', `req_${r}`);
      }
    });
    expect(p95(samples)).toBeLessThan(P95_LIMIT_MS);
  });
});
