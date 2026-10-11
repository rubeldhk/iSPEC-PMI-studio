/**
 * `T2392` (EPIC-048, plan items 2.3 and 2.8; `R-048-4`, `R-048-6`;
 * `SC-LRN-001`, `FR-LRN-027`, `FR-LRN-043`; quickstart Q24, Q27) — the
 * decision fences, at the database.
 *
 * Every assertion goes **around** the services with raw SQL, as `T2315` does:
 * a version of knowledge can exist only where `EPIC-031` recorded the decision
 * that approved it.
 *
 * - `knowledge_entry_versions.decisionId` / `.resolvingDecisionId` are foreign
 *   keys to `policy_decisions`;
 * - `knowledge_versions_require_decision` refuses a version whose decision is
 *   pending, refused, another workspace's or another candidate's; a resolving
 *   row that resolves some other decision; and a `human` version over a row
 *   that is not a human approval;
 * - the source-exclusion half (`approvedBy` ≠ the candidate's source) still
 *   refuses;
 * - `no_cross_workspace_knowledge`: `EPIC-038`'s reusable-authorisation table
 *   cannot carry a `knowledge-entry` (`FR-LRN-043`, until `DEFER-048-01`).
 *
 * The first case is accepted, so no refusal below is vacuous.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { approvedByHuman, insertDecision } from '../helpers/learning-decisions-db.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_fence';
const OTHER = 'ws_fence_other';
const DIGEST = 'a'.repeat(64);
let container: StartedPostgreSqlContainer;
let db: Client;
let n = 0;
const id = (prefix: string): string => `${prefix}_${(n += 1)}`;

async function insert(table: string, row: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
  const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
  const values = Object.values(row).map((v) => (v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v));
  await db.query(`INSERT INTO "${table}" (${cols}) VALUES (${params})`, values);
}

/** A proposed candidate with its citation, committed together. */
async function candidate(): Promise<string> {
  const cid = id('lc');
  await db.query('BEGIN');
  try {
    await insert('learning_candidates', {
      id: cid, workspaceId: WS, projectId: 'p_1', kind: 'new', statement: 's', category: 'test-setup', subject: cid, subjectKey: `test-setup:${cid}`,
      sourceKind: 'execution', executionId: 'exe_1', sourcePrincipalId: 'agent_1', confidenceLevel: 'medium', confidenceBasis: 'b',
      claimedScope: { kind: 'project', projectIds: ['p_1'] }, policyVersion: 1, objectDigest: DIGEST, idempotencyKey: `i_${cid}`, correlationId: `c_${cid}`, submittedAt: new Date(),
    });
    await insert('learning_candidate_evidence', { id: id('lce'), workspaceId: WS, candidateId: cid, evidenceId: 'ev_1', digestAlgorithm: 'sha256', digest: DIGEST });
    await insert('learning_candidate_transitions', { id: id('lct'), workspaceId: WS, candidateId: cid, seq: 1, state: 'proposed', actorKind: 'platform', actorId: 'learning-intake', at: new Date() });
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
  return cid;
}

/** Insert one version (entry first) for `candidateId`; the caller names its decision. */
async function version(candidateId: string, over: Record<string, unknown>): Promise<void> {
  const entryId = id('ke');
  await db.query('BEGIN');
  try {
    await insert('knowledge_entries', { id: entryId, workspaceId: WS, category: 'test-setup', subjectKey: `k_${entryId}`, originProjectId: 'p_1' });
    await insert('knowledge_entry_versions', {
      id: id('kv'), workspaceId: WS, entryId, version: 1, statement: 's', proposedStatement: 's',
      scope: { kind: 'project', projectIds: ['p_1'] }, proposedScope: { kind: 'project', projectIds: ['p_1'] }, classification: 'internal',
      candidateId, approvedByKind: 'human', approvedBy: 'u_h', approvedAt: new Date(), ...over,
    });
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  db = new Client({ connectionString: container.getConnectionUri() });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  for (const ws of [WS, OTHER]) await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$1,now())`, [ws]);
  await db.query(`INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt") VALUES ('p_1',$1,'p_1','u_owner',now())`, [WS]);
}, 600_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
}, 120_000);

