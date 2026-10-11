/**
 * `T2315` (EPIC-048) — the database refuses what the services refuse.
 *
 * Every assertion goes **around** the services, with raw SQL: `SC-LRN-001` and
 * `FR-LRN-027` are claims about what can exist in the database at all, and a
 * service is only one caller. The `EPIC-035` `T998i` / `EPIC-038` `T1230`
 * pattern — and the same hazard: Prisma's migration planning treats a hand-written
 * CHECK or trigger as an extra and may plan a drop. A test that watches for the
 * **removal** turns that into a red suite.
 *
 * The decision fences that need `EPIC-031`'s `policy_decisions` (plan item 2.3)
 * are `T2392`–`T2393` (`learning-knowledge-fences.spec.ts`); since they landed,
 * every version written here first records the decision that approved it.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { approvedByHuman } from '../helpers/learning-decisions-db.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_lrn';
const DIGEST = 'a'.repeat(64);
let container: StartedPostgreSqlContainer;
let db: Client;
let n = 0;
const id = (prefix: string): string => `${prefix}_${(n += 1)}`;

async function insert(table: string, row: Record<string, unknown>, client: Client = db): Promise<void> {
  const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
  const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
  const values = Object.values(row).map((v) => (v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v));
  await client.query(`INSERT INTO "${table}" (${cols}) VALUES (${params})`, values);
}

function candidateRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  const cid = id('lc');
  return {
    id: cid,
    workspaceId: WS,
    projectId: 'p_1',
    kind: 'new',
    statement: 'Integration tests need the database started first.',
    category: 'test-setup',
    subject: 'integration prerequisites',
    subjectKey: 'test-setup:integration prerequisites',
    sourceKind: 'execution',
    executionId: 'exe_1',
    sourcePrincipalId: 'agent_1',
    confidenceLevel: 'medium',
    confidenceBasis: 'three failing runs',
    claimedScope: { kind: 'project', projectIds: ['p_1'] },
    policyVersion: 1,
    objectDigest: DIGEST,
    idempotencyKey: `idem_${cid}`,
    correlationId: `corr_${cid}`,
    submittedAt: new Date(),
    ...over,
  };
}

/** A candidate with its citation and first transition, committed together. */
async function candidate(over: Record<string, unknown> = {}): Promise<string> {
  const row = candidateRow(over);
  await db.query('BEGIN');
  try {
    await insert('learning_candidates', row);
    await insert('learning_candidate_evidence', { id: id('lce'), workspaceId: WS, candidateId: row['id'], evidenceId: 'ev_1', digestAlgorithm: 'sha256', digest: DIGEST });
    await transition(String(row['id']), 1, 'proposed');
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
  return String(row['id']);
}

async function transition(candidateId: string, seq: number, state: string, over: Record<string, unknown> = {}): Promise<void> {
  await insert('learning_candidate_transitions', {
    id: id('lct'),
    workspaceId: WS,
    candidateId,
    seq,
    state,
    actorKind: 'platform',
    actorId: 'learning-intake',
    at: new Date(),
    ...over,
  });
}

/** Entry + version + current status + approved transition, in one transaction. */
async function approve(candidateId: string, over: Record<string, unknown> = {}): Promise<{ entryId: string; versionId: string }> {
  const entryId = id('ke');
  const versionId = id('kv');
  // T2393: a version needs the EPIC-031 decision that approved it — recorded first,
  // with the same SQL any other caller would need (learning-decisions-db.ts).
  const decided = await approvedByHuman(db, WS, candidateId);
  const row = versionRow(candidateId, entryId, versionId, { ...decided, ...over });
  await db.query('BEGIN');
  try {
    await insert('knowledge_entries', { id: entryId, workspaceId: WS, category: 'test-setup', subjectKey: `k_${entryId}`, originProjectId: 'p_1' });
    await insert('knowledge_entry_versions', row);
    await insert('knowledge_version_status_events', { id: id('se'), workspaceId: WS, versionId, status: 'current', actorId: 'u_h', decisionId: row['decisionId'], candidateId, at: new Date() });
    const last = await db.query(`SELECT max(seq) AS s FROM learning_candidate_transitions WHERE "candidateId" = $1`, [candidateId]);
    await transition(candidateId, Number(last.rows[0].s) + 1, 'approved', { decisionId: row['decisionId'], actorKind: 'human', actorId: 'u_h' });
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
  return { entryId, versionId };
}

function versionRow(candidateId: string, entryId: string, versionId: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: versionId,
    workspaceId: WS,
    entryId,
    version: 1,
    statement: 'Integration tests need the database started first.',
    proposedStatement: 'Integration tests need the database started first.',
    scope: { kind: 'project', projectIds: ['p_1'] },
    proposedScope: { kind: 'project', projectIds: ['p_1'] },
    classification: 'internal',
    candidateId,
    decisionId: 'd_1',
    approvedByKind: 'human',
    approvedBy: 'u_h',
    approvedAt: new Date(),
    ...over,
  };
}

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  db = new Client({ connectionString: container.getConnectionUri() });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'learning',now())`, [WS]);
  for (const p of ['p_1', 'p_2']) {
    await db.query(`INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt") VALUES ($1,$2,$1,'u_owner',now())`, [p, WS]);
  }
}, 600_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
}, 120_000);

