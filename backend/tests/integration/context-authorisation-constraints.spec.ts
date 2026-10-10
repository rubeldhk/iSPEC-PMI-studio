/**
 * `T1260` (EPIC-038) — a crossing names a real authorisation, and the database
 * is what insists.
 *
 * `FR-CTX-051`–`FR-CTX-053`, `SC-CTX-003`.
 *
 * ## Why the service refusing is not enough
 *
 * `judgeBoundary` only admits a crossing it found an authorisation for, and
 * `T1253`–`T1255` prove it. But the service is one caller. `T1230`'s CHECK
 * stops a `crossBoundary` item with an empty `authorisationRef` — and accepts
 * any non-empty string, so `'rka_made_up'` satisfied it. A marking that points
 * at nothing is a boolean with a longer name.
 *
 * So `authorisationRef` is a foreign key, and a composite one: the
 * authorisation it names must exist, must be granted **to the item's
 * workspace**, and must be **for the item's source**. Each of those is a
 * separate way to cite a real authorisation wrongly, and each is refused here
 * separately — `EPIC-035`'s `T998i` pattern, because an outcome test cannot
 * tell which guard did the work.
 *
 * Every write goes around the services, with raw SQL.
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

/** The reader. Material crosses INTO this workspace. */
const READER = 'ws_reader';
/** The owner. It grants the crossing. */
const OWNER = 'ws_owner';

let container: StartedPostgreSqlContainer;
let db: Client;
let seq = 0;
const id = (prefix: string): string => `${prefix}_${(seq += 1)}`;

async function insert(table: string, row: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
  const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
  await db.query(`INSERT INTO "${table}" (${cols}) VALUES (${params})`, Object.values(row));
}

async function authorisation(over: Record<string, unknown> = {}): Promise<string> {
  const row = {
    id: id('rka'),
    sourceType: 'decision',
    sourceId: 'hb_1',
    workspaceId: OWNER,
    toWorkspaceId: READER,
    authorisedBy: 'u_owner',
    rationale: 'the onboarding handbook is shared with the delivery partner',
    ...over,
  };
  await insert('context_reusable_authorisations', row);
  return row.id;
}

async function pkg(workspaceId = READER): Promise<string> {
  const row = {
    id: id('cp'),
    workspaceId,
    projectId: 'pr_1',
    objective: 'how do new joiners request access',
    actorId: 'u_1',
    actorRole: 'engineer',
    budgetTokens: 12000,
    budgetCost: 40,
    state: 'assembled',
    embeddingModelId: 'model-a',
  };
  await insert('context_packages', row);
  return row.id;
}

async function crossing(packageId: string, over: Record<string, unknown> = {}): Promise<void> {
  await insert('context_items', {
    id: id('pi'),
    workspaceId: READER,
    packageId,
    sourceType: 'decision',
    sourceId: 'hb_1',
    sourceVersion: 'v1',
    authoritativeStatus: 'current',
    inclusionReason: 'objective relevance 0.91',
    relevanceScore: 0.91,
    crossBoundary: true,
    ...over,
  });
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

suite('T1260 · a crossing cites a real authorisation, enforced by the database', () => {
  it('accepts a crossing citing the authorisation granted to it — or every refusal below is vacuous', async () => {
    const ref = await authorisation();
    await expect(crossing(await pkg(), { authorisationRef: ref })).resolves.toBeUndefined();
  });

  it('refuses a crossing with no authorisation at all (FR-CTX-052)', async () => {
    await expect(crossing(await pkg())).rejects.toThrow(/authoris|check/i);
  });

  it('refuses a crossing citing an authorisation that does not exist', async () => {
    // Passed `T1230`'s CHECK: a non-empty string is not a pointer to anybody.
    await expect(crossing(await pkg(), { authorisationRef: 'rka_made_up' })).rejects.toThrow(
      /foreign key|violates/i,
    );
  });

  it('refuses a crossing citing an authorisation granted to a DIFFERENT workspace', async () => {
    // Real, and not this reader's. `FR-CTX-051` is one source, one way, one
    // named workspace — a grant to somebody else is not a grant to you.
    const elsewhere = await authorisation({ toWorkspaceId: 'ws_third' });
    await expect(crossing(await pkg(), { authorisationRef: elsewhere })).rejects.toThrow(
      /foreign key|violates/i,
    );
  });

  it('refuses a crossing citing an authorisation for a DIFFERENT source', async () => {
    // Real, granted to this reader, for the handbook — cited by the salary
    // review. A lookup keyed on the workspace pair alone would admit it.
    const forHandbook = await authorisation();
    await expect(
      crossing(await pkg(), { authorisationRef: forHandbook, sourceId: 'salary_review_2026' }),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('refuses the reverse direction: the grant to the reader does not let the owner cite it', async () => {
    const toReader = await authorisation();
    const ownerPackage = await pkg(OWNER);
    await expect(
      crossing(ownerPackage, { workspaceId: OWNER, authorisationRef: toReader }),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('refuses own-workspace material carrying an authorisation it does not need', async () => {
    // If own material could carry a ref, `crossBoundary` would stop being the
    // thing a reviewer scans for, and the ref would stop meaning "crossed".
    const ref = await authorisation();
    await expect(
      crossing(await pkg(), { crossBoundary: false, authorisationRef: ref }),
    ).rejects.toThrow(/authoris|check/i);
  });

  it('refuses deleting an authorisation that an item cites — the audit trail outlives the grant', async () => {
    const ref = await authorisation();
    await crossing(await pkg(), { authorisationRef: ref });
    await expect(
      db.query(`DELETE FROM "context_reusable_authorisations" WHERE "id" = $1`, [ref]),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('refuses an authorisation nobody gave', async () => {
    await expect(authorisation({ authorisedBy: '  ' })).rejects.toThrow(/authorised|check/i);
  });

  it('refuses an authorisation from a workspace to itself', async () => {
    await expect(authorisation({ toWorkspaceId: OWNER })).rejects.toThrow(/cross|check/i);
  });

  describe('R-035-8 · the constraints are still attached', () => {
    it('names every constraint T1260 added', async () => {
      // Prisma's migration planner drops what it did not generate. Asserting
      // the names is what makes a silent removal a red suite.
      const rows = await db.query(
        `SELECT conname FROM pg_constraint
          WHERE conrelid IN ('context_items'::regclass, 'context_reusable_authorisations'::regclass)`,
      );
      const names = rows.rows.map((r: { conname: string }) => r.conname);
      for (const expected of [
        'context_items_authorisation_fkey',
        'context_items_only_crossings_cite_authorisation',
        'context_reusable_authorisations_names_grantor',
        'context_reusable_authorisations_citable',
      ]) {
        expect(names, `${expected} is gone`).toContain(expected);
      }
    });
  });
});

/** `T1852` — project ids on an authorisation only for a crossing inside one workspace. */
suite('T1852 · a project-scoped grant does not also cross workspaces', () => {
  it('refuses an authorisation naming projects across two workspaces', async () => {
    await expect(
      authorisation({ fromProjectId: 'pr_a', toProjectId: 'pr_b' }),
    ).rejects.toThrow(/projects_same_workspace|check/i);
  });

  it('accepts one naming projects inside one workspace', async () => {
    await expect(
      authorisation({ workspaceId: READER, toWorkspaceId: READER, fromProjectId: 'pr_a', toProjectId: 'pr_b' }),
    ).resolves.toBeTruthy();
  });
});
