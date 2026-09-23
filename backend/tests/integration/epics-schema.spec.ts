/**
 * `T1554` (EPIC-044) — the migration exists and says what data-model.md §1–§2 say.
 *
 * Runs every migration against a real PostgreSQL, then reads the catalogue:
 * `epics` (one number per project, never reused; a self-relation for split
 * children; idempotent decision processing by unique `(decisionCommentId,
 * splitSuffix)`), and the nullable `epicId` on `requirements` and
 * `specifications`. Written to FAIL before `T1555`.
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

suite('T1554 · the EPIC-044 migration', () => {
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

  it('creates epics with number, slug, title, status, the parent link and the decision columns (data-model §1)', async () => {
    const cols = await columns('epics');
    for (const c of ['id', 'workspaceId', 'projectId', 'number', 'slug', 'title', 'description', 'status', 'parentEpicId', 'splitSuffix', 'decisionCommentId', 'lastDecisionCommentId', 'createdById', 'createdAt', 'updatedAt', 'closedAt']) {
      expect(cols[c], `${c} missing`).toBeDefined();
    }
    expect(cols['number']?.type).toBe('integer');
    expect(cols['status']?.default).toContain('active');
    for (const c of ['parentEpicId', 'splitSuffix', 'decisionCommentId', 'lastDecisionCommentId', 'closedAt']) expect(cols[c]?.nullable, `${c} must be nullable`).toBe(true);
  });

  it('never reuses a number: unique (projectId, number); processes a decision once: unique (decisionCommentId, splitSuffix)', async () => {
    const idx = await indexes('epics');
    expect(idx.some((d) => /UNIQUE INDEX .* \(("projectId", "?number"?)\)/.test(d)), idx.join('\n')).toBe(true);
    expect(idx.some((d) => /UNIQUE INDEX .* \("decisionCommentId", "splitSuffix"\)/.test(d)), idx.join('\n')).toBe(true);
    expect(idx.some((d) => /\("workspaceId"\)/.test(d))).toBe(true);
    expect(idx.some((d) => /\(("projectId", "?status"?)\)/.test(d))).toBe(true);
    expect(idx.some((d) => /\("parentEpicId"\)/.test(d))).toBe(true);
  });

  it('constrains status to active | split | closed and links a child to its parent Epic', async () => {
    const defs = await checks('epics');
    expect(defs.some((d) => d.includes("'active'") && d.includes("'split'") && d.includes("'closed'")), defs.join('\n')).toBe(true);
    const fks = await foreignKeys('epics');
    expect(fks.some((d) => /\("parentEpicId"\) REFERENCES "?epics"?\("?id"?\)/.test(d)), fks.join('\n')).toBe(true);
    expect(fks.some((d) => /\("workspaceId"\) REFERENCES "?workspaces"?/.test(d))).toBe(true);
    expect(fks.some((d) => /\("projectId"\) REFERENCES "?projects"?/.test(d))).toBe(true);
  });

  it('adds a nullable epicId to requirements and specifications, indexed with the project (data-model §2)', async () => {
    for (const table of ['requirements', 'specifications']) {
      const cols = await columns(table);
      expect(cols['epicId'], `${table}.epicId missing`).toBeDefined();
      expect(cols['epicId']?.nullable).toBe(true);
      const idx = await indexes(table);
      expect(idx.some((d) => /\("projectId", "epicId"\)/.test(d)), `${table}: ${idx.join('\n')}`).toBe(true);
      const fks = await foreignKeys(table);
      expect(fks.some((d) => /\("epicId"\) REFERENCES "?epics"?\("?id"?\)/.test(d)), `${table}: ${fks.join('\n')}`).toBe(true);
    }
  });
});
