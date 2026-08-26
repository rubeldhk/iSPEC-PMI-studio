/**
 * T1096, T1097 (EPIC-030 C2A closure) — serialisation and persistence of all
 * six verdicts, against a real PostgreSQL.
 *
 * Two things are under test and they are different:
 *
 * 1. **Round-trip fidelity.** A verdict written by `PrismaAdjudicationRecords`
 *    and read back through `findByIdempotency` must be the same verdict. The
 *    discriminated union means each variant carries different fields, so a
 *    mapping that silently dropped one would produce a verdict of the right
 *    *name* and the wrong *content* — which a `verdict === 'refused'` assertion
 *    would happily pass.
 *
 * 2. **The database refuses what the type refuses.** The union makes invalid
 *    combinations unconstructible in TypeScript. CHECK constraints make them
 *    unwritable by anything else — a migration, a console, a future service.
 *    Asserting only the type would leave the second door open.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import type { AdjudicationProposal } from '@pmi/loop-contract';
import {
  PrismaAdjudicationRecords,
  PrismaApplicationIntents,
} from '../../../src/modules/loop/adjudication.adapters';
import type { AdjudicationEvidenceInput } from '../../../src/modules/loop/adjudicator.service';
import { verdictFromRow, rowFromEvidence } from '../../../src/modules/loop/adjudication-evidence';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WORKSPACE = 'ws_persist';

const PROPOSAL: AdjudicationProposal = {
  proposalId: 'p-persist',
  executionId: 'e-persist',
  workspaceId: WORKSPACE,
  specificationId: 's-persist',
  expectedCurrentStatus: 'draft',
  requestedStatus: 'review',
  targetVersion: 2,
  proposerId: 'u1',
  proposerType: 'human',
  proposerIdentitySnapshotId: 'snap-1',
  originatingConnector: 'persistence-test',
  evidenceRefs: [],
  reason: 'round trip',
  correlationId: 'c1',
  causationId: 'e-persist',
  idempotencyKey: 'k-base',
  proposedAt: '2026-08-25T12:00:00.000Z',
};

/** One input per verdict, so the round trip is exercised across the whole union. */
const CASES: { name: string; input: AdjudicationEvidenceInput }[] = [
  {
    name: 'validated',
    input: { proposal: p('k-validated'), verdict: 'validated', reason: 'policy withheld apply' },
  },
  {
    name: 'applied',
    input: {
      proposal: p('k-applied'),
      verdict: 'applied',
      reason: 'EPIC-009 confirmed',
      appliedTransitionId: 't-real',
    },
  },
  {
    name: 'approval_required',
    input: {
      proposal: p('k-approval'),
      verdict: 'approval_required',
      reason: 'needs a reviewer',
      requiredApproverRole: 'approve:review',
    },
  },
  {
    name: 'refused',
    input: {
      proposal: p('k-refused'),
      verdict: 'refused',
      reason: 'an agent may not approve its own proposal',
      refusalStage: 'approval',
      refusalReasonCode: 'self_approval_prohibited',
    },
  },
  {
    name: 'inconsistent',
    input: {
      proposal: p('k-inconsistent'),
      verdict: 'inconsistent',
      reason: 'the world moved',
      observedStatus: 'approved',
    },
  },
  {
    name: 'reconciliation_required',
    input: {
      proposal: p('k-reconcile'),
      verdict: 'reconciliation_required',
      reason: 'timeout',
      reconciliationCause: 'application_outcome_unknown',
      reconciliationDetail: 'no response in 30s',
    },
  },
];

function p(key: string): AdjudicationProposal {
  return { ...PROPOSAL, idempotencyKey: key };
}