suite('T2392 · knowledge_versions_require_decision (plan 2.3, SC-LRN-001)', () => {
  it('accepts a human version over a pending request resolved by a human approval — or every refusal below is vacuous', async () => {
    const c = await candidate();
    const { decisionId, resolvingDecisionId } = await approvedByHuman(db, WS, c);
    await expect(version(c, { decisionId, resolvingDecisionId })).resolves.toBeUndefined();
  });

  it('accepts a policy version over a request auto-executed on the spot', async () => {
    const c = await candidate();
    const decisionId = await insertDecision(db, { workspaceId: WS, candidateId: c, outcome: 'auto-executed', actorKind: 'automation', actionType: 'learning.approve.test-setup' });
    await expect(version(c, { decisionId, resolvingDecisionId: null, approvedByKind: 'policy', approvedBy: 'policy:v1' })).resolves.toBeUndefined();
  });

  // The trigger runs before the foreign keys, so it is the one that answers;
  // the keys are asserted present separately, so dropping either is red too.
  it('a decision EPIC-031 never recorded is refused', async () => {
    const c = await candidate();
    await expect(version(c, { decisionId: 'dec_invented' })).rejects.toThrow(/not recorded|foreign key/);
  });

  it('a resolving decision EPIC-031 never recorded is refused', async () => {
    const c = await candidate();
    const decisionId = await insertDecision(db, { workspaceId: WS, candidateId: c, outcome: 'pending' });
    await expect(version(c, { decisionId, resolvingDecisionId: 'dec_invented' })).rejects.toThrow(/not recorded|foreign key/);
  });

  it('both decision columns are foreign keys to policy_decisions', async () => {
    const res = await db.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'knowledge_entry_versions'::regclass AND contype = 'f' AND confrelid = 'policy_decisions'::regclass ORDER BY conname`,
    );
    expect(res.rows.map((r: { conname: string }) => r.conname)).toEqual([
      'knowledge_entry_versions_decisionId_fkey',
      'knowledge_entry_versions_resolvingDecisionId_fkey',
    ]);
  });

  it('a pending decision is refused (Q24)', async () => {
    const c = await candidate();
    const decisionId = await insertDecision(db, { workspaceId: WS, candidateId: c, outcome: 'pending' });
    await expect(version(c, { decisionId })).rejects.toThrow(/knowledge_versions_require_decision|not approved/);
  });

  it('a refused decision is refused — a closure is not an approval', async () => {
    const c = await candidate();
    const decisionId = await insertDecision(db, { workspaceId: WS, candidateId: c, outcome: 'pending' });
    const resolvingDecisionId = await insertDecision(db, { workspaceId: WS, candidateId: c, outcome: 'refused', actorKind: 'human', resolves: decisionId });
    await expect(version(c, { decisionId, resolvingDecisionId })).rejects.toThrow(/not approved/);
  });

  it('another workspace’s decision is refused', async () => {
    const c = await candidate();
    const decisionId = await insertDecision(db, { workspaceId: OTHER, projectId: 'p_x', candidateId: c, outcome: 'auto-executed', actorKind: 'automation' });
    await expect(version(c, { decisionId, approvedByKind: 'policy', approvedBy: 'policy:v1' })).rejects.toThrow(/another workspace|does not decide/);
  });

  it('another candidate’s decision is refused', async () => {
    const c = await candidate();
    const other = await candidate();
    const { decisionId, resolvingDecisionId } = await approvedByHuman(db, WS, other);
    await expect(version(c, { decisionId, resolvingDecisionId })).rejects.toThrow(/does not decide/);
  });

  it('a decision about another kind of object is refused, even with the candidate’s id', async () => {
    const c = await candidate();
    const decisionId = await insertDecision(db, { workspaceId: WS, candidateId: c, outcome: 'auto-executed', actorKind: 'automation', targetType: 'release' });
    await expect(version(c, { decisionId, approvedByKind: 'policy', approvedBy: 'policy:v1' })).rejects.toThrow(/does not decide/);
  });

  it('a resolving row that resolves some other decision is refused', async () => {
    const c = await candidate();
    const decisionId = await insertDecision(db, { workspaceId: WS, candidateId: c, outcome: 'pending' });
    const elsewhere = await insertDecision(db, { workspaceId: WS, candidateId: c, outcome: 'pending' });
    const resolvingDecisionId = await insertDecision(db, { workspaceId: WS, candidateId: c, outcome: 'approved', actorKind: 'human', resolves: elsewhere });
    await expect(version(c, { decisionId, resolvingDecisionId })).rejects.toThrow(/does not resolve/);
  });

  it('a human version over an automation-kind approval is refused (FR-LRN-027)', async () => {
    const c = await candidate();
    const decisionId = await insertDecision(db, { workspaceId: WS, candidateId: c, outcome: 'pending', effectiveClass: 'low' });
    const resolvingDecisionId = await insertDecision(db, { workspaceId: WS, candidateId: c, outcome: 'approved', actorKind: 'automation', actorId: 'svc_bot', effectiveClass: 'low', resolves: decisionId });
    await expect(version(c, { decisionId, resolvingDecisionId })).rejects.toThrow(/human/);
  });

  it('a human version over an auto-executed request (no human resolved it) is refused', async () => {
    const c = await candidate();
    const decisionId = await insertDecision(db, { workspaceId: WS, candidateId: c, outcome: 'auto-executed', actorKind: 'automation' });
    await expect(version(c, { decisionId })).rejects.toThrow(/human/);
  });

  it('an approvedBy equal to the candidate’s source is refused (R-048-6 layer 3)', async () => {
    const c = await candidate();
    const { decisionId, resolvingDecisionId } = await approvedByHuman(db, WS, c, 'agent_1');
    await expect(version(c, { decisionId, resolvingDecisionId, approvedBy: 'agent_1' })).rejects.toThrow(/source/);
  });
});

suite('T2392 · no_cross_workspace_knowledge (plan 2.8, FR-LRN-043, Q27)', () => {
  const row = (sourceType: string) => ({
    id: id('cra'), sourceType, sourceId: 'ke_1', workspaceId: WS, toWorkspaceId: OTHER, authorisedBy: 'u_owner', rationale: 'shared handbook',
  });

  it('accepts another source type — or the refusal below is vacuous', async () => {
    await expect(insert('context_reusable_authorisations', row('requirement'))).resolves.toBeUndefined();
  });

  it('refuses a knowledge-entry crossing', async () => {
    await expect(insert('context_reusable_authorisations', row('knowledge-entry'))).rejects.toThrow(/no_cross_workspace_knowledge/);
  });
});
