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
