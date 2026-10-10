/**
 * T859c — the evidence tables are append-only, and the migration's three fences
 * hold, **enforced by PostgreSQL**. Following `audit-immutability.spec.ts`.
 *
 * Asserted against the database rather than the repository because the
 * repository is not the only thing that can reach these tables: a stray
 * migration, a hand-typed psql session or a compromised service all fail the
 * same way here, which is the point of putting the rule in the schema.
 *
 * - `evidence_items`, `work_evidence_bindings` and `evidence_completion_attempts`
 *   reject `UPDATE` and `DELETE` (data-model §1, §4, §5; `R-032-7`).
 * - Fence 1: an attestation row with no subject digest is refused (`FR-EVS-042`).
 * - Fence 2: a row neither stored nor referenced — or both — is refused (`FR-EVS-005`).
 * - Fence 3: a refused attempt with no unmet items is refused (`FR-EVS-032`).
 * - And the slice's rows (`T1203`), which predate the attestation columns, are
 *   still insertable through its own shape — the fences are NOT VALID for them.
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

const WS = 'ws_evs_append';

const ITEM_COLUMNS = `"id","workspaceId","projectId","type","attestsArtifactId","attestsArtifactVersion","source",
  "producedAt","integrityValid","subjectDigest","subjectName","storage","payload","reference","integrity",
  "attachedToType","attachedToId"`;

function item(id: string, overrides: Record<string, unknown> = {}): unknown[] {
  const row: Record<string, unknown> = {
    subjectDigest: JSON.stringify({ gitCommit: 'a'.repeat(40) }),
    storage: 'stored',
    payload: JSON.stringify({ result: 'PASSED' }),
    reference: null,
    integrity: JSON.stringify({ algorithm: 'sha256', value: 'x' }),
    attachedToType: 'task',
    ...overrides,
  };
  return [
    id, WS, 'p1', 'https://in-toto.io/attestation/test-result/v0.1', 'a1', 1, 'pmi:qa-suite',
    new Date(), true, row['subjectDigest'], 'src/a.ts', row['storage'], row['payload'], row['reference'],
    row['integrity'], row['attachedToType'], 'T-1',
  ];
}

const insertItem = (db: Client, id: string, overrides: Record<string, unknown> = {}) =>
  db.query(
    `INSERT INTO "evidence_items" (${ITEM_COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    item(id, overrides),
  );

suite('T859c · evidence is append-only and its fences hold, enforced by PostgreSQL', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'evidence probe',now())`, [WS]);
    await insertItem(db, 'ev_probe');
    await db.query(
      `INSERT INTO "work_evidence_bindings" ("id","workspaceId","projectId","workRefType","workRefId","workClass",
        "contractVersion","subjectArtifactType","subjectArtifactId","subjectVersion")
       VALUES ('wb_probe',$1,'p1','task','T-1','task-completion',1,'file','a1',1)`,
      [WS],
    );
    await db.query(
      `INSERT INTO "evidence_completion_attempts" ("id","workspaceId","workRefType","workRefId","declaredBy",
        "outcome","unmetItems","contractVersion","trigger")
       VALUES ('ca_probe',$1,'task','T-1','agent:x','refused','["tests-pass"]',1,'declaration')`,
      [WS],
    );
  }, 300_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  }, 120_000);

  it('holds the probe rows — an empty table would make every refusal below vacuous', async () => {
    for (const table of ['evidence_items', 'work_evidence_bindings', 'evidence_completion_attempts']) {
      const { rows } = await db.query(`SELECT count(*)::int AS n FROM "${table}"`);
      expect(rows[0].n, table).toBe(1);
    }
  });

  it.each([
    ['evidence_items', 'ev_probe', `"source" = 'tampered'`],
    ['work_evidence_bindings', 'wb_probe', `"contractVersion" = 2`],
    ['evidence_completion_attempts', 'ca_probe', `"outcome" = 'accepted'`],
  ])('%s rejects UPDATE and DELETE', async (table, id, set) => {
    await expect(db.query(`UPDATE "${table}" SET ${set} WHERE "id" = $1`, [id])).rejects.toThrow(
      new RegExp(`${table} is append-only`),
    );
    await expect(db.query(`DELETE FROM "${table}" WHERE "id" = $1`, [id])).rejects.toThrow(
      new RegExp(`${table} is append-only`),
    );
  });

  it('fence 1 — refuses an attestation with no subject digest (FR-EVS-042)', async () => {
    await expect(insertItem(db, 'ev_nodigest', { subjectDigest: null })).rejects.toThrow(
      /evidence_items_subject_digest_required/,
    );
  });

  it.each([
    ['stored with no payload', { payload: null }],
    ['referenced with no reference', { storage: 'referenced', payload: null }],
    ['both stored and referenced', { reference: JSON.stringify({ provider: 'p', location: 'l' }) }],
    ['neither kind', { storage: null }],
  ])('fence 2 — refuses a row %s (FR-EVS-005)', async (_label, overrides) => {
    await expect(insertItem(db, `ev_${Math.random()}`, overrides)).rejects.toThrow(/evidence_items_stored_xor_referenced/);
  });

  it('refuses evidence attached to something that is not an artifact, task, decision or outcome (FR-EVS-004)', async () => {
    await expect(insertItem(db, 'ev_room', { attachedToType: 'requirement' })).rejects.toThrow(
      /evidence_items_attached_to_known_kind/,
    );
    // NULL is the case a bare IN (...) lets through: NULL IN (...) is NULL, and
    // PostgreSQL accepts a CHECK that evaluates to NULL.
    await expect(insertItem(db, 'ev_unattached', { attachedToType: null })).rejects.toThrow(
      /evidence_items_attached_to_known_kind/,
    );
  });

  it('refuses an attestation with no project or no subject name (T1800, SC-EVS-002)', async () => {
    const noProject = item('ev_noproject');
    noProject[2] = null;
    await expect(
      db.query(`INSERT INTO "evidence_items" (${ITEM_COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, noProject),
    ).rejects.toThrow(/evidence_items_project_required/);
    for (const name of [null, '']) {
      const values = item(`ev_noname_${String(name)}`);
      values[10] = name;
      await expect(
        db.query(`INSERT INTO "evidence_items" (${ITEM_COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, values),
      ).rejects.toThrow(/evidence_items_subject_name_required/);
    }
  });

  it('fence 3 — refuses a refusal that names nothing unmet (FR-EVS-032)', async () => {
    for (const unmet of [null, '[]']) {
      await expect(
        db.query(
          `INSERT INTO "evidence_completion_attempts" ("id","workspaceId","workRefType","workRefId","declaredBy",
            "outcome","unmetItems","contractVersion","trigger")
           VALUES ($1,$2,'task','T-1','agent:x','refused',$3,1,'declaration')`,
          [`ca_${String(unmet)}`, WS, unmet],
        ),
      ).rejects.toThrow(/evidence_completion_attempts_refusal_names_unmet/);
    }
  });

  it('still permits INSERT — append-only, not read-only', async () => {
    await insertItem(db, 'ev_second');
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "evidence_items"`);
    expect(rows[0].n).toBe(2);
  });
});
