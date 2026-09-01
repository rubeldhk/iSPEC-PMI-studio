/**
 * T1106 (EPIC-009 C2C reopening) — the transition is atomic, durable and
 * concurrent-safe, proven against real PostgreSQL.
 *
 * `X8` was not "EPIC-009 lacks a transition id". The id existed. The problem was
 * that the state change and the evidence were two writes in two stores, so the
 * id identified nothing anyone could rely on: a crash between them left either
 * a silent state change or evidence for a change that never happened.
 *
 * ## On the rollback tests
 *
 * The transaction is **real** and so is the rollback. What is injected is the
 * fault — a `lifecycleTransition.create` that throws — because there is no way
 * to make PostgreSQL fail that insert on demand without also breaking the
 * update. Everything else in the path, including the `$transaction` boundary
 * that does the rolling back, is production code.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from '../../helpers/postgres-image.js';
import { Client } from 'pg';
import {
  ExpectedStateMismatchError,
  PrismaLifecycleTransitionRepository,
  type LifecycleTx,
} from '../../../src/modules/specifications/lifecycle-transition.repository';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_atomic';
const SPEC = 'spec_atomic';

suite('T1106 · lifecycle state and its evidence commit together, or not at all', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;
   
  let prisma: any;
  let repo: PrismaLifecycleTransitionRepository;
  let url = '';

  /** Reset the specification to `draft` so each test starts from one place. */
  async function reset(): Promise<void> {
    await db.query(`DELETE FROM "lifecycle_transitions" WHERE "workspaceId" = $1`, [WS]).catch(
      async () => {
        // The table is append-only; drop the trigger for fixture teardown only.
        await db.query(`ALTER TABLE "lifecycle_transitions" DISABLE TRIGGER USER`);
        await db.query(`DELETE FROM "lifecycle_transitions" WHERE "workspaceId" = $1`, [WS]);
        await db.query(`ALTER TABLE "lifecycle_transitions" ENABLE TRIGGER USER`);
      },
    );
    await db.query(`UPDATE "specifications" SET "lifecycleState" = 'draft' WHERE "id" = $1`, [SPEC]);
  }

  async function statusOf(): Promise<string> {
    const { rows } = await db.query<{ lifecycleState: string }>(
      `SELECT "lifecycleState" FROM "specifications" WHERE "id" = $1`,
      [SPEC],
    );
    return rows[0]!.lifecycleState;
  }

  async function transitionCount(): Promise<number> {
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "lifecycle_transitions" WHERE "specificationId" = $1`,
      [SPEC],
    );
    return Number(rows[0]!.n);
  }

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    url = container.getConnectionUri();
    db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'atomicity',now())`, [WS]);
    await db.query(
      `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
       VALUES ('u_atomic',$1,'atomic@example.test','Atomic','x',now())`,
      [WS],
    );
    await db.query(
      `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
       VALUES ('proj_atomic',$1,'Atomicity','u_atomic',now())`,
      [WS],
    );
    await db.query(
      `INSERT INTO "specifications"
         ("id","workspaceId","projectId","title","lifecycleState","engineName","engineVersion",
          "generatedAt","createdById","updatedById","updatedAt")
       VALUES ($1,$2,'proj_atomic','Atomicity probe','draft','fixture','1',now(),
               'u_atomic','u_atomic',now())`,
      [SPEC, WS],
    );

    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url } } });
    repo = new PrismaLifecycleTransitionRepository(
      (fn) => prisma.$transaction((tx: LifecycleTx) => fn(tx)),
      prisma as LifecycleTx,
    );
  }, 240_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.end();
    await container?.stop();
  });

  const INPUT = {
    workspaceId: WS,
    specificationId: SPEC,
    expectedStatus: 'draft',
    requestedStatus: 'review',
    actorId: 'u_atomic',
    actorSnapshotId: 'snap_atomic',
    correlationId: 'corr-1',
    causationId: 'cause-1',
    idempotencyKey: 'idem-1',
  };

  it('commits the state change and the evidence together, and returns the committed identity', async () => {
    await reset();
    const out = await repo.apply(INPUT);

    expect(out.transitionId, 'no transition id came back').toBeTruthy();
    expect(out.previousStatus).toBe('draft');
    expect(out.resultingStatus).toBe('review');
    expect(out.correlationId).toBe('corr-1');
    expect(out.causationId).toBe('cause-1');
    expect(out.actorSnapshotId).toBe('snap_atomic');
    expect(out.idempotent).toBe(false);
    expect(await statusOf()).toBe('review');

    // The id names a row that is actually there — not a value the caller made up.
    const { rows } = await db.query(`SELECT "id" FROM "lifecycle_transitions" WHERE "id" = $1`, [
      out.transitionId,
    ]);
    expect(rows, 'the returned transition id matches no committed row').toHaveLength(1);
  });

  it('rolls back BOTH writes when the evidence insert fails', async () => {
    await reset();
    // Real transaction, real rollback; only the fault is injected.
    const failing = new PrismaLifecycleTransitionRepository(
      (fn) =>
        prisma.$transaction((tx: LifecycleTx) =>
          fn({
            specification: tx.specification,
            lifecycleTransition: {
              findFirst: tx.lifecycleTransition.findFirst.bind(tx.lifecycleTransition),
              create: async () => {
                throw new Error('injected: evidence insert failed');
              },
            },
          } as LifecycleTx),
        ),
      prisma as LifecycleTx,
    );

    await expect(failing.apply({ ...INPUT, idempotencyKey: 'idem-rollback' })).rejects.toThrow(
      /injected/,
    );

    // Neither half survived.
    expect(await statusOf(), 'the state change committed without its evidence').toBe('draft');
    expect(await transitionCount(), 'evidence committed for a rolled-back change').toBe(0);
  });

  it('returns the ORIGINAL committed result for the same idempotency key', async () => {
    await reset();
    const first = await repo.apply(INPUT);
    const retry = await repo.apply(INPUT);

    expect(retry.transitionId).toBe(first.transitionId);
    expect(retry.idempotent, 'the retry was not reported as idempotent').toBe(true);
    expect(await transitionCount(), 'the retry wrote a second transition').toBe(1);
  });

  it('refuses a stale expected state, and changes nothing', async () => {
    await reset();
    await repo.apply(INPUT);
    // The specification is now `review`; this proposal still believes `draft`.
    await expect(
      repo.apply({ ...INPUT, idempotencyKey: 'idem-stale' }),
    ).rejects.toBeInstanceOf(ExpectedStateMismatchError);
    expect(await statusOf()).toBe('review');
    expect(await transitionCount()).toBe(1);
  });

  it('lets at most ONE of two concurrent applications from the same state commit', async () => {
    await reset();
    const results = await Promise.allSettled([
      repo.apply({ ...INPUT, idempotencyKey: 'race-a' }),
      repo.apply({ ...INPUT, idempotencyKey: 'race-b' }),
    ]);
    const committed = results.filter((r) => r.status === 'fulfilled');
    expect(committed, 'both concurrent transitions committed').toHaveLength(1);
    expect(await transitionCount(), 'two transitions were recorded for one state change').toBe(1);
  });

  it('keeps the transition readable after the application restarts', async () => {
    await reset();
    const out = await repo.apply({ ...INPUT, idempotencyKey: 'idem-restart' });

    // A fresh client with a fresh pool — the same thing a process restart does.
    const { PrismaClient } = await import('@prisma/client');
     
    const restarted: any = new PrismaClient({ datasources: { db: { url } } });
    const afterRestart = new PrismaLifecycleTransitionRepository(
      (fn) => restarted.$transaction((tx: LifecycleTx) => fn(tx)),
      restarted as LifecycleTx,
    );
    const read = await afterRestart.findTransition(WS, out.transitionId);
    await restarted.$disconnect();

    expect(read, 'the transition did not survive a restart').not.toBeNull();
    expect(read!.transitionId).toBe(out.transitionId);
    expect(read!.correlationId).toBe('corr-1');
    expect(read!.resultingStatus).toBe('review');
  });

  it('refuses UPDATE and DELETE of transition evidence, as the application role', async () => {
    await reset();
    const out = await repo.apply({ ...INPUT, idempotencyKey: 'idem-immutable' });
    // The same connection and role the application uses. Enforcement is a
    // trigger, not a grant, so it binds the owner too — which is stronger than
    // a permission a superuser could step around.
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "lifecycle_transitions" SET "toState" = 'approved' WHERE "id" = '${out.transitionId}'`,
      ),
    ).rejects.toThrow(/append-only/i);
    await expect(
      prisma.$executeRawUnsafe(
        `DELETE FROM "lifecycle_transitions" WHERE "id" = '${out.transitionId}'`,
      ),
    ).rejects.toThrow(/append-only/i);
  });
});
