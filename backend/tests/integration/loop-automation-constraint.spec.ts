/**
 * T993q — `RULE-11` at the database (`FR-GEL-031`, `FR-GEL-014`, `FR-GEL-033`).
 *
 * *"Every automated transition MUST be explainable from a visible rule."* A
 * service check satisfies that for callers who go through the service. This
 * asserts it for everyone, including a migration, a maintenance script and a
 * psql session — which is the population `RULE-11` is actually about, because
 * an automation that wrote its own row is exactly the invisible automation the
 * rule forbids.
 *
 * Three constraints, one test file, because they are one idea: a transition
 * record that cannot be interpreted must not be writable.
 *
 *   - automation names its rule (`FR-GEL-031`);
 *   - a refusal states its reason and an acceptance does not (`FR-GEL-014`);
 *   - one rule, one event, one advance (`FR-GEL-033`) — and the index is
 *     partial, so a *refused* second firing is still recordable.
 *
 * RAID R-04: needs a container runtime. Skipped loudly where none exists.
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

/** One INSERT, with the fields a caller would have to get wrong on purpose. */
function insertTransition(
  db: Client,
  overrides: Partial<{
    id: string;
    objectVersion: number;
    toStage: string;
    outcome: string;
    refusalReason: string | null;
    actorKind: string;
    triggerRuleId: string | null;
    triggerEventId: string | null;
  }>,
): Promise<unknown> {
  const row = {
    id: 'lt_' + Math.random().toString(36).slice(2, 10),
    objectVersion: 0,
    toStage: 'Context',
    outcome: 'accepted',
    refusalReason: null,
    actorKind: 'human',
    triggerRuleId: null,
    triggerEventId: null,
    ...overrides,
  };
  return db.query(
    `INSERT INTO "loop_transitions"
       ("id","workspaceId","objectId","objectVersion","fromStage","toStage","outcome",
        "refusalReason","actorId","actorKind","authorityBasis","triggerRuleId",
        "triggerEventId","configVersion","gateOutcomes")
     VALUES ($1,'ws_auto','lo_auto',$2,'Event',$3,$4::"LoopTransitionOutcome",$5,
             'actor_1',$6::"LoopActorKind",'probe-authority',$7,$8,1,'[]'::jsonb)`,
    [
      row.id,
      row.objectVersion,
      row.toStage,
      row.outcome,
      row.refusalReason,
      row.actorKind,
      row.triggerRuleId,
      row.triggerEventId,
    ],
  );
}

suite('T993q · the database refuses a transition record nobody could interpret', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
      'ws_auto',
      'automation constraint probe',
    ]);
    await db.query(
      `INSERT INTO "loop_objects"
         ("id","workspaceId","projectId","workflowType","configVersion",
          "subjectType","subjectId","currentStage","version")
       VALUES ('lo_auto','ws_auto','p_auto','probe-type',1,'opaque','subj_1','Event',0)`,
    );
  }, 180_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  });

  describe('FR-GEL-031 · an automated transition names the rule that fired it', () => {
    it('refuses automation with no triggerRuleId', async () => {
      await expect(
        insertTransition(db, { actorKind: 'automation', triggerRuleId: null }),
      ).rejects.toThrow(/loop_transitions_automation_names_its_rule/);
    });

    it('accepts automation that names its rule', async () => {
      // Anti-vacuity: if the constraint rejected everything, the assertion above
      // would pass for the wrong reason.
      await insertTransition(db, {
        id: 'lt_auto_ok',
        actorKind: 'automation',
        triggerRuleId: 'rule_nightly_advance',
        triggerEventId: 'evt_1',
      });
      const { rows } = await db.query(
        `SELECT "triggerRuleId" FROM "loop_transitions" WHERE "id" = 'lt_auto_ok'`,
      );
      expect(rows[0].triggerRuleId).toBe('rule_nightly_advance');
    });

    it('leaves a human transition free of a rule id — the rule binds automation only', async () => {
      await insertTransition(db, { id: 'lt_human_ok', actorKind: 'human', triggerRuleId: null });
      const { rows } = await db.query(
        `SELECT "actorKind"::text AS kind FROM "loop_transitions" WHERE "id" = 'lt_human_ok'`,
      );
      expect(rows[0].kind).toBe('human');
    });
  });

  describe('FR-GEL-014 · a refusal states its reason, an acceptance does not', () => {
    it('refuses a non-accepted outcome with no reason', async () => {
      await expect(
        insertTransition(db, { outcome: 'refused', refusalReason: null }),
      ).rejects.toThrow(/loop_transitions_refusal_states_its_reason/);
    });

    it('refuses an acceptance that carries a refusal reason', async () => {
      // Asserted in both directions on purpose: "accepted, and here is why it
      // was refused" is a row nobody can interpret, and a one-directional
      // constraint would let it exist.
      await expect(
        insertTransition(db, { outcome: 'accepted', refusalReason: 'no authority' }),
      ).rejects.toThrow(/loop_transitions_refusal_states_its_reason/);
    });

    it('accepts a refusal that states its reason', async () => {
      await insertTransition(db, {
        id: 'lt_refused_ok',
        outcome: 'refused',
        refusalReason: 'actor holds no authority for this transition',
      });
      const { rows } = await db.query(
        `SELECT "refusalReason" FROM "loop_transitions" WHERE "id" = 'lt_refused_ok'`,
      );
      expect(rows[0].refusalReason).toMatch(/no authority/);
    });
  });

  describe('FR-GEL-033 · one rule, one event, one advance', () => {
    it('refuses a second ACCEPTED advance for the same rule and event', async () => {
      await insertTransition(db, {
        id: 'lt_idem_1',
        actorKind: 'automation',
        triggerRuleId: 'rule_idem',
        triggerEventId: 'evt_idem',
      });
      await expect(
        insertTransition(db, {
          id: 'lt_idem_2',
          actorKind: 'automation',
          triggerRuleId: 'rule_idem',
          triggerEventId: 'evt_idem',
        }),
      ).rejects.toThrow(/loop_transitions_one_advance_per_rule_event/);
    });

    it('still records a REFUSED second firing — the index is partial for this reason', async () => {
      // The record of the guard working is itself evidence, and a total unique
      // index would suppress exactly that. This is the assertion that would fail
      // if someone "simplified" the index by dropping its WHERE clause.
      await insertTransition(db, {
        id: 'lt_idem_refused',
        actorKind: 'automation',
        triggerRuleId: 'rule_idem',
        triggerEventId: 'evt_idem',
        outcome: 'refused',
        refusalReason: 'already advanced for this event',
      });
      const { rows } = await db.query(
        `SELECT count(*)::int AS n FROM "loop_transitions"
         WHERE "triggerRuleId" = 'rule_idem' AND "triggerEventId" = 'evt_idem'`,
      );
      expect(rows[0].n).toBe(2);
    });
  });
});
