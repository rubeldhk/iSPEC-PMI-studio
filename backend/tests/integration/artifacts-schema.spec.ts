/**
 * `T1620` (EPIC-045) — the migration exists and says what data-model.md §1–§4 say.
 *
 * Runs every migration against a real PostgreSQL, then reads the catalogue:
 * `artifact_versions` (content once per digest, unique `(projectId, path,
 * digest)` — the arbiter under concurrency), `artifact_syncs` (one row per
 * sync, unique `(workspaceId, idempotencyKey)` so a replay writes nothing),
 * `artifact_sync_files` (the manifest, unique `(syncId, path)`), and the
 * nullable `specifications.sourcePath` with its unique `(epicId, sourcePath)`
 * index. Additive only. Written to FAIL before `T1621`.
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

async function checks(table: string): Promise<string[]> {
  const res = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid WHERE t.relname = $1 AND c.contype = 'c'`,
    [table],
  );
  return res.rows.map((r) => r.def);
}

async function foreignKeys(table: string): Promise<string[]> {
  const res = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid WHERE t.relname = $1 AND c.contype = 'f'`,
    [table],
  );
  return res.rows.map((r) => r.def);
}

suite('T1620 · the EPIC-045 migration', () => {
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

  it('creates artifact_versions with the content, its digest and the execution that first delivered it (data-model §1)', async () => {
    const cols = await columns('artifact_versions');
    for (const c of ['id', 'workspaceId', 'projectId', 'path', 'kind', 'digest', 'sizeBytes', 'content', 'firstExecutionId', 'firstSyncedAt']) {
      expect(cols[c], `${c} missing`).toBeDefined();
    }
    expect(cols['sizeBytes']?.type).toBe('integer');
    expect(cols['content']?.type).toBe('text');
    // Nothing here is nullable: a version without content or a digest is not a version.
    for (const c of ['path', 'kind', 'digest', 'content', 'firstExecutionId']) expect(cols[c]?.nullable, `${c} must not be nullable`).toBe(false);
  });

  it('holds content once per digest: unique (projectId, path, digest) — the arbiter under concurrency (FR-ART-006)', async () => {
    const idx = await indexes('artifact_versions');
    expect(idx.some((d) => /UNIQUE INDEX .* \("projectId", "?path"?, "?digest"?\)/.test(d)), idx.join('\n')).toBe(true);
    expect(idx.some((d) => /\("workspaceId"\)/.test(d))).toBe(true);
    expect(idx.some((d) => /\("projectId", "?path"?\)/.test(d))).toBe(true);
  });

  it('constrains kind to the nine artifact kinds (data-model §1)', async () => {
    const defs = await checks('artifact_versions');
    const kind = defs.find((d) => d.includes("'spec'"));
    expect(kind, defs.join('\n')).toBeDefined();
    for (const k of ['spec', 'plan', 'tasks', 'research', 'data-model', 'analysis', 'quickstart', 'contract', 'checklist']) {
      expect(kind, `kind ${k} not admitted`).toContain(`'${k}'`);
    }
  });

  it('creates artifact_syncs with the execution, the nullable Epic, the credential and the counts (data-model §2)', async () => {
    const cols = await columns('artifact_syncs');
    for (const c of ['id', 'workspaceId', 'projectId', 'executionId', 'epicId', 'credentialId', 'idempotencyKey', 'createdCount', 'reusedCount', 'refusedCount', 'syncedAt']) {
      expect(cols[c], `${c} missing`).toBeDefined();
    }
    // `epicId` is nullable — an execution bound to no Epic still syncs (FR-ART-007).
    expect(cols['epicId']?.nullable).toBe(true);
    expect(cols['executionId']?.nullable).toBe(false);
    for (const c of ['createdCount', 'reusedCount', 'refusedCount']) expect(cols[c]?.type).toBe('integer');
  });

  it('answers a replay from the stored row: unique (workspaceId, idempotencyKey) (R-045-8)', async () => {
    const idx = await indexes('artifact_syncs');
    expect(idx.some((d) => /UNIQUE INDEX .* \("workspaceId", "idempotencyKey"\)/.test(d)), idx.join('\n')).toBe(true);
    expect(idx.some((d) => /\("epicId", "syncedAt" DESC\)/.test(d)), idx.join('\n')).toBe(true);
    expect(idx.some((d) => /\("executionId"\)/.test(d))).toBe(true);
    const fks = await foreignKeys('artifact_syncs');
    expect(fks.some((d) => /\("executionId"\) REFERENCES "?executions"?\("?id"?\)/.test(d)), fks.join('\n')).toBe(true);
    expect(fks.some((d) => /\("epicId"\) REFERENCES "?epics"?\("?id"?\)/.test(d)), fks.join('\n')).toBe(true);
  });

  it('creates artifact_sync_files as the manifest: one row per path, an outcome and a refusal code (data-model §3)', async () => {
    const cols = await columns('artifact_sync_files');
    for (const c of ['id', 'workspaceId', 'syncId', 'path', 'digest', 'outcome', 'versionId', 'refusalCode', 'refusalDetail', 'createdAt']) {
      expect(cols[c], `${c} missing`).toBeDefined();
    }
    // The manifest's tenancy derives from its sync and is carried anyway: a
    // tenancy that exists only as a join cannot be enforced by row-level
    // security later without moving data (`FR-002`, `T012a`).
    expect(cols['workspaceId']?.nullable).toBe(false);
    // A refused file has no version and carries a code; an accepted one is the converse.
    for (const c of ['versionId', 'refusalCode', 'refusalDetail']) expect(cols[c]?.nullable, `${c} must be nullable`).toBe(true);
    const idx = await indexes('artifact_sync_files');
    expect(idx.some((d) => /UNIQUE INDEX .* \("syncId", "?path"?\)/.test(d)), idx.join('\n')).toBe(true);
    expect(idx.some((d) => /\("versionId"\)/.test(d))).toBe(true);
    expect(idx.some((d) => /\("workspaceId"\)/.test(d)), idx.join('\n')).toBe(true);
  });

  it('constrains outcome to created | reused | refused and refusalCode to the seven codes (data-model §3)', async () => {
    const defs = await checks('artifact_sync_files');
    const outcome = defs.find((d) => d.includes("'created'"));
    expect(outcome, defs.join('\n')).toBeDefined();
    for (const o of ['created', 'reused', 'refused']) expect(outcome, `outcome ${o} not admitted`).toContain(`'${o}'`);
    const refusal = defs.find((d) => d.includes("'digest_mismatch'"));
    expect(refusal, defs.join('\n')).toBeDefined();
    for (const c of ['digest_mismatch', 'path_not_in_artifact_set', 'path_escapes_epic', 'not_utf8', 'too_large', 'credential_shape', 'too_many_files']) {
      expect(refusal, `refusalCode ${c} not admitted`).toContain(`'${c}'`);
    }
  });

  it('adds a nullable specifications.sourcePath, unique with the Epic (data-model §4)', async () => {
    const cols = await columns('specifications');
    expect(cols['sourcePath'], 'specifications.sourcePath missing').toBeDefined();
    expect(cols['sourcePath']?.nullable).toBe(true);
    const idx = await indexes('specifications');
    expect(idx.some((d) => /UNIQUE INDEX .* \("epicId", "sourcePath"\)/.test(d)), idx.join('\n')).toBe(true);
  });

  it('is additive: the tables EPIC-044 created are untouched', async () => {
    // A migration that dropped or rewrote an existing table would pass every
    // assertion above and still be wrong (Constitution VII).
    const epics = await columns('epics');
    expect(Object.keys(epics).length).toBeGreaterThan(10);
    const executions = await columns('executions');
    expect(executions['id']).toBeDefined();
  });
});
