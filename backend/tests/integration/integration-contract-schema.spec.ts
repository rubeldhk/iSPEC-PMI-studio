/**
 * `T1408` (EPIC-043) — the migration exists and says what data-model.md §1–§3 say.
 *
 * Runs every migration against a real PostgreSQL, then reads the catalogue:
 * `workstation_connections` with one row per credential and the universal
 * columns; `connector_credentials.snapshotId` nullable; an index that serves the
 * per-project timeline read. Written to FAIL before `T1409`.
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

let container: StartedPostgreSqlContainer;
let db: Client;

async function columns(table: string): Promise<Record<string, { nullable: boolean; type: string }>> {
  const res = await db.query<{ column_name: string; is_nullable: string; data_type: string }>(
    `SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = $1`,
    [table],
  );
  return Object.fromEntries(res.rows.map((r) => [r.column_name, { nullable: r.is_nullable === 'YES', type: r.data_type }]));
}

suite('T1408 · the EPIC-043 migration', () => {
  beforeAll(async () => {
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

  it('creates workstation_connections with the universal columns and one row per credential', async () => {
    const cols = await columns('workstation_connections');
    for (const c of ['id', 'workspaceId', 'projectId', 'credentialId', 'firstSeenAt', 'lastSeenAt', 'contractVersion', 'createdAt', 'updatedAt']) {
      expect(cols[c], `${c} missing`).toBeDefined();
    }
    expect(cols['extensionVersion']?.nullable).toBe(true);
    expect(cols['toolkitVersion']?.nullable).toBe(true);
    expect(cols['serverVersion']?.nullable).toBe(true);
    const unique = await db.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'workstation_connections'`,
    );
    expect(unique.rows.some((r) => /UNIQUE/.test(r.indexdef) && /"credentialId"/.test(r.indexdef))).toBe(true);
  });

  it('admits a connector kind in principal_identity_snapshots — the first snapshot of a credential principal', async () => {
    const res = await db.query<{ consrc: string }>(
      `SELECT pg_get_constraintdef(oid) AS consrc FROM pg_constraint WHERE conname = 'principal_identity_snapshots_kind_vocabulary'`,
    );
    expect(res.rows[0]?.consrc).toContain("'connector'");
  });

  it('adds a nullable snapshotId to connector_credentials', async () => {
    const cols = await columns('connector_credentials');
    expect(cols['snapshotId']).toBeDefined();
    expect(cols['snapshotId']?.nullable).toBe(true);
  });

  it('indexes executions by workspace, project and registration time for the timeline read', async () => {
    const idx = await db.query<{ indexdef: string }>(`SELECT indexdef FROM pg_indexes WHERE tablename = 'executions'`);
    expect(idx.rows.some((r) => /"workspaceId", "projectId"/.test(r.indexdef))).toBe(true);
  });
});
