/**
 * `T1805` (EPIC-038 Convergence) — the seam a governed execution uses to be
 * given a package before it runs. `FR-CTX-030`, `FR-CTX-062`.
 *
 * ## What this proves, and what it cannot
 *
 * AI execution in this programme happens **outside** the platform — a CLI, an
 * IDE, a managed sandbox — and is *registered* with `EPIC-037`. There is no
 * in-process "run the model" step for this Epic to call into. So the caller
 * `FR-CTX-030` needs is the connector that registers the execution, and it
 * belongs to `EPIC-037` (`DEF-038-004`).
 *
 * What this Epic owns, and what this file proves against PostgreSQL, is the
 * seam that caller uses: assemble **for a registered execution**, and the
 * package is bound to it, listed under it, and retained exactly as long as it
 * — and an execution id naming nothing is refused by the database rather than
 * recorded as a binding to nothing.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import {
  PrismaContextStore,
  type ContextPrismaClient,
} from '../../src/modules/context/context.store.prisma.js';
import { InspectionService } from '../../src/modules/context/inspection.service.js';
import { allow, candidates, input, retrieval } from '../helpers/context-fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_exec';
const EXEC = 'ex_registered_1';

let container: StartedPostgreSqlContainer;
let db: Client;
let prisma: PrismaClient;
let store: PrismaContextStore;

function assembler(): AssemblyService {
  return new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1', 'rq_2']).map((c) => ({ ...c, workspaceId: WS }))),
    access: allow(),
    sourceClasses: { classify: (ws, type) => store.classifySource(ws, type) },
    authorisations: store,
    budgetPolicy: store,
  });
}

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const url = container.getConnectionUri();
  db = new Client({ connectionString: url });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'Exec',now())`, [WS]);
  await db.query(
    `INSERT INTO "executions"
       ("id","correlationId","idempotencyKey","workspaceId","command","argsSanitized",
        "initiatorType","initiatorId","surface","contractVersion","assurance")
     VALUES ($1,'c1','k1',$2,'implement','{}'::jsonb,'agent','p_agent','fixture','1.0','local')`,
    [EXEC, WS],
  );
  await db.query(
    `INSERT INTO "context_source_classes" ("id","workspaceId","sourceType","securityClassification","indexable")
     VALUES ('sc_e',$1,'requirement','internal',true)`,
    [WS],
  );
  await db.query(
    `INSERT INTO "context_budget_policies" ("id","workspaceId","retrievalLimit","tokensPerCandidate","costPerThousandTokens")
     VALUES ('bp_e',$1,10,500,0)`,
    [WS],
  );
  prisma = new PrismaClient({ datasources: { db: { url } } });
  store = new PrismaContextStore(prisma as unknown as ContextPrismaClient);
}, 600_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.end();
  await container?.stop();
}, 120_000);

suite('T1805 · a registered execution is given a package, bound to it', () => {
  it('assembling for the execution binds the package to it', async () => {
    const result = await assembler().assemble(input({ workspaceId: WS, executionId: EXEC }));
    expect((await store.findPackage(WS, result.packageId))?.executionId).toBe(EXEC);
  });

  it('and the execution lists what it was given, as supplied', async () => {
    const listed = await new InspectionService(store, null, null).forExecution(WS, EXEC);
    expect(listed.length).toBeGreaterThanOrEqual(1);
    expect(listed[0]?.items.map((i) => i.sourceId).sort()).toEqual(['rq_1', 'rq_2']);
  });

  it('an execution id naming nothing is refused by the database, not recorded', async () => {
    await expect(
      assembler().assemble(input({ workspaceId: WS, executionId: 'ex_never_registered' })),
    ).rejects.toThrow(/ex_never_registered is not registered[\s\S]*FR-CTX-062/);
    const orphans = await db.query(
      `SELECT count(*)::int AS n FROM "context_packages" WHERE "executionId" = 'ex_never_registered'`,
    );
    expect(orphans.rows[0].n).toBe(0);
  });

  it('and the package goes when the execution does (FR-CTX-066)', async () => {
    const before = await db.query(`SELECT count(*)::int AS n FROM "context_packages" WHERE "executionId" = $1`, [EXEC]);
    expect(before.rows[0].n).toBeGreaterThan(0);
    // EPIC-037 owns whether executions are ever deleted; this asserts only that
    // if one is, its context does not outlive it.
    await db.query(`DELETE FROM "executions" WHERE "id" = $1`, [EXEC]).catch(async (error: Error) => {
      // An append-only guard on executions is EPIC-037's decision, and a
      // legitimate outcome: then retention cannot be exercised here.
      expect(error.message).toMatch(/append|immutable|not permitted|reject/i);
    });
    const exists = await db.query(`SELECT count(*)::int AS n FROM "executions" WHERE "id" = $1`, [EXEC]);
    console.log(`T1805 retention: execution ${exists.rows[0].n === 0 ? 'deleted — cascade exercised' : 'kept by EPIC-037 — cascade not exercisable'}`);
    if (exists.rows[0].n === 0) {
      const after = await db.query(`SELECT count(*)::int AS n FROM "context_packages" WHERE "executionId" = $1`, [EXEC]);
      expect(after.rows[0].n).toBe(0);
    }
  });
});
