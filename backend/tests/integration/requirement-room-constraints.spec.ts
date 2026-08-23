/**
 * T337w — the two constraints, at the database. `FR-RQR-041`, `RULE-02`,
 * `BR-0025`, `BR-0026`, `FR-RQR-032`.
 *
 * Why the database and not the service: a service check protects callers who go
 * through the service. `EPIC-031` evaluates decision authority and is the
 * braces; this is the belt, and it protects everyone else — a migration, a
 * maintenance script, a psql session, a future Room that forgot.
 *
 * The two that matter:
 *
 *   - **an agent-taken decision is rejected** (`FR-RQR-041`). `RULE-03` says AI
 *     recommends and humans govern; this is the one failure this Room exists to
 *     prevent, so it is not left to application code;
 *   - **a baseline is superseded, never rewritten** (`RULE-02`, `BR-0026`).
 *     Rewriting one changes what an approved decision approved, silently and
 *     after the fact — and `FR-RQR-051`'s whole refusal rests on the frozen set
 *     staying frozen.
 *
 * RAID R-04: needs a container runtime. Skipped loudly where none exists.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T337w · the Requirement Room constraints reject at the database', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('ws_rr','rr probe',now())`);
  }, 180_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  /** One decision insert, with the fields a caller would have to get wrong on purpose. */
  const decision = (id: string, kind: string, rationale = 'because the stakeholder asked') =>
    db.query(
      `INSERT INTO "requirement_decisions"
         ("id","workspaceId","roomObjectId","decidedBy","decidedByKind","authorityBasis",
          "objectVersion","chosenOption","declinedOptions","rationale")
       VALUES ($1,'ws_rr','ro_1','actor_1',$2::"DecidedByKind",'product-owner',0,'option-a','[]'::jsonb,$3)`,
      [id, kind, rationale],
    );

  describe('FR-RQR-041 · a requirement decision is taken by a human', () => {
    it('accepts a human decision, or every assertion below means nothing', async () => {
      await decision('rd_human', 'human');
      const { rows } = await db.query(
        `SELECT "decidedByKind"::text AS kind FROM "requirement_decisions" WHERE "id" = 'rd_human'`,
      );
      expect(rows[0].kind).toBe('human');
    });

    it('REJECTS an agent-taken decision', async () => {
      // RULE-03 made unrepresentable rather than merely forbidden. The enum has
      // an `agent` member deliberately — so the refusal is about the DECISION,
      // not about a value the schema cannot express.
      await expect(decision('rd_agent', 'agent')).rejects.toThrow(
        /requirement_decisions_decided_by_a_human/,
      );
    });
  });

  describe('BR-0025 · a decision states its rationale', () => {
    it('rejects an empty rationale', async () => {
      // "" passes a NOT NULL check and explains nothing, which is why the
      // constraint tests length after trimming rather than nullness.
      await expect(decision('rd_blank', 'human', '')).rejects.toThrow(
        /requirement_decisions_state_their_rationale/,
      );
    });

    it('rejects whitespace as a rationale', async () => {
      await expect(decision('rd_space', 'human', '   ')).rejects.toThrow(
        /requirement_decisions_state_their_rationale/,
      );
    });
  });

  describe('RULE-02, BR-0026 · a baseline is superseded, never rewritten', () => {
    beforeAll(async () => {
      await db.query(
        `INSERT INTO "baselines"
           ("id","workspaceId","projectId","version","memberVersionIds","setHash",
            "approvedBy","rationale","decisionId")
         VALUES ('bl_1','ws_rr','p_1',1,'["rv_1","rv_2"]'::jsonb,'hash_abc','u_owner',
                 'the set is complete','rd_human')`,
      );
    });

    it('refuses to rewrite the frozen member set', async () => {
      // FR-RQR-051's refusal rests entirely on this. If the set could change,
      // "you cannot edit a baselined requirement" would be true of the edit path
      // and false of the database.
      await expect(
        db.query(
          `UPDATE "baselines" SET "memberVersionIds" = '["rv_9"]'::jsonb WHERE "id" = 'bl_1'`,
        ),
      ).rejects.toThrow(/superseded, never rewritten/);
    });

    it('refuses to rewrite the setHash', async () => {
      await expect(
        db.query(`UPDATE "baselines" SET "setHash" = 'hash_zzz' WHERE "id" = 'bl_1'`),
      ).rejects.toThrow(/superseded, never rewritten/);
    });

    it('refuses to rewrite who approved it', async () => {
      await expect(
        db.query(`UPDATE "baselines" SET "approvedBy" = 'someone_else' WHERE "id" = 'bl_1'`),
      ).rejects.toThrow(/superseded, never rewritten/);
    });

    it('refuses DELETE', async () => {
      await expect(db.query(`DELETE FROM "baselines" WHERE "id" = 'bl_1'`)).rejects.toThrow(
        /append-only/,
      );
    });

    it('PERMITS setting supersededBy — the one column a change may touch', async () => {
      // The distinction that makes this trigger different from a blanket
      // append-only rule: superseding is how a new baseline records that it
      // replaced this one, and forbidding it would make BR-0026 unimplementable.
      await db.query(`UPDATE "baselines" SET "supersededBy" = 2 WHERE "id" = 'bl_1'`);
      const { rows } = await db.query(
        `SELECT "supersededBy" FROM "baselines" WHERE "id" = 'bl_1'`,
      );
      expect(rows[0].supersededBy).toBe(2);
    });

    it('still refuses a rewrite smuggled in alongside a supersede', async () => {
      // The bypass a naive "did supersededBy change?" check would allow.
      await expect(
        db.query(
          `UPDATE "baselines" SET "supersededBy" = 3, "setHash" = 'hash_sneaky' WHERE "id" = 'bl_1'`,
        ),
      ).rejects.toThrow(/superseded, never rewritten/);
    });
  });

  describe('FR-RQR-032 · a baseline exception is explicit', () => {
    const exception = (id: string, authorizedBy: string, reason: string) =>
      db.query(
        `INSERT INTO "baseline_exceptions"
           ("id","workspaceId","baselineId","requirementVersionId","condition","authorizedBy","reason")
         VALUES ($1,'ws_rr','bl_1','rv_1','missing-acceptance-criteria',$2,$3)`,
        [id, authorizedBy, reason],
      );

    it('accepts one naming its authorizer and its reason', async () => {
      await exception('be_ok', 'u_owner', 'criteria arrive with the design spike');
      const { rows } = await db.query(`SELECT count(*)::int AS n FROM "baseline_exceptions"`);
      expect(rows[0].n).toBe(1);
    });

    it.each([
      ['no authorizer', '', 'a reason'],
      ['no reason', 'u_owner', ''],
      ['neither', '', ''],
      ['whitespace only', '   ', '   '],
    ])('rejects one with %s', async (_label, authorizedBy, reason) => {
      await expect(exception(`be_${Math.random()}`, authorizedBy, reason)).rejects.toThrow(
        /baseline_exceptions_are_explicit/,
      );
    });
  });

  describe('FR-RQR-013 · an answered clarification is retained', () => {
    beforeAll(async () => {
      await db.query(
        `INSERT INTO "clarifications" ("id","workspaceId","roomObjectId","question","askedBy")
         VALUES ('cl_1','ws_rr','ro_1','which stakeholder owns this?','u_analyst')`,
      );
    });

    it('permits UPDATE — that is how an answer arrives', async () => {
      await db.query(
        `UPDATE "clarifications" SET "answer" = 'the finance lead', "answeredBy" = 'u_pm',
         "answeredAt" = now() WHERE "id" = 'cl_1'`,
      );
      const { rows } = await db.query(`SELECT "answer" FROM "clarifications" WHERE "id" = 'cl_1'`);
      expect(rows[0].answer).toBe('the finance lead');
    });

    it('refuses DELETE — the answer is part of the record, not scaffolding', async () => {
      await expect(db.query(`DELETE FROM "clarifications" WHERE "id" = 'cl_1'`)).rejects.toThrow();
    });
  });
});