suite('T2315 · the learning tables refuse at the database', () => {
  it('accept a well-formed candidate and its approval — or every refusal below is vacuous', async () => {
    const c = await candidate();
    await expect(approve(c)).resolves.toMatchObject({ versionId: expect.any(String) });
  });

  describe('A-019-1 · learning_policy is a steering subject', () => {
    it('the enum carries it', async () => {
      const res = await db.query(`SELECT unnest(enum_range(NULL::"SteeringSubject"))::text AS v`);
      expect(res.rows.map((r: { v: string }) => r.v)).toContain('learning_policy');
    });
  });

  describe('append-only — reject_mutation() on all ten tables (FR-LRN-029, -031, -035, -039)', () => {
    const TABLES = [
      'learning_candidates',
      'learning_candidate_evidence',
      'learning_corroborations',
      'learning_candidate_transitions',
      'learning_review_terms',
      'knowledge_entries',
      'knowledge_entry_versions',
      'knowledge_version_status_events',
      'knowledge_flags',
      'knowledge_retrievability',
    ];

    beforeAll(async () => {
      if (noRuntime) return;
      // One row in every table, so UPDATE and DELETE have something to refuse.
      const c = await candidate();
      const { versionId } = await approve(c);
      const open = await candidate();
      await insert('learning_corroborations', { id: id('lco'), workspaceId: WS, candidateId: open, sourceKind: 'person', sourcePrincipalId: 'u_2', statement: 's', confidenceLevel: 'low', confidenceBasis: 'b', idempotencyKey: id('ik'), correlationId: 'c', submittedAt: new Date() });
      await insert('learning_review_terms', { id: id('lrt'), workspaceId: WS, candidateId: open, decisionId: 'd_9', approvedStatement: 's', approvedScope: { kind: 'project', projectIds: ['p_1'] }, classification: 'internal', reviewerId: 'u_h', at: new Date() });
      await insert('knowledge_flags', { id: id('kf'), workspaceId: WS, versionId, kind: 'evidence-changed', detail: 'ev_1 integrity-failed', raisedAt: new Date() });
      await insert('knowledge_retrievability', { id: id('kr'), workspaceId: WS, versionId, outcome: 'not-yet-retrievable', reason: 'KnowledgeIndex unbound', attemptedAt: new Date() });
    }, 120_000);

    it.each(TABLES)('UPDATE on %s is refused', async (table) => {
      await expect(db.query(`UPDATE "${table}" SET "workspaceId" = "workspaceId"`)).rejects.toThrow(/append-only/);
    });

    it.each(TABLES)('DELETE on %s is refused', async (table) => {
      await expect(db.query(`DELETE FROM "${table}"`)).rejects.toThrow(/append-only/);
    });
  });

  describe('learning_transitions_guard', () => {
    it('refuses any transition after a terminal state', async () => {
      const c = await candidate();
      await transition(c, 2, 'withdrawn', { actorKind: 'human', actorId: 'agent_1' });
      await expect(transition(c, 3, 'proposed')).rejects.toThrow(/terminal/);
    });

    it('refuses approved without a version in the same transaction', async () => {
      const c = await candidate();
      await expect(transition(c, 2, 'approved', { decisionId: 'd_1', actorKind: 'human', actorId: 'u_h' })).rejects.toThrow(/version/);
    });

    it('refuses approved even when a version exists from an earlier transaction', async () => {
      const c = await candidate();
      const entryId = id('ke');
      await insert('knowledge_entries', { id: entryId, workspaceId: WS, category: 'test-setup', subjectKey: `k_${entryId}`, originProjectId: 'p_1' });
      const decided = await approvedByHuman(db, WS, c);
      await insert('knowledge_entry_versions', versionRow(c, entryId, id('kv'), decided));
      await expect(transition(c, 2, 'approved', { decisionId: decided.decisionId, actorKind: 'human', actorId: 'u_h' })).rejects.toThrow(/version/);
    });

    it('refuses a sequence that is not the next one', async () => {
      const c = await candidate();
      await expect(transition(c, 5, 'pending-review', { decisionId: 'd_1' })).rejects.toThrow(/sequence|seq/);
    });

    it('refuses an approved transition by a platform actor or with no decision (CHECK)', async () => {
      const c = await candidate();
      await expect(transition(c, 2, 'approved', { actorKind: 'platform' })).rejects.toThrow();
    });

    it('refuses a rejection with no reason or by anyone but a human (CHECK, FR-LRN-029)', async () => {
      const c = await candidate();
      await expect(transition(c, 2, 'rejected', { actorKind: 'human', actorId: 'u_h' })).rejects.toThrow();
      await expect(transition(c, 2, 'rejected', { reason: 'wrong', actorKind: 'platform' })).rejects.toThrow();
      await expect(transition(c, 2, 'rejected', { reason: 'wrong', actorKind: 'human', actorId: 'u_h' })).resolves.toBeUndefined();
    });

    it('refuses a seventh state', async () => {
      const c = await candidate();
      await expect(transition(c, 2, 'unknown')).rejects.toThrow();
    });
  });

  describe('learning_review_terms_within_claim (FR-LRN-028)', () => {
    it('refuses approved scope wider than the claim', async () => {
      const c = await candidate();
      await expect(
        insert('learning_review_terms', { id: id('lrt'), workspaceId: WS, candidateId: c, decisionId: 'd_w', approvedStatement: 's', approvedScope: { kind: 'workspace', projectIds: [] }, classification: 'internal', reviewerId: 'u_h', at: new Date() }),
      ).rejects.toThrow(/wider/);
      await expect(
        insert('learning_review_terms', { id: id('lrt'), workspaceId: WS, candidateId: c, decisionId: 'd_w2', approvedStatement: 's', approvedScope: { kind: 'project', projectIds: ['p_2'] }, classification: 'internal', reviewerId: 'u_h', at: new Date() }),
      ).rejects.toThrow(/wider/);
    });

    it('accepts a narrowed scope', async () => {
      const c = await candidate({ claimedScope: { kind: 'projects', projectIds: ['p_1', 'p_2'] } });
      await expect(
        insert('learning_review_terms', { id: id('lrt'), workspaceId: WS, candidateId: c, decisionId: 'd_n', approvedStatement: 's', approvedScope: { kind: 'project', projectIds: ['p_1'] }, classification: 'internal', reviewerId: 'u_h', at: new Date() }),
      ).resolves.toBeUndefined();
    });
  });

  describe('learning_candidates_have_evidence (FR-LRN-012)', () => {
    it('a candidate with no citation fails at commit', async () => {
      await db.query('BEGIN');
      const row = candidateRow();
      await insert('learning_candidates', row);
      await transition(String(row['id']), 1, 'proposed');
      await expect(db.query('COMMIT')).rejects.toThrow(/citation|evidence/);
      const left = await db.query(`SELECT 1 FROM learning_candidates WHERE id = $1`, [row['id']]);
      expect(left.rowCount).toBe(0);
    });
  });

  describe('idempotency (FR-LRN-061)', () => {
    it('a second candidate with the same (workspaceId, idempotencyKey) is refused', async () => {
      const first = candidateRow();
      await candidate(first);
      await expect(candidate({ idempotencyKey: first['idempotencyKey'] })).rejects.toThrow(/unique|duplicate/i);
    });
  });

  describe('no AI approver (FR-LRN-027, quickstart Q27 schema half)', () => {
    it("approvedByKind = 'agent' violates a CHECK", async () => {
      const c = await candidate();
      await expect(approve(c, { approvedByKind: 'agent' })).rejects.toThrow(/check|approvedByKind/i);
    });

    it("an approvedBy equal to the candidate's source principal is refused", async () => {
      const c = await candidate();
      await expect(approve(c, { approvedBy: 'agent_1' })).rejects.toThrow(/source/);
    });

    it("an approvedBy equal to the candidate's Expert is refused", async () => {
      const c = await candidate({ expertId: 'expert_1', expertContractVersionId: 'ecv_1', expertContractVersion: 1 });
      await expect(approve(c, { approvedBy: 'expert_1' })).rejects.toThrow(/source/);
    });
  });

  describe('other CHECKs', () => {
    it('a superseded status names its successor; a deprecated one its reason (FR-LRN-032, -033)', async () => {
      const c = await candidate();
      const { versionId } = await approve(c);
      await expect(insert('knowledge_version_status_events', { id: id('se'), workspaceId: WS, versionId, status: 'superseded', actorId: 'u', at: new Date() })).rejects.toThrow();
      await expect(insert('knowledge_version_status_events', { id: id('se'), workspaceId: WS, versionId, status: 'deprecated', actorId: 'u', decisionId: 'd', at: new Date() })).rejects.toThrow();
    });

    it('a flag names exactly one of a version or a candidate', async () => {
      await expect(insert('knowledge_flags', { id: id('kf'), workspaceId: WS, kind: 'source-invalid', detail: 'x', raisedAt: new Date() })).rejects.toThrow();
    });

    it('not-yet-retrievable carries its reason (FR-LRN-053)', async () => {
      const c = await candidate();
      const { versionId } = await approve(c);
      await expect(insert('knowledge_retrievability', { id: id('kr'), workspaceId: WS, versionId, outcome: 'not-yet-retrievable', attemptedAt: new Date() })).rejects.toThrow();
    });

    it('a new candidate targets no version; any other kind targets one', async () => {
      await expect(candidate({ kind: 'supersede' })).rejects.toThrow();
    });
  });
});
