/**
 * T1053, T1054 (EPIC-037 Band A) — a re-run is a new execution, linked.
 *
 * `FR-EXR-018`. The rule that matters is the one it is tempting to break: a
 * terminal execution is **never reopened**. Re-running means creating a new
 * execution that points at the old one, so both histories survive and neither
 * is rewritten. Reopening would be cheaper and would destroy the record of what
 * the first attempt actually did.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from '../../helpers/postgres-image.js';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import {
  ExecutionEventService,
  type EventDb,
} from '../../../src/modules/executions/execution-event.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_rerun';
const FIRST = 'exec_first';
const SECOND = 'exec_second';

suite('T1053 · a re-run links to its parent and never reopens it', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let events: ExecutionEventService;

  const createExecution = async (id: string, parent: string | null): Promise<void> => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "executions"
         ("id","correlationId","idempotencyKey","workspaceId","command","argsSanitized",
          "initiatorType","initiatorId","surface","contractVersion","parentExecutionId")
       VALUES ($1,'c1',$1,$2,'specify','{}'::jsonb,'agent','p_agent','fixture','1.0',$3)`,
      id,
      WS,
      parent,
    );
  };

  const append = (executionId: string, type: string, key: string) =>
    events.append({
      workspaceId: WS,
      executionId,
      type: type as never,
      payload: {},
      occurredAt: new Date().toISOString(),
      emittedBy: 'p_agent',
      idempotencyKey: key,
    });

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const url = container.getConnectionUri();
    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'rerun',now())`, [
      WS,
    ]);
    await db.end();

    prisma = new PrismaClient({ datasources: { db: { url } } });
    events = new ExecutionEventService(prisma as unknown as EventDb);

    await createExecution(FIRST, null);
    await append(FIRST, 'registered', 'f1');
    await append(FIRST, 'started', 'f2');
    await append(FIRST, 'failed', 'f3');
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('the first execution is terminal and refuses to be reopened', async () => {
    await expect(append(FIRST, 'started', 'f-reopen')).rejects.toThrow(/no further lifecycle/i);
  });

  it('a re-run is a NEW execution naming the parent', async () => {
    await createExecution(SECOND, FIRST);
    const rows = await prisma.$queryRawUnsafe<{ parentExecutionId: string | null }[]>(
      `SELECT "parentExecutionId" FROM "executions" WHERE "id" = $1`,
      SECOND,
    );
    expect(rows[0]?.parentExecutionId).toBe(FIRST);
  });

  it('the re-run has its own stream, starting at sequence 1', async () => {
    const registered = await append(SECOND, 'registered', 's1');
    expect(registered.sequence, 'the re-run continued the parent stream').toBe(1);
  });

  it("the parent's history is untouched by the re-run", async () => {
    await append(SECOND, 'started', 's2');
    await append(SECOND, 'completed', 's3');

    const parent = await events.history(WS, FIRST);
    expect(parent.map((e) => e.type)).toEqual(['registered', 'started', 'failed']);
    // Both outcomes survive. A reopened execution would have one, and it would
    // be the wrong one.
    const child = await events.history(WS, SECOND);
    expect(child.map((e) => e.type)).toEqual(['registered', 'started', 'completed']);
  });

  it('the parent cannot be deleted out from under its re-run', async () => {
    // `ON DELETE RESTRICT`. A re-run chain with a hole in it would be worse
    // than no chain: it would look complete.
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "executions" WHERE "id" = $1`, FIRST),
    ).rejects.toThrow();
  });

  it('both streams remain gapless and chained', async () => {
    for (const id of [FIRST, SECOND]) {
      expect(await events.verify(WS, id), `${id} is not intact`).toEqual({
        gapless: true,
        chained: true,
      });
    }
  });
});
