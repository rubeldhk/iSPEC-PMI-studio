/**
 * T1046, T1047 (EPIC-037 Band A, C3C closure) — what survives a failure.
 *
 * The existing sequence suite proves the happy paths: ten concurrent appends
 * take 1–10, an `expectedSequence` conflict writes nothing, a replay returns the
 * original. This file covers the three things it asserted only by implication,
 * each of which is the kind that passes for the wrong reason:
 *
 * 1. **A gap is actually detectable.** Every other test asserts
 *    `{gapless: true}`. If `verify()` returned that unconditionally the whole
 *    suite would still be green, so here a gap is created deliberately and the
 *    check must report it.
 * 2. **A rollback leaves nothing behind.** The sequence is allocated by reading
 *    the head under a row lock, so a transaction that fails *after* allocating
 *    must not consume the number.
 * 3. **A reused idempotency key with different content or a different principal
 *    conflicts**, rather than silently returning the original — which would
 *    report an event as recorded that was never written.
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
  type ProjectionDb,
} from '../../../src/modules/executions/execution-projection.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_tx';

suite('T1046 · a failed append leaves no trace, and a gap is visible', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let raw: Client;
  let events: ExecutionEventService;
  let projections: ExecutionProjectionService;
  let n = 0;

  const nextExecution = async (): Promise<string> => {
    n += 1;
    const id = `exec_tx_${n}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "executions"
         ("id","correlationId","idempotencyKey","workspaceId","command","argsSanitized",
          "initiatorType","initiatorId","surface","contractVersion")
       VALUES ($1,'c1',$1,$2,'specify','{}'::jsonb,'agent','p_agent','fixture','1.0')`,
      id,
      WS,
    );
    return id;
  };

  const append = (
    executionId: string,
    type: string,
    key: string,
    over: { payload?: Record<string, unknown>; emittedBy?: string } = {},
  ) =>
    events.append({
      workspaceId: WS,
      executionId,
      type: type as never,
      payload: over.payload ?? {},
      occurredAt: new Date().toISOString(),
      emittedBy: over.emittedBy ?? 'p_agent',
      idempotencyKey: key,
    });

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const url = container.getConnectionUri();
    raw = new Client({ connectionString: url });
    await raw.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await raw.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await raw.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'tx',now())`, [
      WS,
    ]);

    prisma = new PrismaClient({ datasources: { db: { url } } });
    events = new ExecutionEventService(prisma as unknown as EventDb);
    projections = new ExecutionProjectionService(prisma as unknown as ProjectionDb);
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await raw?.end();
    await container?.stop();
  }, 120_000);

  describe('a deliberate gap is detected', () => {
    it('reports gapless:false when a sequence is missing', async () => {
      const id = await nextExecution();
      await append(id, 'registered', `${id}:1`);
      await append(id, 'started', `${id}:2`);
      await append(id, 'progress-reported', `${id}:3`);
      expect(await events.verify(WS, id), 'the stream did not start intact').toEqual({
        gapless: true,
        chained: true,
      });

      // Forge the gap as a superuser: the application role cannot do this, and
      // that is the point of the immutability suite. Here we need the damaged
      // stream to exist so the detector has something to find.
      await raw.query(
        `ALTER TABLE "execution_events" DISABLE TRIGGER "execution_events_immutable"`,
      );
      await raw.query(`DELETE FROM "execution_events" WHERE "executionId" = $1 AND "sequence" = 2`, [
        id,
      ]);
      await raw.query(
        `ALTER TABLE "execution_events" ENABLE TRIGGER "execution_events_immutable"`,
      );

      const verified = await events.verify(WS, id);
      expect(verified.gapless, 'a missing sequence was reported as gapless').toBe(false);
      // The chain breaks too: event 3 hashes against a predecessor that is gone.
      expect(verified.chained, 'a removed event left the chain intact').toBe(false);
    });

    it('reports chained:false when a payload is tampered with', async () => {
      const id = await nextExecution();
      await append(id, 'registered', `${id}:t1`);
      await append(id, 'started', `${id}:t2`);

      await raw.query(`ALTER TABLE "execution_events" DISABLE TRIGGER "execution_events_immutable"`);
      await raw.query(
        `UPDATE "execution_events" SET "payload" = '{"tampered":true}'::jsonb
          WHERE "executionId" = $1 AND "sequence" = 1`,
        [id],
      );
      await raw.query(`ALTER TABLE "execution_events" ENABLE TRIGGER "execution_events_immutable"`);

      const verified = await events.verify(WS, id);
      // No sequence is missing, so this is the chain doing work the gap check
      // cannot: the row count is right and the content is not.
      expect(verified.gapless).toBe(true);
      expect(verified.chained, 'an edited payload still verified').toBe(false);
    });
  });

  describe('a rollback consumes nothing', () => {
    it('leaves no gap after a transaction fails past sequence allocation', async () => {
      const id = await nextExecution();
      await append(id, 'registered', `${id}:r1`);

      // Fault injection. The append reads the head under `FOR UPDATE` and then
      // inserts; failing the insert inside the same transaction is what a
      // constraint violation or a dropped connection would do in production.
      // A sequence allocated from a DB sequence object would be burned here.
      await expect(
        prisma.$transaction(async (tx) => {
          const head = await tx.$queryRawUnsafe<{ sequence: number }[]>(
            `SELECT "sequence" FROM "execution_events"
              WHERE "executionId" = $1 ORDER BY "sequence" DESC LIMIT 1`,
            id,
          );
          const next = (head[0]?.sequence ?? 0) + 1;
          expect(next, 'the doomed write did not allocate the number under test').toBe(2);
          await tx.$executeRawUnsafe(
            `INSERT INTO "execution_events"
               ("id","workspaceId","executionId","sequence","class","type","payload",
                "occurredAt","emittedBy","idempotencyKey","integrityHash")
             VALUES ($1,$2,$3,$4,'lifecycle','started','{}'::jsonb,now(),'p_agent',$5,'h')`,
            `ev_doomed_${id}`,
            WS,
            id,
            next,
            `${id}:doomed`,
          );
          throw new Error('injected failure after the sequence was allocated');
        }),
      ).rejects.toThrow(/injected failure/);

      // Nothing was written...
      const history = await events.history(WS, id);
      expect(history, 'the rolled-back event survived').toHaveLength(1);

      // ...and the number it would have taken is still available.
      const recovered = await append(id, 'started', `${id}:r2`);
      expect(recovered.sequence, 'the rollback burned a sequence number').toBe(2);
      expect(await events.verify(WS, id)).toEqual({ gapless: true, chained: true });
    });

    it('leaves no partial projection behind', async () => {
      const id = await nextExecution();
      await append(id, 'registered', `${id}:p1`);
      await append(id, 'started', `${id}:p2`);
      await projections.rebuild(WS, id);

      const before = await prisma.$queryRawUnsafe<
        { lifecycleState: string; projectedThroughSequence: number }[]
      >(
        `SELECT "lifecycleState","projectedThroughSequence" FROM "execution_state"
          WHERE "executionId" = $1`,
        id,
      );
      expect(before[0]?.projectedThroughSequence).toBe(2);

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `UPDATE "execution_state" SET "lifecycleState" = 'completed',
                "projectedThroughSequence" = 99 WHERE "executionId" = $1`,
            id,
          );
          throw new Error('injected failure mid-projection');
        }),
      ).rejects.toThrow(/injected failure/);

      const after = await prisma.$queryRawUnsafe<
        { lifecycleState: string; projectedThroughSequence: number }[]
      >(
        `SELECT "lifecycleState","projectedThroughSequence" FROM "execution_state"
          WHERE "executionId" = $1`,
        id,
      );
      expect(after[0], 'a half-written projection was committed').toEqual(before[0]);

      // And the projection can still be rebuilt from the events, which is the
      // property that makes it safe to be non-authoritative.
      await projections.rebuild(WS, id);
      const rebuilt = await prisma.$queryRawUnsafe<{ projectedThroughSequence: number }[]>(
        `SELECT "projectedThroughSequence" FROM "execution_state" WHERE "executionId" = $1`,
        id,
      );
      expect(rebuilt[0]?.projectedThroughSequence).toBe(2);
    });
  });

  describe('a reused idempotency key is compared on content AND principal', () => {
    it('replays an identical append, whatever the key order in the payload', async () => {
      const id = await nextExecution();
      const first = await append(id, 'progress-reported', `${id}:k`, {
        payload: { a: 1, b: { c: 2, d: 3 } },
      });
      const replay = await append(id, 'progress-reported', `${id}:k`, {
        payload: { b: { d: 3, c: 2 }, a: 1 },
      });
      // Neither JSON nor HTTP preserves key order, so a byte comparison here
      // would refuse a legitimate retry.
      expect(replay.eventId).toBe(first.eventId);
      expect(replay.replayed).toBe(true);
    });

    it('conflicts when the PAYLOAD differs', async () => {
      const id = await nextExecution();
      await append(id, 'progress-reported', `${id}:k2`, { payload: { step: 1 } });
      await expect(
        append(id, 'progress-reported', `${id}:k2`, { payload: { step: 2 } }),
      ).rejects.toThrow(/idempotency/i);
      expect(await events.history(WS, id)).toHaveLength(1);
    });

    it('conflicts when the EMITTING PRINCIPAL differs', async () => {
      // The dangerous one. Returning the original would report success to a
      // principal whose event was never written, attributed to the first.
      const id = await nextExecution();
      await append(id, 'progress-reported', `${id}:k3`, { emittedBy: 'p_agent' });
      await expect(
        append(id, 'progress-reported', `${id}:k3`, { emittedBy: 'p_someone_else' }),
      ).rejects.toThrow(/idempotency/i);
      expect(await events.history(WS, id)).toHaveLength(1);
    });

    it('conflicts when the TYPE differs, and when the EXECUTION differs', async () => {
      const a = await nextExecution();
      const b = await nextExecution();
      await append(a, 'registered', `${a}:k4`);
      await expect(append(a, 'started', `${a}:k4`)).rejects.toThrow(/idempotency/i);
      await expect(append(b, 'registered', `${a}:k4`)).rejects.toThrow(/idempotency/i);
    });

    it('a refused conflict consumes no sequence number', async () => {
      const id = await nextExecution();
      await append(id, 'registered', `${id}:k5`);
      await expect(
        append(id, 'registered', `${id}:k5`, { payload: { changed: true } }),
      ).rejects.toThrow(/idempotency/i);
      const next = await append(id, 'started', `${id}:k6`);
      expect(next.sequence).toBe(2);
    });
  });
});
