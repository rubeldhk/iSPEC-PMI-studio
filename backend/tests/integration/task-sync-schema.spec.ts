/**
 * `T1686` (EPIC-046) — the migration exists and says what data-model.md §1–§6 say.
 *
 * Runs every migration against a real PostgreSQL, then reads the catalogue:
 * `task_syncs` (one row per sync, unique `(workspaceId, idempotencyKey)` so a
 * replay writes nothing), `task_sync_lines` (the manifest, unique
 * `(syncId, lineNumber)`), `task_status_proposals` (the immutable request —
 * **no verdict column**), the eleven new `tasks` columns with their **partial**
 * unique index on `(epicId, taskKey)`, the `tasks.specificationId` widening,
 * `TaskStatus.blocked`, and `projects.taskMoveRequiresApproval`.
 *
 * Additive but for the one documented widening. Written to FAIL before `T1687`.
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

async function enumValues(name: string): Promise<string[]> {
  const res = await db.query<{ label: string }>(
    `SELECT e.enumlabel AS label FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = $1 ORDER BY e.enumsortorder`,
    [name],
  );
  return res.rows.map((r) => r.label);
}

suite('T1686 · the EPIC-046 migration', () => {
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

  it('creates task_syncs with the digest it parsed, its counts and its diff summary (data-model §3)', async () => {
    const cols = await columns('task_syncs');
    for (const c of [
      'id', 'workspaceId', 'projectId', 'epicId', 'executionId', 'actorId', 'idempotencyKey', 'tasksDigest',
      'linesConsidered', 'parsed', 'refused', 'duplicates',
      'added', 'changed', 'unchanged', 'disappeared',
      'outOfBandEdit', 'syncedAt', 'createdAt',
    ]) {
      expect(cols[c], `${c} missing`).toBeDefined();
    }
    // Unbound: an execution whose target names no Epic still syncs (FR-KAN-032).
    expect(cols['epicId']?.nullable).toBe(true);
    expect(cols['actorId']?.nullable).toBe(true);
    expect(cols['outOfBandEdit']?.default).toContain('false');

    // The arbiter of FR-KAN-038: a replay returns the stored answer and writes nothing.
    expect((await indexes('task_syncs')).join('\n')).toMatch(
      /CREATE UNIQUE INDEX .*task_syncs.*\("workspaceId", "idempotencyKey"\)/,
    );
    const fks = await foreignKeys('task_syncs');
    expect(fks.join('\n')).toMatch(/FOREIGN KEY \("executionId"\) REFERENCES "?executions"?/);
    expect(fks.join('\n')).toMatch(/FOREIGN KEY \("epicId"\) REFERENCES "?epics"?/);
  });

  it('creates task_sync_lines as the manifest, one row per considered line (data-model §4)', async () => {
    const cols = await columns('task_sync_lines');
    for (const c of ['id', 'workspaceId', 'syncId', 'lineNumber', 'rawText', 'outcome', 'refusalCode', 'taskKey', 'changeKind', 'previousStatus', 'newStatus', 'marker', 'createdAt']) {
      expect(cols[c], `${c} missing`).toBeDefined();
    }
    expect((await indexes('task_sync_lines')).join('\n')).toMatch(
      /CREATE UNIQUE INDEX .*task_sync_lines.*\("syncId", "lineNumber"\)/,
    );
    const c = (await checks('task_sync_lines')).join('\n');
    expect(c).toMatch(/outcome/);
    expect(c).toMatch(/changeKind/);
    expect(c).toMatch(/refusalCode/);
    // The nine codes of data-model §7 — the closed vocabulary, in the database.
    for (const code of [
      'malformed_identifier', 'identifier_not_matched', 'missing_description', 'description_too_long',
      'duplicate_identifier', 'credential_in_description', 'file_too_large', 'too_many_task_lines', 'not_utf8_text',
    ]) {
      expect(c, `refusal code ${code} not in the CHECK`).toContain(code);
    }
  });

  it('creates task_status_proposals as an immutable request with NO verdict column (data-model §5)', async () => {
    const cols = await columns('task_status_proposals');
    for (const c of ['id', 'workspaceId', 'taskId', 'expectedCurrentStatus', 'requestedStatus', 'reason', 'proposerId', 'proposerType', 'executionId', 'eventId', 'idempotencyKey', 'proposedAt', 'createdAt']) {
      expect(cols[c], `${c} missing`).toBeDefined();
    }
    // R-037-5: a mutable verdict field becomes the audit authority the first time
    // somebody reads it instead of the event stream. There is no such column.
    for (const forbidden of ['verdict', 'state', 'adjudication', 'approvedBy', 'appliedAt']) {
      expect(cols[forbidden], `${forbidden} must not exist — the verdict is an event`).toBeUndefined();
    }
    expect(cols['reason']?.nullable).toBe(false);
    expect((await indexes('task_status_proposals')).join('\n')).toMatch(
      /CREATE UNIQUE INDEX .*task_status_proposals.*\("workspaceId", "idempotencyKey"\)/,
    );
    const c = (await checks('task_status_proposals')).join('\n');
    expect(c).toMatch(/expectedCurrentStatus/);
    expect(c).toMatch(/requestedStatus/);
  });

  it('widens tasks with the parse columns, and makes specificationId nullable (data-model §2)', async () => {
    const cols = await columns('tasks');
    for (const c of [
      'epicId', 'taskKey', 'sourceLine', 'sourceDigest', 'parallel', 'sourcePaths',
      'presentInLatestParse', 'statusSource', 'lastParsedExecutionId', 'lastMovedAt', 'lastMovedBy',
    ]) {
      expect(cols[c], `${c} missing`).toBeDefined();
    }
    // Q1 (2026-09-06): a synced task's home is its Epic; the specification is optional.
    expect(cols['specificationId']?.nullable).toBe(true);
    expect(cols['epicId']?.nullable).toBe(true);
    expect(cols['taskKey']?.nullable).toBe(true);
    expect(cols['parallel']?.default).toContain('false');
    expect(cols['presentInLatestParse']?.default).toContain('true');
    expect(cols['statusSource']?.default).toContain('engine');
    expect(cols['sourcePaths']?.type).toBe('ARRAY');

    // FR-KAN-031: identity is the identifier within its Epic. PARTIAL, so the
    // engine-generated rows (no epic, no key) are untouched by it.
    const idx = (await indexes('tasks')).join('\n');
    expect(idx).toMatch(/CREATE UNIQUE INDEX .*tasks.*\("epicId", "taskKey"\)[\s\S]*WHERE/);
    expect(idx).toMatch(/tasks.*\("epicId", "?status"?\)/);

    const c = (await checks('tasks')).join('\n');
    expect(c).toMatch(/statusSource/);
    for (const source of ['parse', 'event', 'proposal', 'engine']) expect(c).toContain(source);

    expect((await foreignKeys('tasks')).join('\n')).toMatch(/FOREIGN KEY \("epicId"\) REFERENCES "?epics"?/);
  });

  it('adds blocked to TaskStatus and taskMoveRequiresApproval to projects (data-model §1, §6)', async () => {
    // FR-KAN-051: four columns. FR-KAN-041: `blocked` is reachable only through
    // an applied proposal — the enum makes the column possible, the reconciliation
    // table is what keeps a parse from ever producing it.
    expect(await enumValues('TaskStatus')).toEqual(['not_started', 'in_progress', 'done', 'blocked']);

    const cols = await columns('projects');
    expect(cols['taskMoveRequiresApproval'], 'taskMoveRequiresApproval missing').toBeDefined();
    expect(cols['taskMoveRequiresApproval']?.default).toContain('false');
  });
});
