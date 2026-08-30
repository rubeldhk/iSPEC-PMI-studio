/**
 * `T406t` (EPIC-034) — the three constraints, proved against PostgreSQL.
 *
 * Each is a **belt beside a brace**: the services enforce the same rules, and
 * these hold when a caller bypasses the service. That is not redundancy — the
 * human-decider rule in particular sits beside `EPIC-031`'s policy engine, and
 * the whole point is that the fence survives someone reaching past it.
 *
 * The third constraint is the subtle one. `FR-CHR-032` lets an unreachable
 * impact source degrade to `unknown`, and the entire value of that state is
 * being distinguishable from `not-impacted`. An `unknown` row with no reason is
 * indistinguishable from a row nobody filled in, so the reason is required
 * exactly when the state is `unknown`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_change';

suite('T406t · the Change Room refuses at the database', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  const request = async (over: Record<string, unknown> = {}): Promise<string> => {
    const id = `cr_${Math.random().toString(36).slice(2, 10)}`;
    const row = {
      id,
      workspaceId: WS,
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      targetBaselineId: 'b_1',
      targetBaselineVersion: 1,
      requestedOutcome: 'add a constraint',
      reason: 'the regulator asked',
      requester: 'u_1',
      ...over,
    };
    const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
    const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
    await db.query(`INSERT INTO "change_requests" (${cols}) VALUES (${params})`, Object.values(row));
    return id;
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$1,now())`, [WS]);
  }, 300_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  }, 120_000);

  it('the control — a well-formed change request inserts', async () => {
    // Every refusal below is only meaningful because this succeeds.
    await expect(request()).resolves.toMatch(/^cr_/);
  });

  it('refuses a change with NO target baseline version', async () => {
    // `FR-CHR-010`. A change with no baseline is not a change: there is nothing
    // for it to be a change TO, and the delta it produces would freeze nothing.
    await expect(request({ targetBaselineVersion: null })).rejects.toThrow(/not-null|null value/i);
  });

  it('refuses a decision by a non-human', async () => {
    // Baseline change is permanently high band (`FR-DPE-012`), and this is the
    // belt beside `EPIC-031`'s braces — it holds even if a caller reaches past
    // the policy engine entirely.
    const cr = await request();
    const view = await impactView(cr);
    await expect(decision(cr, view, { decidedByKind: 'agent' })).rejects.toThrow(
      /change_decisions_decided_by_a_human/,
    );
  });

  it('accepts a decision by a human — or the constraint means nothing', async () => {
    const cr = await request();
    const view = await impactView(cr);
    await expect(decision(cr, view, { decidedByKind: 'human' })).resolves.toBeTruthy();
  });

  it('refuses an `unknown` impact area with no reason', async () => {
    // `FR-CHR-032`. An `unknown` that cannot say why is indistinguishable from
    // a row nobody filled in, and the whole value of the state is that it is
    // distinguishable from `not-impacted`.
    const cr = await request();
    const view = await impactView(cr);
    await expect(area(view, { state: 'unknown', unknownReason: null })).rejects.toThrow(
      /unknown_states_say_why/,
    );
  });

  it('accepts an `unknown` area that says why', async () => {
    const cr = await request();
    const view = await impactView(cr);
    await expect(
      area(view, { state: 'unknown', unknownReason: 'the impact source was unreachable' }),
    ).resolves.toBeTruthy();
  });

  it('accepts a `not-impacted` area with no unknown reason', async () => {
    // The constraint is conditional, not blanket: only `unknown` needs a reason.
    const cr = await request();
    const view = await impactView(cr);
    await expect(area(view, { state: 'not-impacted', unknownReason: null })).resolves.toBeTruthy();
  });

  it('refuses a defect transfer that does not name its defect', async () => {
    await expect(request({ origin: 'defect-transfer', originDefectRef: null })).rejects.toThrow(
      /transfers_name_their_defect/,
    );
  });

  it('refuses a re-plan obligation in an `executed` state', async () => {
    // `R-034-2` — recorded, never run. There is no state that says otherwise.
    const cr = await request();
    const view = await impactView(cr);
    const dec = await decision(cr, view, { decidedByKind: 'human' });
    await expect(
      db.query(
        `INSERT INTO "change_replan_obligations"
           ("id","workspaceId","changeDecisionId","affectedSpecificationId","whatMustChange","why","state")
         VALUES ('ro_x',$1,$2,'spec_1','add a step','the change adds one','executed')`,
        [WS, dec],
      ),
    ).rejects.toThrow(/recorded_not_run/);
  });

  async function impactView(changeRequestId: string): Promise<string> {
    const id = `iv_${Math.random().toString(36).slice(2, 10)}`;
    await db.query(
      `INSERT INTO "change_impact_views"
         ("id","workspaceId","changeRequestId","computedAt","traversalDepth")
       VALUES ($1,$2,$3,now(),25)`,
      [id, WS, changeRequestId],
    );
    return id;
  }

  async function decision(
    changeRequestId: string,
    impactViewId: string,
    over: Record<string, unknown>,
  ): Promise<string> {
    const id = `cd_${Math.random().toString(36).slice(2, 10)}`;
    await db.query(
      `INSERT INTO "change_decisions"
         ("id","workspaceId","changeRequestId","decidedBy","decidedByKind","authorityBasis",
          "objectVersion","decidedAt","decisionId","chosenOption","declinedOptions","rationale","impactViewId")
       VALUES ($1,$2,$3,'u_1',$4,'lead',1,now(),'d_1','opt-1','["opt-2"]'::jsonb,'because',$5)`,
      [id, WS, changeRequestId, over['decidedByKind'], impactViewId],
    );
    return id;
  }

  async function area(impactViewId: string, over: Record<string, unknown>): Promise<string> {
    const id = `ia_${Math.random().toString(36).slice(2, 10)}`;
    await db.query(
      `INSERT INTO "change_impact_areas"
         ("id","workspaceId","impactViewId","area","state","detail","itemCount","unknownReason")
       VALUES ($1,$2,$3,'security',$4,'detail',NULL,$5)`,
      [id, WS, impactViewId, over['state'], over['unknownReason']],
    );
    return id;
  }
});
