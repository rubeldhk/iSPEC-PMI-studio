/**
 * T1092 (EPIC-030 Phase C2A) — adjudication evidence is immutable, in the database.
 *
 * `FR-GEL-072`. This asserts the **attached trigger**, not the reusable
 * function. `reject_mutation()` existed long before this Epic and protects
 * fourteen other tables; it granted `adjudication_records` nothing until
 * `20260825000000_epic030_adjudication` bound a trigger to it, which was the
 * **fifteenth**. The C2A closure migration bound a sixteenth, to
 * `application_intents`. Counts and their evidence: `analysis.md`, C2A closure
 * session.
 *
 * Follows `T453`'s pattern (`audit-immutability.spec.ts`): a **fresh**
 * PostgreSQL with the migration SQL applied, so what is under test is the
 * committed migration file rather than whatever a developer's database happens
 * to contain.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from '../../helpers/postgres-image.js';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const INIT = resolve(here, '../../../prisma/migrations/20260814000000_init/migration.sql');
const ADJUDICATION = resolve(
  here,
  '../../../prisma/migrations/20260825000000_epic030_adjudication/migration.sql',
);

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T1092 · adjudication_records is append-only, enforced by PostgreSQL', () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;
  let recordId = '';

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    client = new Client({ connectionString: container.getConnectionUri() });
    await client.connect();

    // The init migration supplies reject_mutation() and workspaces; this
    // Epic's migration supplies the table and — crucially — the trigger.
    await client.query(readFileSync(INIT, 'utf8'));
    await client.query(readFileSync(ADJUDICATION, 'utf8'));

    // `workspaces.updatedAt` is NOT NULL with no default — Prisma's @updatedAt
    // is applied by the client, not the database, so raw SQL must supply it.
    await client.query(
      `INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('w-ev','Evidence fixture', NOW())`,
    );
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO "adjudication_records"
         ("id","workspaceId","proposalId","executionId","specificationId","idempotencyKey",
          "expectedStatus","requestedStatus","verdict","reason","proposerId","proposerType",
          "proposerSnapshotId","correlationId","causationId")
       VALUES (gen_random_uuid()::text,'w-ev','p-ev','e-ev','s-ev','k-ev',
               'draft','review','validated','gates satisfied','u1','agent','snap-1','c1','e-ev')
       RETURNING "id"`,
    );
    recordId = inserted.rows[0]!.id;
  }, 180_000);

  afterAll(async () => {
    await client?.end();
    await container?.stop();
  });

  it('wrote a record to mutate, or these assertions prove nothing', () => {
    expect(recordId, 'no adjudication record was inserted').not.toBe('');
  });

  it('the trigger exists on the table — the migration attached it', async () => {
    // The distinction this Epic had to correct: a reusable FUNCTION is not
    // protection. This asserts the binding, by name.
    const { rows } = await client.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger
       WHERE tgrelid = '"adjudication_records"'::regclass AND NOT tgisinternal`,
    );
    expect(rows.map((r) => r.tgname)).toContain('adjudication_records_immutable');
  });

  it('refuses UPDATE', async () => {
    await expect(
      client.query(`UPDATE "adjudication_records" SET "verdict"='applied' WHERE "id"=$1`, [
        recordId,
      ]),
    ).rejects.toThrow(/append-only/i);
  });

  it('refuses DELETE', async () => {
    await expect(
      client.query(`DELETE FROM "adjudication_records" WHERE "id"=$1`, [recordId]),
    ).rejects.toThrow(/append-only/i);
  });

  it('leaves the record intact after both refusals', async () => {
    const { rows } = await client.query<{ verdict: string }>(
      `SELECT "verdict" FROM "adjudication_records" WHERE "id"=$1`,
      [recordId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.verdict, 'the refused UPDATE changed the row anyway').toBe('validated');
  });

  it('accepts a superseding record — a correction is a new row, never an edit', async () => {
    await client.query(
      `INSERT INTO "adjudication_records"
         ("id","workspaceId","proposalId","executionId","specificationId","idempotencyKey",
          "expectedStatus","requestedStatus","verdict","reason","proposerId","proposerType",
          "proposerSnapshotId","correlationId","causationId")
       VALUES (gen_random_uuid()::text,'w-ev','p-ev','e-ev','s-ev','k-ev-2',
               'draft','review','refused','superseding decision','u1','agent','snap-1','c1','e-ev')`,
    );
    const { rows } = await client.query<{ verdict: string }>(
      `SELECT "verdict" FROM "adjudication_records" WHERE "proposalId"='p-ev' ORDER BY "idempotencyKey"`,
    );
    // Both survive. The history is the pair, not the latest value.
    expect(rows.map((r) => r.verdict)).toEqual(['validated', 'refused']);
  });

  it('redaction does not break the chain — the link survives, only the prose goes', async () => {
    // `FR-GEL-072`: "Redaction MUST NOT destroy the adjudication chain." Since
    // the table refuses UPDATE, a redaction cannot blank a field in place — it
    // is a new row. What must survive is the *linkage*: proposal -> verdict ->
    // applied transition. Only the free-text reason, which is where a secret
    // would leak, is withheld.
    await client.query(
      `INSERT INTO "adjudication_records"
         ("id","workspaceId","proposalId","executionId","specificationId","idempotencyKey",
          "expectedStatus","requestedStatus","verdict","reason","proposerId","proposerType",
          "proposerSnapshotId","correlationId","causationId","appliedTransitionId")
       VALUES (gen_random_uuid()::text,'w-ev','p-ev','e-ev','s-ev','k-ev-redacted',
               'draft','review','validated','[redacted]','u1','agent','snap-1','c1','e-ev','t-ev')`,
    );

    const { rows } = await client.query<{
      verdict: string;
      reason: string;
      proposalId: string;
      appliedTransitionId: string | null;
      correlationId: string;
    }>(
      `SELECT "verdict","reason","proposalId","appliedTransitionId","correlationId"
       FROM "adjudication_records" WHERE "idempotencyKey"='k-ev-redacted'`,
    );
    expect(rows).toHaveLength(1);
    const redacted = rows[0]!;

    // The prose is gone...
    expect(redacted.reason).toBe('[redacted]');
    // ...and every link an auditor needs is still there.
    expect(redacted.proposalId, 'redaction severed proposal -> record').toBe('p-ev');
    expect(redacted.appliedTransitionId, 'redaction severed record -> transition').toBe('t-ev');
    expect(redacted.correlationId, 'redaction severed the causal chain').toBe('c1');

    // And the pre-redaction rows are untouched — redaction appends, never erases.
    const { rows: all } = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM "adjudication_records" WHERE "proposalId"='p-ev'`,
    );
    expect(Number(all[0]!.n), 'redaction removed earlier evidence').toBe(3);
  });

  it('refuses a duplicate (workspace, proposal, key) — this is what makes retry safe', async () => {
    await expect(
      client.query(
        `INSERT INTO "adjudication_records"
           ("id","workspaceId","proposalId","executionId","specificationId","idempotencyKey",
            "expectedStatus","requestedStatus","verdict","reason","proposerId","proposerType",
            "proposerSnapshotId","correlationId","causationId")
         VALUES (gen_random_uuid()::text,'w-ev','p-ev','e-ev','s-ev','k-ev',
                 'draft','review','applied','a second decision','u1','agent','snap-1','c1','e-ev')`,
      ),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});
