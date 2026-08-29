/**
 * `T1179`, `T1180` (EPIC-030) — the loop's persistent store.
 *
 * `LOOP_STORE` has always defaulted to `InMemoryLoopStore`, and
 * `loop.module.ts` explains why that default is honest: an in-memory store
 * loses data **visibly**. What it did not say is that nothing ever replaced it,
 * so a Room opened through the running application vanished on restart. A human
 * walking the Requirement Room found that; `T1178` measured it.
 *
 * ## What this suite has to prove that a unit test cannot
 *
 * Three properties are about the **database**, not the interface:
 *
 * - `advanceObject` is a conditional update. `loop.store.ts` names the
 *   implementation — `updateMany({ where: { id, version } })` and a count of `0`
 *   is the lost race — because a read-then-write would pass every single-caller
 *   test and lose a concurrent one.
 * - `runInTransaction` must **really roll back**. The in-memory store rolls back
 *   for real precisely so `T957`'s fail-closed test cannot pass over behaviour
 *   the database lacks; the reverse trap is a Prisma store that swallows.
 * - Rows must survive a **new client**, which is the whole point.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import type { TransactionHandle } from '@pmi/loop-contract';
import { PrismaLoopStore, type LoopStore } from '../../src/modules/loop/loop.store.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_loopdb';
const OTHER = 'ws_loopdb_other';
const PROJECT = 'pr_loopdb';

suite('T1179 · the loop store against a real database', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let store: LoopStore;
  let url = '';

  const declare = (subjectId: string, workspaceId = WS, workflowType = 'requirement-room') =>
    store.createObject({
      workspaceId,
      projectId: PROJECT,
      workflowType,
      configVersion: 1,
      subjectType: 'requirement-set',
      subjectId,
      currentStage: 'Event',
    });

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    url = container.getConnectionUri();
    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    for (const ws of [WS, OTHER]) {
      await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$1,now())`, [
        ws,
      ]);
    }
    await db.end();

    prisma = new PrismaClient({ datasources: { db: { url } } });
    store = new PrismaLoopStore(prisma);
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('creates an object and finds it back', async () => {
    const row = await declare('sub_create');
    expect(row.id).toBeTruthy();
    expect(row.currentStage).toBe('Event');
    expect(row.version).toBe(0);

    const found = await store.findObject(row.id);
    expect(found?.subjectId).toBe('sub_create');
    // Dates come back as Dates, not strings — `listObjects` sorts on them.
    expect(found?.createdAt).toBeInstanceOf(Date);
  });

  it('the row is really in the table, not in a cache', async () => {
    const row = await declare('sub_real');
    const [db] = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "loop_objects" WHERE "id" = $1`,
      row.id,
    );
    expect(db?.id).toBe(row.id);
  });

  it('survives a NEW client — the property the in-memory store cannot have', async () => {
    const row = await declare('sub_survives');
    const fresh = new PrismaClient({ datasources: { db: { url } } });
    try {
      const seen = await new PrismaLoopStore(fresh).findObject(row.id);
      expect(seen?.subjectId).toBe('sub_survives');
    } finally {
      await fresh.$disconnect();
    }
  });

  it('lists by workspace and type, newest first, and never another workspace', async () => {
    await declare('sub_list_a');
    await declare('sub_list_b');
    await declare('sub_list_other', OTHER);
    await declare('sub_list_change', WS, 'change-room');

    const rows = await store.listObjects({ workspaceId: WS, workflowType: 'requirement-room' });
    const subjects = rows.map((r) => r.subjectId);
    expect(subjects).toContain('sub_list_a');
    expect(subjects).toContain('sub_list_b');
    expect(subjects, 'another workspace leaked').not.toContain('sub_list_other');
    expect(subjects, 'another workflow type leaked').not.toContain('sub_list_change');

    const times = rows.map((r) => r.createdAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('honours the limit', async () => {
    const rows = await store.listObjects({
      workspaceId: WS,
      workflowType: 'requirement-room',
      limit: 2,
    });
    expect(rows).toHaveLength(2);
  });
});

suite('T1179 · advanceObject is conditional, not read-then-write', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let store: LoopStore;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();
    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$1,now())`, [WS]);
    await db.end();
    prisma = new PrismaClient({ datasources: { db: { url } } });
    store = new PrismaLoopStore(prisma);
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  const fresh = () =>
    store.createObject({
      workspaceId: WS,
      projectId: PROJECT,
      workflowType: 'requirement-room',
      configVersion: 1,
      subjectType: 'requirement-set',
      subjectId: 'sub_race',
      currentStage: 'Event',
    });

  it('advances at the expected version and increments it', async () => {
    const row = await fresh();
    const moved = await store.advanceObject({
      id: row.id,
      expectedVersion: 0,
      toStage: 'Context',
    });
    expect(moved?.currentStage).toBe('Context');
    expect(moved?.version).toBe(1);
  });

  it('returns NULL when the version moved — and writes nothing', async () => {
    const row = await fresh();
    await store.advanceObject({ id: row.id, expectedVersion: 0, toStage: 'Context' });

    const lost = await store.advanceObject({ id: row.id, expectedVersion: 0, toStage: 'Analyze' });
    expect(lost, 'a stale write was accepted').toBeNull();

    // Null is a governed outcome, not a fault — and the object must be
    // untouched by the loser.
    const after = await store.findObject(row.id);
    expect(after?.currentStage).toBe('Context');
    expect(after?.version).toBe(1);
  });

  it('exactly one of twenty concurrent advances wins', async () => {
    // The assertion a read-then-write implementation cannot pass. It is the
    // reason `loop.store.ts` specifies `updateMany` rather than leaving the
    // implementation open.
    const row = await fresh();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        store.advanceObject({ id: row.id, expectedVersion: 0, toStage: 'Context' }),
      ),
    );
    expect(results.filter((r) => r !== null)).toHaveLength(1);

    const after = await store.findObject(row.id);
    expect(after?.version).toBe(1);
  });

  it('returns null for an object that does not exist', async () => {
    expect(
      await store.advanceObject({ id: 'no-such-object', expectedVersion: 0, toStage: 'Context' }),
    ).toBeNull();
  });
});

suite('T1179 · transitions and rollback', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let store: LoopStore;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();
    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$1,now())`, [WS]);
    await db.end();
    prisma = new PrismaClient({ datasources: { db: { url } } });
    store = new PrismaLoopStore(prisma);
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  const object = () =>
    store.createObject({
      workspaceId: WS,
      projectId: PROJECT,
      workflowType: 'requirement-room',
      configVersion: 1,
      subjectType: 'requirement-set',
      subjectId: 'sub_tx',
      currentStage: 'Event',
    });

  const transition = (objectId: string, toStage: 'Context' | 'Analyze') => ({
    workspaceId: WS,
    objectId,
    objectVersion: 1,
    fromStage: 'Event' as const,
    toStage,
    outcome: 'accepted' as const,
    refusalReason: null,
    wonBy: null,
    actorId: 'u_1',
    actorKind: 'human' as const,
    authorityBasis: 'analyst',
    triggerRuleId: null,
    triggerEventId: null,
    configVersion: 1,
    gateOutcomes: [],
  });

  it('appends a transition and reads it back in order', async () => {
    const row = await object();
    await store.appendTransition(transition(row.id, 'Context'));
    await store.appendTransition(transition(row.id, 'Analyze'));

    const rows = await store.transitionsFor(row.id);
    expect(rows.map((r) => r.toStage)).toEqual(['Context', 'Analyze']);
    expect(rows[0]?.occurredAt).toBeInstanceOf(Date);
    expect(rows[0]?.gateOutcomes).toEqual([]);
  });

  it('ROLLS BACK for real — the trap this test exists for', async () => {
    // `FR-GEL-041`, `R-030-2`: the transition and its audit record land together
    // or neither lands. A store that ran the callback and ignored failure would
    // pass every behavioural test and lose the guarantee.
    const row = await object();
    const before = (await store.transitionsFor(row.id)).length;

    await expect(
      store.runInTransaction(async (tx: TransactionHandle) => {
        await store.appendTransition(transition(row.id, 'Context'), tx);
        throw new Error('the caller failed after the append');
      }),
    ).rejects.toThrow(/failed after the append/);

    expect(
      (await store.transitionsFor(row.id)).length,
      'the append survived a rolled-back transaction',
    ).toBe(before);
  });

  it('commits when the callback succeeds — or the rollback proves nothing', async () => {
    // Anti-vacuity. Without this, a `runInTransaction` that always rolled back
    // would satisfy the assertion above.
    const row = await object();
    const before = (await store.transitionsFor(row.id)).length;

    await store.runInTransaction(async (tx: TransactionHandle) => {
      await store.appendTransition(transition(row.id, 'Context'), tx);
    });

    expect((await store.transitionsFor(row.id)).length).toBe(before + 1);
  });
});
