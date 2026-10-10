/**
 * `T1230` (EPIC-038) — the database refuses what the services refuse.
 *
 * Every assertion here goes **around** the services, with raw SQL. That is the
 * point: a service is one caller, and `SC-CTX-003` and `SC-CTX-004` are claims
 * about what can exist in the database at all. `EPIC-035`'s `T998i` established
 * the pattern — the type, the configuration and the constraint each refuse
 * independently, because they fail and are bypassed differently.
 *
 * ## The four constraints, and what each stops
 *
 * | Constraint | Without it |
 * |---|---|
 * | A refused package carries a reason | *"no context was assembled"* and *"assembly was never attempted"* become indistinguishable |
 * | A superseded item names its successor | A reader learns the material is stale and not what replaced it, which is the half that lets them act |
 * | An undetermined item gives a reason | *"I could not look"* and *"nobody has decided"* collapse into one blank |
 * | A cross-boundary item names its authorisation | `FR-CTX-052`'s marking becomes a boolean somebody set, rather than a pointer to who permitted it |
 *
 * `R-035-8`'s hazard applies here too, and is why these are asserted rather than
 * trusted: Prisma's destructive migration planning treats a hand-written `CHECK`
 * as an extra and generates a drop for it. A later `migrate dev` on another Epic
 * could remove any of these silently. A test that watches for their **removal**
 * is what turns that into a red suite.
 */
import { readFileSync, readdirSync } from 'node:fs';
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

const WS = 'ws_ctx';
let container: StartedPostgreSqlContainer;
let db: Client;
let seq = 0;
const id = (prefix: string): string => `${prefix}_${(seq += 1)}`;

/** A well-formed package, overridable field by field. */
async function pkg(over: Record<string, unknown> = {}): Promise<string> {
  const row: Record<string, unknown> = {
    id: id('cp'),
    workspaceId: WS,
    projectId: 'pr_1',
    objective: 'why does the booking notify twice',
    actorId: 'u_1',
    actorRole: 'engineer',
    budgetTokens: 12000,
    budgetCost: 40,
    state: 'assembled',
    embeddingModelId: 'model-a',
    ...over,
  };
  const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
  const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
  await db.query(`INSERT INTO "context_packages" (${cols}) VALUES (${params})`, Object.values(row));
  return String(row['id']);
}

async function item(packageId: string, over: Record<string, unknown> = {}): Promise<void> {
  const row: Record<string, unknown> = {
    id: id('pi'),
    workspaceId: WS,
    packageId,
    sourceType: 'requirement',
    sourceId: 'rq_1',
    sourceVersion: 'v3',
    authoritativeStatus: 'current',
    inclusionReason: 'objective term: notification',
    relevanceScore: 0.9,
    crossBoundary: false,
    ...over,
  };
  const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
  const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
  await db.query(`INSERT INTO "context_items" (${cols}) VALUES (${params})`, Object.values(row));
}

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  db = new Client({ connectionString: container.getConnectionUri() });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
}, 600_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
}, 120_000);

