/**
 * T339q — no AI takes a requirement decision, and the **database** says so.
 * `FR-RQR-041`, `SC-RQR-004`, `RULE-03`. Quickstart Scenario 6.
 *
 * *"Attempt a decision under an agent identity. Expected: refused — and refused
 * by a database check constraint, not only by a service branch."*
 *
 * **Why the constraint and not just the service.** `DecisionService` refuses a
 * non-human actor, and `T339o` proves it. That protects callers who come
 * through the service. This file protects everyone else: a migration, a
 * maintenance script, a psql session, a batch import, a future Room that
 * forgot. `SC-RQR-004` says **zero** requirement decisions are taken by a
 * non-human actor — not "zero via the service".
 *
 * **The two halves are proven independently, on purpose.** A test that drove
 * the service and observed a refusal could not tell you *which* layer refused,
 * so deleting the constraint would leave it green. Here the insert is written
 * by hand, in SQL, with the service nowhere in the picture — the only thing
 * that can refuse it is the constraint.
 *
 * **The mutation proof this file exists for**: drop the
 * `requirement_decisions_decided_by_a_human` constraint and this must fail.
 * Every other test in the Epic would stay green.
 *
 * RAID `R-04`: needs a container runtime. Skipped loudly where none exists,
 * following `T337w`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T339q · the database refuses a decision taken by an AI', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(
      `INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('ws_ai','ai probe',now())`,
    );
  }, 180_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  /** One decision insert. Nothing here goes near `DecisionService`. */
  const insert = (id: string, kind: string) =>
    db.query(
      `INSERT INTO "requirement_decisions"
         ("id","workspaceId","roomObjectId","decidedBy","decidedByKind","authorityBasis",
          "objectVersion","chosenOption","declinedOptions","rationale","decisionId")
       VALUES ($1,'ws_ai','ro_ai',$2,$3::"DecidedByKind",'product-owner may approve',
               3,'opt_a','[]'::jsonb,'the reviewer loses their place','dpe_1')`,
      [id, kind === 'human' ? 'user_1' : 'claude-1', kind],
    );

  it('accepts a decision taken by a human — or the refusal below proves nothing', async () => {
    // Anti-vacuity. Without this, a constraint refusing EVERY insert would
    // satisfy the next test while breaking the feature entirely.
    await expect(insert('rd_human', 'human')).resolves.toBeDefined();
  });

  it('refuses a decision taken by an agent', async () => {
    await expect(insert('rd_agent', 'agent')).rejects.toThrow();
  });

  it('names the constraint, so the refusal is traceable to the rule', async () => {
    const error = await insert('rd_agent_2', 'agent').then(
      () => null,
      (err: unknown) => err as { constraint?: string; message?: string },
    );

    // A refusal nobody can trace back to a requirement is one somebody removes
    // while tidying up.
    expect(error?.constraint ?? error?.message).toMatch(/human/i);
  });

  it('refuses an agent decision even when every other field is impeccable', async () => {
    // The realistic failure: a well-formed row from a batch import or an
    // automation that filled in a rationale and an authority basis, and got the
    // one field that matters wrong.
    await expect(insert('rd_agent_3', 'agent')).rejects.toThrow();
  });

  it('offers no third actor kind to slip through', async () => {
    const { rows } = await db.query<{ label: string }>(
      `SELECT unnest(enum_range(NULL::"DecidedByKind"))::text AS label`,
    );

    // `DecidedByKind` is human | agent. A third member — "system", "service",
    // "automation" — is how an AI decision would arrive wearing a different
    // word, past a constraint that only names one.
    expect(rows.map((r) => r.label).sort()).toEqual(['agent', 'human']);
  });

  it('keeps the rule on the table, not on a view or a trigger that can be dropped quietly', async () => {
    const { rows } = await db.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = '"requirement_decisions"'::regclass AND contype = 'c'`,
    );

    expect(rows.map((r) => r.conname)).toContain('requirement_decisions_decided_by_a_human');
  });

  it('has recorded exactly the human decision and none of the refused ones', async () => {
    const { rows } = await db.query<{ id: string }>(
      `SELECT "id" FROM "requirement_decisions" WHERE "roomObjectId" = 'ro_ai' ORDER BY "id"`,
    );

    // SC-RQR-004 stated as a count, which is how the criterion is written.
    expect(rows.map((r) => r.id)).toEqual(['rd_human']);
  });
});