suite('T1096 · every verdict survives a real round trip', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;
  let records: PrismaAdjudicationRecords;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
      WORKSPACE,
      'persistence',
    ]);

    process.env['DATABASE_URL'] = container.getConnectionUri();
    const { prismaClient } = await import('../../../src/persistence/prisma.js');
    const prisma = prismaClient();
    records = new PrismaAdjudicationRecords({
      create: (args) => prisma.adjudicationRecord.create(args as never) as Promise<{ id: string }>,
      findUnique: (args) => prisma.adjudicationRecord.findUnique(args as never) as never,
    });
  }, 240_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  for (const { name, input } of CASES) {
    it(`${name} — written and read back identically`, async () => {
      const id = await records.record(input);
      expect(id, 'no row id came back').toBeTruthy();

      const read = await records.findByIdempotency(
        WORKSPACE,
        input.proposal.proposalId,
        input.proposal.idempotencyKey,
      );
      expect(read, 'the row did not read back').not.toBeNull();
      // Compared against the in-memory projection of the same input, so a field
      // dropped on the way to the database shows up as a difference rather than
      // as two matching mistakes.
      expect(read).toEqual(verdictFromRow(rowFromEvidence(input, id)));
      expect(read!.verdict).toBe(name);
    });
  }

  it('only `applied` carries a transition id, after a real round trip', async () => {
    for (const { name, input } of CASES) {
      const read = await records.findByIdempotency(
        WORKSPACE,
        input.proposal.proposalId,
        input.proposal.idempotencyKey,
      );
      if (name === 'applied') expect(read!.appliedTransitionId).toBe('t-real');
      else expect(read!.appliedTransitionId, `${name} came back with a transition id`).toBeUndefined();
    }
  });

  it('derives the refusal stage from the code rather than trusting the column', async () => {
    // A stored stage that disagreed with its code would put event selection
    // back to guessing, so rehydration recomputes it.
    const read = await records.findByIdempotency(WORKSPACE, 'p-persist', 'k-refused');
    expect(read!.verdict).toBe('refused');
    if (read!.verdict !== 'refused') throw new Error('not refused');
    expect(read!.refusalStage).toBe('approval');
    expect(read!.refusalReasonCode).toBe('self_approval_prohibited');
  });

  it('returns null for a key nobody wrote', async () => {
    expect(await records.findByIdempotency(WORKSPACE, 'p-persist', 'never-written')).toBeNull();
  });
});