suite('T1230 · the Context tables refuse at the database', () => {
  it('accepts a well-formed package — or every refusal below is vacuous', async () => {
    await expect(pkg()).resolves.toBeTruthy();
  });

  it('and a well-formed item', async () => {
    const p = await pkg();
    await expect(item(p)).resolves.toBeUndefined();
  });

  describe('FR-CTX-065 · a refused package says why', () => {
    it('refuses a refusal with no reason', async () => {
      await expect(pkg({ state: 'refused' })).rejects.toThrow(/refusal|check/i);
    });

    it('and accepts one that gives it', async () => {
      await expect(
        pkg({ state: 'refused', refusalReason: 'no embedding provider is bound' }),
      ).resolves.toBeTruthy();
    });
  });

  describe('FR-CTX-043 · a superseded item names its successor', () => {
    it('refuses superseded with nothing to point at', async () => {
      const p = await pkg();
      await expect(item(p, { authoritativeStatus: 'superseded' })).rejects.toThrow(
        /supersed|check/i,
      );
    });

    it('and accepts one that names it', async () => {
      const p = await pkg();
      await expect(
        item(p, { authoritativeStatus: 'superseded', supersededBy: 'rq_1@v4' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('FR-CTX-044 · an undetermined item gives a reason', () => {
    it('refuses undetermined with no reason', async () => {
      const p = await pkg();
      await expect(item(p, { authoritativeStatus: 'undetermined' })).rejects.toThrow(
        /undetermined|check/i,
      );
    });

    it('and accepts one that gives it', async () => {
      const p = await pkg();
      await expect(
        item(p, {
          authoritativeStatus: 'undetermined',
          undeterminedReason: 'the baseline reader was unreachable',
        }),
      ).resolves.toBeUndefined();
    });

    it('and refuses a status nobody declared', async () => {
      const p = await pkg();
      await expect(item(p, { authoritativeStatus: 'probably-fine' })).rejects.toThrow(/check/i);
    });
  });

  describe('FR-CTX-052 · a cross-boundary item names its authorisation', () => {
    it('refuses crossBoundary with no authorisation', async () => {
      const p = await pkg();
      await expect(item(p, { crossBoundary: true })).rejects.toThrow(/authoris|check/i);
    });

    it('and accepts one that names it', async () => {
      // `T1260` made the reference a real foreign key, so the authorisation it
      // names has to exist — granted to this workspace, for this source.
      await db.query(
        `INSERT INTO "context_reusable_authorisations"
           ("id","sourceType","sourceId","workspaceId","toWorkspaceId","authorisedBy","rationale")
         VALUES ('rka_1','requirement','rq_1','ws_owner',$1,'u_owner','shared handbook')`,
        [WS],
      );
      const p = await pkg();
      await expect(
        item(p, { crossBoundary: true, authorisationRef: 'rka_1' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('FR-CTX-064 · an item says why it was included', () => {
    it('refuses a blank inclusion reason', async () => {
      // The `E1` finding, enforced at the database as well as the service. A
      // column that accepts `''` is a column that fills with `''`.
      const p = await pkg();
      await expect(item(p, { inclusionReason: '   ' })).rejects.toThrow(/inclusion|check/i);
    });
  });

  describe('R-035-8 · the constraints are still attached', () => {
    it('names every CHECK this Epic added', async () => {
      // Prisma's destructive migration planning treats a hand-written CHECK as
      // an extra and generates a drop for it. Asserting they exist is what
      // turns a silent removal into a red suite.
      const rows = await db.query(
        `SELECT conname FROM pg_constraint
          WHERE conrelid IN ('context_packages'::regclass, 'context_items'::regclass)
            AND contype = 'c'`,
      );
      const names = rows.rows.map((r: { conname: string }) => r.conname);
      for (const expected of [
        'context_packages_refusal_states_why',
        'context_items_status_is_known',
        'context_items_superseded_names_successor',
        'context_items_undetermined_says_why',
        'context_items_cross_boundary_names_authorisation',
        'context_items_state_their_inclusion_reason',
      ]) {
        expect(names, `${expected} is gone`).toContain(expected);
      }
    });
  });
});

/**
 * `T1286`, `T1281` — the degrading ports and the short read, refused at the
 * database as well as by the service.
 */
suite('T1286 · live state, execution history and retrieval counts refuse at the database', () => {
  it('refuses unavailable live state with no reason (FR-CTX-022)', async () => {
    await expect(pkg({ liveState: 'unavailable' })).rejects.toThrow(/live_state|check/i);
  });

  it('refuses unavailable execution history with no reason (FR-CTX-015)', async () => {
    await expect(pkg({ executionHistory: 'unavailable' })).rejects.toThrow(/execution_history|check/i);
  });

  it('accepts both when they say why', async () => {
    await expect(
      pkg({
        liveState: 'unavailable',
        liveStateReason: 'no LiveStateReader is bound',
        executionHistory: 'unavailable',
        executionHistoryReason: 'no ExecutionProjections reader is bound',
      }),
    ).resolves.toBeTruthy();
  });

  it('refuses more returned than requested, and one count without the other (R-038-3)', async () => {
    await expect(pkg({ retrievalRequested: 10, retrievalReturned: 11 })).rejects.toThrow(/retrieval|check/i);
    await expect(pkg({ retrievalRequested: 10 })).rejects.toThrow(/retrieval|check/i);
  });

  it('refuses a live-state element with no read instant (FR-CTX-021)', async () => {
    const p = await pkg();
    await expect(
      db.query(
        `INSERT INTO "context_live_state" ("id","workspaceId","packageId","kind","ref","state")
         VALUES ($1,$2,$3,'build','build#1','failing')`,
        [id('ls'), WS, p],
      ),
    ).rejects.toThrow(/readAt|null/i);
  });

  it('refuses a live-state kind nobody declared', async () => {
    const p = await pkg();
    await expect(
      db.query(
        `INSERT INTO "context_live_state" ("id","workspaceId","packageId","kind","ref","state","readAt")
         VALUES ($1,$2,$3,'mood','team','grumpy',now())`,
        [id('ls'), WS, p],
      ),
    ).rejects.toThrow(/kind|check/i);
  });
});

/** `T1802`, `T1804` — the budget policy refuses nonsense at the database. */
suite('T1804 · budget policy constraints', () => {
  const policy = (over: Record<string, unknown>) =>
    db.query(
      `INSERT INTO "context_budget_policies" ("id","workspaceId","retrievalLimit","tokensPerCandidate","costPerThousandTokens")
       VALUES ($1,$2,$3,$4,$5)`,
      [id('bp'), over['ws'] ?? id('ws'), over['limit'] ?? 40, over['tokens'] ?? 500, over['price'] ?? 0],
    );

  it('accepts a sane policy, and a zero price', async () => {
    await expect(policy({})).resolves.toBeTruthy();
  });

  it('refuses a non-positive limit or estimate, and a negative price', async () => {
    await expect(policy({ limit: 0 })).rejects.toThrow(/limit_positive|check/i);
    await expect(policy({ tokens: 0 })).rejects.toThrow(/estimate_positive|check/i);
    await expect(policy({ price: -1 })).rejects.toThrow(/price_not_negative|check/i);
  });

  it('refuses a second policy for one workspace', async () => {
    await policy({ ws: 'ws_one_policy' });
    await expect(policy({ ws: 'ws_one_policy' })).rejects.toThrow(/one_per_workspace|unique|duplicate/i);
  });
});

/** `T1820` — the model id is nullable for refusals only. */
suite('T1820 · an assembled package still names its model', () => {
  it('refuses an assembled package with no model', async () => {
    await expect(pkg({ embeddingModelId: null })).rejects.toThrow(/assembled_names_model|check/i);
  });

  it('accepts a refusal that never ranked, with no model', async () => {
    await expect(
      pkg({ state: 'refused', refusalReason: 'no embedding provider is bound', embeddingModelId: null }),
    ).resolves.toBeTruthy();
  });
});
