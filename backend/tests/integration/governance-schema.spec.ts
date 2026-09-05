/**
 * `T1473` (EPIC-042) — the migration exists and says what data-model.md §1–§5 say.
 *
 * Runs every migration against a real PostgreSQL, then reads the catalogue:
 * `project_constraints`, `decomposition_policies` (one per project, with the
 * `D-4` defaults and `strict` offline mode), `constitution_renders` (append-only,
 * one row per digest per project), the three drift columns on
 * `workstation_connections`, and the first-run flag on `provisioning_records`.
 * Written to FAIL before `T1474`.
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

async function columns(table: string): Promise<Record<string, { nullable: boolean; type: string; default: string | null }>> {
  const res = await db.query<{ column_name: string; is_nullable: string; data_type: string; column_default: string | null }>(
    `SELECT column_name, is_nullable, data_type, column_default FROM information_schema.columns WHERE table_name = $1`,
    [table],
  );
  return Object.fromEntries(res.rows.map((r) => [r.column_name, { nullable: r.is_nullable === 'YES', type: r.data_type, default: r.column_default }]));
}

async function indexes(table: string): Promise<string[]> {
  const res = await db.query<{ indexdef: string }>(`SELECT indexdef FROM pg_indexes WHERE tablename = $1`, [table]);
  return res.rows.map((r) => r.indexdef);
}

suite('T1473 · the EPIC-042 migration', () => {
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

  it('creates project_constraints with kind, order, version and status (data-model §1)', async () => {
    const cols = await columns('project_constraints');
    for (const c of ['id', 'workspaceId', 'projectId', 'kind', 'title', 'body', 'order', 'version', 'status', 'createdById', 'createdAt', 'updatedAt']) {
      expect(cols[c], `${c} missing`).toBeDefined();
    }
    const idx = await indexes('project_constraints');
    expect(idx.some((d) => /"workspaceId", "projectId", "kind", "order"/.test(d))).toBe(true);
    expect(idx.some((d) => /"projectId", "status"/.test(d))).toBe(true);
  });

  it('creates decomposition_policies, one per project, with the D-4 defaults and strict offline mode (§2)', async () => {
    const cols = await columns('decomposition_policies');
    expect(cols['oneSpecPerEpic']?.default).toBe('true');
    expect(cols['taskCeiling']?.default).toBe('50');
    expect(cols['splitRequiresConfirmation']?.default).toBe('true');
    expect(cols['offlineMode']?.default).toContain('strict');
    expect(cols['version']?.default).toBe('1');
    const idx = await indexes('decomposition_policies');
    expect(idx.some((d) => /UNIQUE/.test(d) && /"projectId"/.test(d))).toBe(true);
  });

  it('creates constitution_renders with content, inputs and a digest unique per project (§3)', async () => {
    const cols = await columns('constitution_renders');
    for (const c of ['id', 'workspaceId', 'projectId', 'version', 'digest', 'content', 'inputs', 'renderedAt']) {
      expect(cols[c], `${c} missing`).toBeDefined();
    }
    expect(cols['renderedById']?.nullable).toBe(true);
    const idx = await indexes('constitution_renders');
    expect(idx.some((d) => /UNIQUE/.test(d) && /"projectId", "digest"/.test(d))).toBe(true);
    expect(idx.some((d) => /"projectId", "version"/.test(d))).toBe(true);
  });

  it('adds the three nullable constitution columns to workstation_connections (§4)', async () => {
    const cols = await columns('workstation_connections');
    for (const c of ['constitutionDigest', 'constitutionState', 'constitutionReportedAt']) {
      expect(cols[c], `${c} missing`).toBeDefined();
      expect(cols[c]?.nullable, `${c} must be nullable`).toBe(true);
    }
  });

  it('adds firstRunMarkerWritten to provisioning_records, default false (§5)', async () => {
    const cols = await columns('provisioning_records');
    expect(cols['firstRunMarkerWritten']).toBeDefined();
    expect(cols['firstRunMarkerWritten']?.default).toBe('false');
  });

  it('constrains the vocabularies: kind, status, offline mode, constitution state', async () => {
    const res = await db.query<{ conname: string; consrc: string }>(
      `SELECT conname, pg_get_constraintdef(oid) AS consrc FROM pg_constraint WHERE conname LIKE 'project_constraints_%' OR conname LIKE 'decomposition_policies_%' OR conname LIKE 'workstation_connections_%'`,
    );
    const all = res.rows.map((r) => r.consrc).join('\n');
    expect(all).toContain("'principle'");
    expect(all).toContain("'non_goal'");
    expect(all).toContain("'provisional'");
    expect(all).toContain("'drift'");
  });
});