suite('T1096 · the database refuses what the type refuses', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
      WORKSPACE,
      'constraints',
    ]);
  }, 240_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  /** Insert with explicit columns so each constraint can be aimed at directly. */
  async function insert(cols: Record<string, string | null>): Promise<void> {
    const base: Record<string, string | null> = {
      workspaceId: WORKSPACE,
      proposalId: 'p-c',
      executionId: 'e-c',
      specificationId: 's-c',
      expectedStatus: 'draft',
      requestedStatus: 'review',
      reason: 'constraint probe',
      proposerId: 'u1',
      proposerType: 'human',
      proposerSnapshotId: 'snap',
      correlationId: 'c1',
      causationId: 'e-c',
      ...cols,
    };
    const names = Object.keys(base);
    const values = names.map((_, i) => `$${i + 1}`);
    await db.query(
      `INSERT INTO "adjudication_records" ("id", ${names.map((n) => `"${n}"`).join(',')})
       VALUES (gen_random_uuid()::text, ${values.join(',')})`,
      names.map((n) => base[n] ?? null),
    );
  }

  it('refuses `applied` with no transition id', async () => {
    await expect(
      insert({ idempotencyKey: 'c1', verdict: 'applied', appliedTransitionId: null }),
    ).rejects.toThrow(/applied_has_transition/);
  });

  it('refuses a transition id on a verdict that is not `applied`', async () => {
    // The combination the union exists to eliminate.
    await expect(
      insert({ idempotencyKey: 'c2', verdict: 'validated', appliedTransitionId: 't-nope' }),
    ).rejects.toThrow(/applied_has_transition/);
  });

  it('refuses `refused` with no stage or code', async () => {
    await expect(insert({ idempotencyKey: 'c3', verdict: 'refused' })).rejects.toThrow(
      /refused_has_stage_and_code/,
    );
  });

  it('refuses a refusal stage on a verdict that is not `refused`', async () => {
    await expect(
      insert({ idempotencyKey: 'c4', verdict: 'validated', refusalStage: 'validation' }),
    ).rejects.toThrow(/refused_has_stage_and_code/);
  });

  it('refuses a reason code outside the vocabulary', async () => {
    await expect(
      insert({
        idempotencyKey: 'c5',
        verdict: 'refused',
        refusalStage: 'validation',
        refusalReasonCode: 'because_i_said_so',
      }),
    ).rejects.toThrow(/refusal_reason_vocabulary/);
  });

  it('refuses `approval_required` with no role, and `inconsistent` with no observed status', async () => {
    await expect(insert({ idempotencyKey: 'c6', verdict: 'approval_required' })).rejects.toThrow(
      /approval_required_has_role/,
    );
    await expect(insert({ idempotencyKey: 'c7', verdict: 'inconsistent' })).rejects.toThrow(
      /inconsistent_has_observed/,
    );
  });

  it('refuses `reconciliation_required` with no cause', async () => {
    await expect(
      insert({ idempotencyKey: 'c8', verdict: 'reconciliation_required' }),
    ).rejects.toThrow(/reconciliation_has_cause/);
  });

  it('refuses a verdict outside the six', async () => {
    await expect(insert({ idempotencyKey: 'c9', verdict: 'probably_fine' })).rejects.toThrow(
      /verdict_vocabulary/,
    );
  });

  it('accepts every one of the six when correctly formed — the checks are not blanket refusals', async () => {
    // Without this, a constraint that rejected everything would pass all of the
    // above and look like airtight enforcement.
    await insert({ idempotencyKey: 'ok1', verdict: 'validated' });
    await insert({ idempotencyKey: 'ok2', verdict: 'applied', appliedTransitionId: 't1' });
    await insert({
      idempotencyKey: 'ok3',
      verdict: 'approval_required',
      requiredApproverRole: 'approve:review',
    });
    await insert({
      idempotencyKey: 'ok4',
      verdict: 'refused',
      refusalStage: 'transition',
      refusalReasonCode: 'lifecycle_application_refused',
    });
    await insert({ idempotencyKey: 'ok5', verdict: 'inconsistent', observedStatus: 'approved' });
    await insert({
      idempotencyKey: 'ok6',
      verdict: 'reconciliation_required',
      reconciliationCause: 'application_transition_unidentified',
    });
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "adjudication_records"`,
    );
    expect(Number(rows[0]!.n)).toBe(6);
  });
});

suite('T1097 · the durable intent store is append-only', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;
  let intents: PrismaApplicationIntents;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
      WORKSPACE,
      'intents',
    ]);
    process.env['DATABASE_URL'] = container.getConnectionUri();
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
    intents = new PrismaApplicationIntents({
      create: (args) => prisma.applicationIntent.create(args as never) as Promise<{ id: string }>,
    });
  }, 240_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  it('settling APPENDS rather than updating, so the attempt survives its outcome', async () => {
    const intentId = await intents.open({
      workspaceId: WORKSPACE,
      specificationId: 's1',
      from: 'draft',
      to: 'review',
      actorId: 'u1',
    });
    await intents.settle(intentId, WORKSPACE, 'unknown');

    const { rows } = await db.query<{ phase: string; outcome: string | null }>(
      `SELECT "phase","outcome" FROM "application_intents" WHERE "intentId" = $1 ORDER BY "phase"`,
      [intentId],
    );
    expect(rows.map((r) => r.phase)).toEqual(['opened', 'settled']);
    expect(rows[0]!.outcome, 'the opened row acquired an outcome').toBeNull();
    expect(rows[1]!.outcome).toBe('unknown');
  });

  it('the trigger exists and refuses UPDATE and DELETE', async () => {
    const { rows } = await db.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger
       WHERE tgrelid = '"application_intents"'::regclass AND NOT tgisinternal`,
    );
    expect(rows.map((r) => r.tgname)).toContain('application_intents_immutable');

    await expect(
      db.query(`UPDATE "application_intents" SET "outcome" = 'confirmed'`),
    ).rejects.toThrow(/append-only/i);
    await expect(db.query(`DELETE FROM "application_intents"`)).rejects.toThrow(/append-only/i);
  });

  it('refuses a settled row with no outcome, and an opened row that claims one', async () => {
    await expect(
      db.query(
        `INSERT INTO "application_intents"
           ("id","workspaceId","intentId","phase","specificationId","expectedStatus","requestedStatus","actorId")
         VALUES (gen_random_uuid()::text,$1,'i-bad','settled','s','draft','review','u1')`,
        [WORKSPACE],
      ),
    ).rejects.toThrow(/settled_has_outcome/);
    await expect(
      db.query(
        `INSERT INTO "application_intents"
           ("id","workspaceId","intentId","phase","specificationId","expectedStatus","requestedStatus","actorId","outcome")
         VALUES (gen_random_uuid()::text,$1,'i-bad2','opened','s','draft','review','u1','confirmed')`,
        [WORKSPACE],
      ),
    ).rejects.toThrow(/settled_has_outcome/);
  });
});
