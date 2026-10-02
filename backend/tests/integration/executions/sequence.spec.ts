/**
 * T1040, T1044, T1046 (EPIC-037 Band A) — sequence, concurrency, terminality
 * and idempotency, against a real PostgreSQL.
 *
 * These cannot be proven with a fake transaction. The claims are about what the
 * **database** does when two writers arrive at once and when a rollback
 * happens, and a `$transaction` that merely calls its callback would assert
 * nothing about either.
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
import {
  ExecutionProjectionService,
  foldExecution,
  type ProjectionDb,
} from '../../../src/modules/executions/execution-projection.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_seq';

suite('T1046 · the sequence is gapless per execution, and nobody shares one', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let events: ExecutionEventService;
  let n = 0;

  const nextExecution = async (): Promise<string> => {
    n += 1;
    const id = `exec_seq_${n}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "executions"
         ("id","correlationId","idempotencyKey","workspaceId","command","argsSanitized",
          "initiatorType","initiatorId","surface","contractVersion","assurance")
       VALUES ($1,'c1',$1,$2,'specify','{}'::jsonb,'agent','p_agent','fixture','1.0','local')`,
      id,
      WS,
    );
    return id;
  };

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
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'seq',now())`, [
      WS,
    ]);
    await db.end();

    prisma = new PrismaClient({ datasources: { db: { url } } });
    events = new ExecutionEventService(prisma as unknown as EventDb);
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  const append = (executionId: string, type: string, key: string, expectedSequence?: number) =>
    events.append({
      workspaceId: WS,
      executionId,
      type: type as never,
      payload: {},
      occurredAt: new Date().toISOString(),
      emittedBy: 'p_agent',
      idempotencyKey: key,
      ...(expectedSequence !== undefined ? { expectedSequence } : {}),
    });

  it('numbers events 1, 2, 3 with no gaps', async () => {
    const id = await nextExecution();
    const a = await append(id, 'registered', `${id}:1`);
    const b = await append(id, 'started', `${id}:2`);
    const c = await append(id, 'progress-reported', `${id}:3`);
    expect([a.sequence, b.sequence, c.sequence]).toEqual([1, 2, 3]);
    expect(await events.verify(WS, id)).toEqual({ gapless: true, chained: true });
  });

  it('CONCURRENT writers never receive the same sequence', async () => {
    // The claim the row lock exists for. Ten simultaneous appends must produce
    // ten distinct numbers with no hole, not ten collisions and a retry storm.
    const id = await nextExecution();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => append(id, 'progress-reported', `${id}:c${i}`)),
    );
    const sequences = results.map((r) => r.sequence).sort((x, y) => x - y);
    expect(sequences).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(sequences).size, 'two writers shared a sequence').toBe(10);
    expect(await events.verify(WS, id)).toEqual({ gapless: true, chained: true });
  });

  it('appends to DIFFERENT executions do not block each other', async () => {
    // The lock is on the execution's own root row, so it serialises one stream
    // rather than the whole registry.
    const [a, b] = [await nextExecution(), await nextExecution()];
    const [x, y] = await Promise.all([append(a, 'started', `${a}:s`), append(b, 'started', `${b}:s`)]);
    expect([x.sequence, y.sequence]).toEqual([1, 1]);
  });

  it('an expectedSequence conflict appends NOTHING', async () => {
    const id = await nextExecution();
    await append(id, 'registered', `${id}:1`);
    await expect(append(id, 'started', `${id}:2`, 99)).rejects.toThrow(/sequence/i);

    const history = await events.history(WS, id);
    expect(history, 'a conflicting append still wrote an event').toHaveLength(1);
  });

  it('an expectedSequence that matches proceeds — the check is not blanket refusal', async () => {
    const id = await nextExecution();
    await append(id, 'registered', `${id}:1`);
    const ok = await append(id, 'started', `${id}:2`, 1);
    expect(ok.sequence).toBe(2);
  });
});

suite('T1044 · terminality blocks lifecycle events only', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let events: ExecutionEventService;
  let projections: ExecutionProjectionService;

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
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'term',now())`, [
      WS,
    ]);
    await db.query(
      `INSERT INTO "executions"
         ("id","correlationId","idempotencyKey","workspaceId","command","argsSanitized",
          "initiatorType","initiatorId","surface","contractVersion","assurance")
       VALUES ('exec_term','c1','k1',$1,'specify','{}'::jsonb,'agent','p_agent','fixture','1.0','local')`,
      [WS],
    );
    await db.end();

    prisma = new PrismaClient({ datasources: { db: { url } } });
    events = new ExecutionEventService(prisma as unknown as EventDb);
    projections = new ExecutionProjectionService(prisma as unknown as ProjectionDb);

    for (const [type, key] of [
      ['registered', 'k-reg'],
      ['started', 'k-start'],
      ['completed', 'k-done'],
    ]) {
      await events.append({
        workspaceId: WS,
        executionId: 'exec_term',
        type: type as never,
        payload: {},
        occurredAt: new Date().toISOString(),
        emittedBy: 'p_agent',
        idempotencyKey: key!,
      });
    }
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  const tryAppend = (type: string, key: string) =>
    events.append({
      workspaceId: WS,
      executionId: 'exec_term',
      type: type as never,
      payload: {},
      occurredAt: new Date().toISOString(),
      emittedBy: 'p_agent',
      idempotencyKey: key,
    });

  it.each(['started', 'progress-reported', 'failed', 'cancelled'])(
    'refuses the LIFECYCLE event "%s" after completion',
    async (type) => {
      await expect(tryAppend(type, `after-${type}`)).rejects.toThrow(/no further lifecycle/i);
    },
  );

  it.each([
    ['comment-added', 'content'],
    ['evidence-attached', 'content'],
    ['status-transition-proposed', 'governance'],
    ['transition-applied', 'governance'],
    ['execution-reconciliation-requested', 'registration'],
  ])('PERMITS "%s" after completion — it is a %s event', async (type) => {
    // The half a flat "nothing after terminal" rule would lose. An execution
    // finishing does not settle the argument about it.
    await expect(tryAppend(type, `ok-${type}`)).resolves.toBeTruthy();
  });

  it('the projection reflects the terminal state and how far it read', async () => {
    const projected = await projections.rebuild(WS, 'exec_term');
    expect(projected.lifecycleState).toBe('completed');
    expect(projected.projectedThroughSequence).toBeGreaterThan(3);
  });

  it('rebuilding is idempotent — a projection is disposable', async () => {
    const first = await projections.rebuild(WS, 'exec_term');
    const second = await projections.rebuild(WS, 'exec_term');
    expect(second).toEqual(first);
  });

  it('the fold is a pure function of the stream', () => {
    // Same input, same answer, no database. `rebuild` and any incremental path
    // both call this, so they cannot drift.
    expect(
      foldExecution([
        { sequence: 1, type: 'registered' },
        { sequence: 2, type: 'started' },
        { sequence: 3, type: 'failed' },
        { sequence: 4, type: 'comment-added' },
      ]),
    ).toEqual({ lifecycleState: 'failed', projectedThroughSequence: 4 });
  });
});

suite('T1040 · idempotency returns the original, never a second event', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let events: ExecutionEventService;

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
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'idem',now())`, [
      WS,
    ]);
    await db.query(
      `INSERT INTO "executions"
         ("id","correlationId","idempotencyKey","workspaceId","command","argsSanitized",
          "initiatorType","initiatorId","surface","contractVersion","assurance")
       VALUES ('exec_idem','c1','k1',$1,'specify','{}'::jsonb,'agent','p_agent','fixture','1.0','local')`,
      [WS],
    );
    await db.end();
    prisma = new PrismaClient({ datasources: { db: { url } } });
    events = new ExecutionEventService(prisma as unknown as EventDb);
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  const append = (type: string, key: string) =>
    events.append({
      workspaceId: WS,
      executionId: 'exec_idem',
      type: type as never,
      payload: {},
      occurredAt: new Date().toISOString(),
      emittedBy: 'p_agent',
      idempotencyKey: key,
    });

  it('a replay returns the ORIGINAL event and appends nothing', async () => {
    const first = await append('registered', 'same-key');
    const replay = await append('registered', 'same-key');
    expect(replay.eventId).toBe(first.eventId);
    expect(replay.sequence).toBe(first.sequence);
    expect(replay.replayed, 'the replay was not reported as one').toBe(true);
    expect(await events.history(WS, 'exec_idem')).toHaveLength(1);
  });

  it('three attempts leave exactly one event', async () => {
    await append('registered', 'same-key');
    await append('registered', 'same-key');
    expect(await events.history(WS, 'exec_idem')).toHaveLength(1);
  });

  it('the SAME key with DIFFERENT content is a conflict, not a replay', async () => {
    // Returning the original here would silently discard the new event, which
    // is worse than refusing: the caller would believe it was recorded.
    await expect(append('started', 'same-key')).rejects.toThrow(/idempotency/i);
  });

  it('a different key appends a new event', async () => {
    const next = await append('started', 'another-key');
    expect(next.sequence).toBe(2);
    expect(next.replayed).toBe(false);
  });
});
