/**
 * T732 — the two fences reject at the database, not in a service branch.
 * `FR-DPE-040`, `FR-DPE-010`, `FR-DPE-012`, `ADR-0025` constraints 1 and 3.
 *
 * - **An unexplained decision is not representable**: `explanationId` is
 *   `NOT NULL` and a foreign key, so a decision row with no explanation row
 *   behind it cannot be inserted by anything — a service, a migration, psql.
 * - **An auto-approved high-band decision is not representable**:
 *   `effectiveClass = 'high' ⇒ actorKind = 'human'`.
 *
 * A closure (`FR-DPE-017`) carries its kind and its reason together, or neither.
 *
 * And the tables are append-only: a decision taken stays taken, and an
 * explanation written stays as written (`FR-DPE-044`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const WS = 'ws_dpe';

const COLUMNS = `"id","workspaceId","projectId","actionType","targetType","targetId","effectiveClass","outcome",
  "decidedBy","authorityBasis","objectVersion","actorKind","actorId","steeringVersions","policyVersion",
  "requiredGates","gateOutcomes","explanationId"`;

function decision(id: string, overrides: Record<string, unknown> = {}): unknown[] {
  const row: Record<string, unknown> = {
    effectiveClass: 'medium',
    outcome: 'approved',
    decidedBy: 'u1',
    actorKind: 'human',
    explanationId: 'ex_probe',
    ...overrides,
  };
  return [
    id, WS, 'p1', 'deploy', 'service', 's1', row['effectiveClass'], row['outcome'], row['decidedBy'],
    'workspace member', '1', row['actorKind'], 'u1', '{}', 1, '[]', '[]', row['explanationId'],
  ];
}

const insertDecision = (db: Client, id: string, overrides: Record<string, unknown> = {}) =>
  db.query(
    `INSERT INTO "policy_decisions" (${COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    decision(id, overrides),
  );

suite('T732 · the decision fences hold in PostgreSQL', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'dpe',now())`, [WS]);
    await db.query(
      `INSERT INTO "decision_explanations" ("id","workspaceId","policyVersion","riskClass","authorityApplied")
       VALUES ('ex_probe',$1,'1','medium','gates required')`,
      [WS],
    );
    await insertDecision(db, 'd_probe');
  }, 300_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  }, 120_000);

  it('holds the probe decision — the control', async () => {
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "policy_decisions"`);
    expect(rows[0].n).toBe(1);
  });

  describe('FR-DPE-040 — an unexplained decision is not representable', () => {
    it('refuses a decision with no explanation', async () => {
      await expect(insertDecision(db, 'd_null', { explanationId: null })).rejects.toThrow(/explanationId|not-null/);
    });

    it('refuses a decision naming an explanation that does not exist', async () => {
      await expect(insertDecision(db, 'd_ghost', { explanationId: 'ex_nowhere' })).rejects.toThrow(
        /policy_decisions_explanationId_fkey/,
      );
    });
  });

  describe('FR-DPE-010, FR-DPE-012 — the high band is human', () => {
    it.each(['auto-executed', 'approved', 'exception'])('refuses a high-band %s decision taken by automation', async (outcome) => {
      await expect(
        insertDecision(db, `d_auto_${outcome}`, { effectiveClass: 'high', actorKind: 'automation', outcome }),
      ).rejects.toThrow(/policy_decisions_high_band_is_human/);
    });

    it('accepts a high-band decision taken by a human — the fence is about the actor', async () => {
      await insertDecision(db, 'd_human_high', { effectiveClass: 'high', actorKind: 'human' });
    });

    it.each(['pending', 'refused'])(
      'records automation ASKING for a high-band action as %s — asking is not taking (FR-DPE-016)',
      async (outcome) => {
        await insertDecision(db, `d_auto_ask_${outcome}`, {
          effectiveClass: 'high',
          actorKind: 'automation',
          outcome,
          decidedBy: outcome === 'pending' ? null : 'policy',
        });
      },
    );
  });

  describe('the vocabularies and the actor', () => {
    it.each([
      ['a fourth band', { effectiveClass: 'unknown' }, /effective_class_is_a_band/],
      ['an unknown outcome', { outcome: 'skipped' }, /outcome_known/],
      ['a decided outcome with no decider', { outcome: 'approved', decidedBy: null }, /decided_names_who/],
      ['a decided outcome with a blank decider', { outcome: 'refused', decidedBy: '  ' }, /decided_names_who/],
    ])('refuses %s', async (_label, overrides, constraint) => {
      await expect(insertDecision(db, `d_${Math.random()}`, overrides)).rejects.toThrow(constraint);
    });

    it('accepts a pending decision with no decider yet', async () => {
      await insertDecision(db, 'd_pending', { outcome: 'pending', decidedBy: null });
    });
  });

  describe('T2508 · FR-DPE-017 — a closure states its kind and its reason together', () => {
    const insertExplanation = (id: string, kind: string | null, reason: string | null) =>
      db.query(
        `INSERT INTO "decision_explanations" ("id","workspaceId","policyVersion","riskClass","authorityApplied","closureKind","closureReason")
         VALUES ($1,$2,'1','high','closed',$3,$4)`,
        [id, WS, kind, reason],
      );

    it.each([
      ['a closure kind with no reason', 'rejected', null],
      ['a closure kind with a blank reason', 'withdrawn', '   '],
      ['a reason with no closure kind', null, 'because'],
      ['an unknown closure kind', 'cancelled', 'because'],
    ])('refuses %s', async (_label, kind, reason) => {
      await expect(insertExplanation(`ex_${Math.random()}`, kind, reason)).rejects.toThrow(/closure_states_kind_and_reason/);
    });

    it.each(['rejected', 'withdrawn', 'expired'])('accepts a %s closure with its reason', async (kind) => {
      await insertExplanation(`ex_${kind}`, kind, 'stated reason');
    });

    it('accepts an explanation that is not a closure — both columns absent', async () => {
      await insertExplanation('ex_not_a_closure', null, null);
    });
  });

  describe('FR-DPE-044 — append-only', () => {
    it.each([
      ['policy_decisions', 'd_probe', `"outcome" = 'refused'`],
      ['decision_explanations', 'ex_probe', `"riskClass" = 'low'`],
    ])('%s rejects UPDATE and DELETE', async (table, id, set) => {
      await expect(db.query(`UPDATE "${table}" SET ${set} WHERE "id" = $1`, [id])).rejects.toThrow(
        new RegExp(`${table} is append-only`),
      );
      await expect(db.query(`DELETE FROM "${table}" WHERE "id" = $1`, [id])).rejects.toThrow(
        new RegExp(`${table} is append-only`),
      );
    });
  });
});
