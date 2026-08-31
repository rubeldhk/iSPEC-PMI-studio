/**
 * `T994c` (EPIC-034) — the high-band fence, and the fence behind it.
 *
 * `FR-CHR-051`, `SC-CHR-003`, `ADR-0025` constraint 1: baseline change stays
 * human-approved in the high band under **every** tenant policy.
 *
 * Two enforcements, tested together because neither is sufficient alone:
 *
 * **The service refuses a lowered band.** `DecisionService` checks the band the
 * policy provider answered with, and refuses anything but `high`. This Room
 * does not adjudicate policy (`FR-CHR-002`), but a provider answering `low` is
 * either misconfigured or has been persuaded, and neither is a reason to
 * proceed.
 *
 * **The database refuses a non-human decider.** `change_decisions_decided_by_a_human`
 * holds when a caller reaches past the service entirely — which is the case
 * that matters, because `SC-CHR-003` says *zero* auto-approvals and a
 * success-criterion measured over "calls that went through the service" would
 * be measuring the wrong set.
 *
 * The controls are the point. A constraint that rejects everything satisfies
 * "no agent decision was stored" perfectly, so each refusal here is paired with
 * the acceptance that proves the check can tell the two apart.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';
import { storeWithImpactView } from '../helpers/change-room-fixtures.js';
import {
  DecisionService,
  type ChangeDecisionInboxPort,
  type ChangeDecisionPolicyPort,
} from '../../src/modules/change-room/decision.service.js';
import {
  TRADEOFF_DIMENSIONS,
  type ChangeOption,
  type ChangeOptions,
} from '../../src/modules/change-room/option.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_band';

const tradeOffs = () => {
  const out = {} as ChangeOption['tradeOffs'];
  for (const d of TRADEOFF_DIMENSIONS) {
    (out as Record<string, unknown>)[d] = { stated: true, detail: `${d} considered` };
  }
  return out;
};

const option = (id: string): ChangeOption => ({
  optionId: id,
  summary: `Option ${id}`,
  reasoning: `Because of ${id}.`,
  tradeOffs: tradeOffs(),
  epistemic: 'recommendation',
});

const OPTIONS: ChangeOptions = [option('a'), option('b')];

const inbox: ChangeDecisionInboxPort = {
  async present() {
    return { inboxItemId: 'inbox_1' };
  },
};

const policyIn = (band: string): ChangeDecisionPolicyPort => ({
  async authorize() {
    return { authorized: true, authorityBasis: 'DA-0007', band };
  },
});

const decision = (over: Record<string, unknown> = {}) => ({
  workspaceId: WS,
  changeRequestId: 'cr_1',
  decisionId: 'dec_1',
  impactViewId: 'iv_1',
  decidedBy: 'u_2',
  decidedByKind: 'human',
  objectVersion: 1,
  options: OPTIONS,
  chosenOptionId: 'b',
  rationale: 'B keeps the migration reversible.',
  now: new Date('2026-08-30T12:00:00Z'),
  ...over,
});

describe('T994c · the service refuses a lowered band', () => {
  it.each(['low', 'medium', 'standard', 'none'])('refuses %s', async (band) => {
    const service = new DecisionService(await storeWithImpactView({ workspaceId: WS }), policyIn(band), inbox);
    await expect(service.record(decision())).rejects.toThrow(/high band/i);
  });

  it('accepts high — or every assertion above is vacuous', async () => {
    const store = await storeWithImpactView({ workspaceId: WS });
    await new DecisionService(store, policyIn('high'), inbox).record(decision());
    expect(await store.listDecisionsFor(WS, 'cr_1')).toHaveLength(1);
  });

  it('and no tenant policy can talk it down by authorising harder', async () => {
    // The shape a persuasive policy would take: authorised, with a basis, in a
    // band it chose. The basis is not the question — the band is.
    const persuasive: ChangeDecisionPolicyPort = {
      async authorize() {
        return { authorized: true, authorityBasis: 'TENANT-OVERRIDE-1', band: 'low' };
      },
    };
    await expect(
      new DecisionService(await storeWithImpactView({ workspaceId: WS }), persuasive, inbox).record(decision()),
    ).rejects.toThrow(/high band/i);
  });
});

suite('T994c · the database refuses a non-human decider', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  const insert = async (over: Record<string, unknown> = {}): Promise<void> => {
    const row = {
      id: `cd_${Math.random().toString(36).slice(2, 10)}`,
      workspaceId: WS,
      changeRequestId: 'cr_band',
      decidedBy: 'u_2',
      decidedByKind: 'human',
      authorityBasis: 'DA-0007',
      objectVersion: 1,
      decidedAt: new Date(),
      decisionId: `dec_${Math.random().toString(36).slice(2, 8)}`,
      chosenOption: JSON.stringify(option('b')),
      declinedOptions: JSON.stringify([option('a')]),
      rationale: 'B keeps the migration reversible.',
      impactViewId: 'iv_band',
      ...over,
    };
    const cols = Object.keys(row)
      .map((c) => `"${c}"`)
      .join(',');
    const params = Object.keys(row)
      .map((_, i) => `$${i + 1}`)
      .join(',');
    await db.query(
      `INSERT INTO "change_decisions" (${cols}) VALUES (${params})`,
      Object.values(row),
    );
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
    // The workspace first: `change_requests.workspaceId` is a foreign key, and
    // without this row the seed fails — which vitest reports as five SKIPPED
    // tests and an exit code of 0. A suite that never ran reads exactly like a
    // suite that was deliberately skipped.
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$1,now())`, [WS]);
    // The decision references a change request; it must exist for the foreign
    // key to be satisfiable.
    await db.query(
      `INSERT INTO "change_requests"
         ("id","workspaceId","projectId","roomObjectId","targetBaselineId","targetBaselineVersion",
          "requestedOutcome","reason","requester")
       VALUES ('cr_band',$1,'pr_1','ro_1','b_1',1,'add a constraint','the regulator asked','u_1')`,
      [WS],
    );
    // And the impact view the decision was taken against — `FR-CHR-035` makes
    // that a foreign key, so a decision cannot reference a snapshot that never
    // existed.
    await db.query(
      `INSERT INTO "change_impact_views"
         ("id","workspaceId","changeRequestId","computedAt","traversalDepth",
          "architectureDetail","violationCheckStatus","violationCheckBecause")
       VALUES ('iv_band',$1,'cr_band',now(),25,$2,'not-run',$3)`,
      [
        WS,
        'no architecture decision source is bound in this deployment',
        'the architecture-violation check (BR-0073) is unowned (U-17)',
      ],
    );
  }, 300_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  }, 120_000);

  it('refuses a decision taken by an agent', async () => {
    // `SC-CHR-003` — zero auto-approvals under any tenant policy, measured over
    // every write and not only the ones that went through the service.
    await expect(insert({ decidedByKind: 'ai' })).rejects.toThrow(/decided_by_a_human/);
  });

  it('refuses every non-human kind, not just the one word', async () => {
    for (const kind of ['agent', 'system', 'automation', 'service-account']) {
      await expect(insert({ decidedByKind: kind })).rejects.toThrow(/decided_by_a_human/);
    }
  });

  it('accepts a human decision — or the constraint means nothing', async () => {
    // The control. Without it, a constraint rejecting every insert would pass
    // both assertions above.
    await expect(insert()).resolves.toBeUndefined();
  });

  it('and still requires a rationale', async () => {
    // The second CHECK on the same table, asserted here so a future migration
    // that rebuilds one cannot quietly drop the other.
    await expect(insert({ rationale: '   ' })).rejects.toThrow(/state_their_rationale/);
  });

  it('the service and the database refuse the same thing', async () => {
    // Belt and braces, shown agreeing. If they disagreed, one of them would be
    // the real rule and the other would be decoration.
    const service = new DecisionService(await storeWithImpactView({ workspaceId: WS }), policyIn('high'), inbox);
    await expect(service.record(decision({ decidedByKind: 'ai' }))).rejects.toThrow(/human/i);
    await expect(insert({ decidedByKind: 'ai' })).rejects.toThrow(/decided_by_a_human/);
  });
});
