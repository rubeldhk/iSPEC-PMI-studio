/**
 * `T1909` (EPIC-047) — the schema refuses what the services refuse.
 *
 * Exercised **around** the services, with raw SQL, because an application rule
 * is one refactor away from gone (`R-047-14`). An approved contract version may
 * gain its decision id once and change in no other way; the memory policy is
 * `none` in the stored contract itself; a limit can only read *stopped* if it
 * was enforced; and an assignment is superseded, never rewritten.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { contract } from '../helpers/expert-fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_exp';
let container: StartedPostgreSqlContainer;
let db: Client;
let seq = 0;
const id = (prefix: string): string => `${prefix}_${(seq += 1)}`;

async function insert(table: string, row: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
  const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
  await db.query(`INSERT INTO "${table}" (${cols}) VALUES (${params})`, Object.values(row));
}

async function expertRow(over: Record<string, unknown> = {}): Promise<string> {
  const row = { id: id('ex'), workspaceId: WS, key: id('key'), name: 'Test Engineer', status: 'active', registeredBy: 'u_1', ...over };
  await insert('engineering_experts', row);
  return String(row.id);
}

async function versionRow(expertId: string, over: Record<string, unknown> = {}): Promise<string> {
  const row = { id: id('cv'), workspaceId: WS, expertId, version: 1, contract: JSON.stringify(contract()), createdBy: 'u_1', ...over };
  await insert('expert_contract_versions', row);
  return String(row.id);
}

async function sessionRow(expertId: string, versionId: string, over: Record<string, unknown> = {}): Promise<string> {
  const row = {
    executionId: id('exe'), workspaceId: WS, expertId, contractVersionId: versionId, actorId: 'u_1', depth: 0,
    model: 'claude-opus-5-5', usedFallback: false, effectiveAuthority: '{}', toolObservation: 'unobserved',
    unattended: false, reviewRequired: false, ...over,
  };
  await insert('expert_sessions', row);
  return String(row.executionId);
}

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  db = new Client({ connectionString: container.getConnectionUri() });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'w',now())`, [WS]);
}, 600_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
}, 120_000);

suite('T1909 · engineering_experts', () => {
  it('a key is unique within a workspace', async () => {
    await expertRow({ key: 'dup' });
    await expect(expertRow({ key: 'dup' })).rejects.toThrow(/unique|duplicate/i);
  });

  it('retired and its timestamp go together', async () => {
    await expect(expertRow({ status: 'retired' })).rejects.toThrow(/check/i);
  });
});

suite('T1909 · expert_contract_versions — immutable (R-047-14)', () => {
  it('a memory policy other than none or governed-knowledge violates the check (FR-EXP-020)', async () => {
    const ex = await expertRow();
    await expect(
      versionRow(ex, { contract: JSON.stringify({ ...contract(), memoryPolicy: 'session' }) }),
    ).rejects.toThrow(/check/i);
  });

  it('T2018 · governed-knowledge satisfies the check (FR-EXP-020, amendment A-047-1)', async () => {
    const ex = await expertRow();
    await expect(
      versionRow(ex, { contract: JSON.stringify({ ...contract(), memoryPolicy: 'governed-knowledge' }) }),
    ).resolves.toBeDefined();
  });

  it('a risk class outside the three bands violates the check', async () => {
    const ex = await expertRow();
    await expect(
      versionRow(ex, { contract: JSON.stringify({ ...contract(), riskClass: 'extreme' }) }),
    ).rejects.toThrow(/check/i);
  });

  it('the decision id may be written once, from null', async () => {
    const ex = await expertRow();
    const cv = await versionRow(ex);
    await db.query(`UPDATE "expert_contract_versions" SET "decisionId"='d_1' WHERE "id"=$1`, [cv]);
    await expect(
      db.query(`UPDATE "expert_contract_versions" SET "decisionId"='d_2' WHERE "id"=$1`, [cv]),
    ).rejects.toThrow(/immutable/i);
  });

  // `T2575`, `R-047-17` — a refused version may be resubmitted, so its decision
  // id may be replaced, but only while the decision it names stands refused
  // (or is EPIC-031's 'unrecorded'). Pending and approved stay immutable.
  it('T2575 · the decision id is replaced only in place of a refused or withdrawn decision, never a rejected one', async () => {
    const decision = async (outcome: string, resolves: string | null = null, closureKind: string | null = null): Promise<string> => {
      const ex = id('dx');
      await insert('decision_explanations', {
        id: ex, workspaceId: WS, policyVersion: '0', riskClass: 'medium', authorityApplied: 'test',
        closureKind, closureReason: closureKind === null ? null : 'test',
      });
      const d = id('pd');
      await insert('policy_decisions', {
        id: d, workspaceId: WS, projectId: '(workspace)', actionType: 'expert-contract.approve.medium',
        targetType: 'expert-contract-version', targetId: 'cv', effectiveClass: 'medium', outcome,
        decidedBy: outcome === 'pending' ? null : 'policy:v0', authorityBasis: 'test', objectVersion: '1',
        actorKind: 'human', actorId: 'u_1', steeringVersions: '{}', policyVersion: 0, requiredGates: '[]',
        gateOutcomes: '[]', resolvesDecisionId: resolves, explanationId: ex,
      });
      return d;
    };
    const replace = (cv: string, to: string) =>
      db.query(`UPDATE "expert_contract_versions" SET "decisionId"=$2 WHERE "id"=$1`, [cv, to]);

    const refused = await versionRow(await expertRow(), { decisionId: await decision('refused') });
    await expect(replace(refused, await decision('pending'))).resolves.toBeDefined();

    const unrecorded = await versionRow(await expertRow(), { decisionId: 'unrecorded' });
    await expect(replace(unrecorded, await decision('pending'))).resolves.toBeDefined();

    // Refused, then approved under an exception: it stands approved, so it stays.
    const first = await decision('refused');
    await decision('exception', first);
    const excepted = await versionRow(await expertRow(), { decisionId: first });
    await expect(replace(excepted, await decision('pending'))).rejects.toThrow(/immutable/i);

    // Pending, then withdrawn by its submitter (FR-DPE-017): replaceable.
    const pending = await decision('pending');
    await decision('refused', pending, 'withdrawn');
    const withdrawn = await versionRow(await expertRow(), { decisionId: pending });
    await expect(replace(withdrawn, await decision('pending'))).resolves.toBeDefined();

    // Pending, then rejected by a human (FR-DPE-017): a judgement, not replaceable.
    const judged = await decision('pending');
    await decision('refused', judged, 'rejected');
    const rejected = await versionRow(await expertRow(), { decisionId: judged });
    await expect(replace(rejected, await decision('pending'))).rejects.toThrow(/immutable/i);

    for (const outcome of ['pending', 'approved', 'auto-executed']) {
      const cv = await versionRow(await expertRow(), { decisionId: await decision(outcome) });
      await expect(replace(cv, await decision('pending'))).rejects.toThrow(/immutable/i);
    }
  });

  it('no other column may change, and no version may be deleted', async () => {
    const ex = await expertRow();
    const cv = await versionRow(ex);
    await expect(
      db.query(`UPDATE "expert_contract_versions" SET "contract"='{}'::jsonb WHERE "id"=$1`, [cv]),
    ).rejects.toThrow(/immutable/i);
    await expect(
      db.query(`UPDATE "expert_contract_versions" SET "version"=9 WHERE "id"=$1`, [cv]),
    ).rejects.toThrow(/immutable/i);
    await expect(db.query(`DELETE FROM "expert_contract_versions" WHERE "id"=$1`, [cv])).rejects.toThrow(
      /immutable/i,
    );
  });

  it('a version number is unique per Expert', async () => {
    const ex = await expertRow();
    await versionRow(ex, { version: 1 });
    await expect(versionRow(ex, { version: 1 })).rejects.toThrow(/unique|duplicate/i);
  });
});

suite('T1909 · expert_sessions and expert_session_limits', () => {
  it('a root has no delegation parent, and a delegate has one', async () => {
    const ex = await expertRow();
    const cv = await versionRow(ex);
    await expect(sessionRow(ex, cv, { depth: 1 })).rejects.toThrow(/check/i);
    const root = await sessionRow(ex, cv);
    await expect(sessionRow(ex, cv, { depth: 1, delegatedFromExecutionId: root })).resolves.toBeTruthy();
  });

  it('an unattended session always requires review (FR-EXP-063)', async () => {
    const ex = await expertRow();
    const cv = await versionRow(ex);
    await expect(sessionRow(ex, cv, { unattended: true, reviewRequired: false })).rejects.toThrow(/check/i);
  });

  it('T2004 · a new session names its originating actor (FR-EXP-034)', async () => {
    const ex = await expertRow();
    const cv = await versionRow(ex);
    await expect(sessionRow(ex, cv, { actorId: '  ' })).rejects.toThrow(/check/i);
  });

  it('a fallback names its reason', async () => {
    const ex = await expertRow();
    const cv = await versionRow(ex);
    await expect(sessionRow(ex, cv, { usedFallback: true })).rejects.toThrow(/check/i);
  });

  it('a limit reads stopped only if it was enforced (FR-EXP-042)', async () => {
    const ex = await expertRow();
    const cv = await versionRow(ex);
    const exe = await sessionRow(ex, cv);
    await expect(
      insert('expert_session_limits', { executionId: exe, workspaceId: WS, limit: 'tokens', value: 1000, enforcement: 'unenforceable', reached: 'stopped' }),
    ).rejects.toThrow(/check/i);
  });

  it('a late breach carries the instant it was detected (FR-EXP-046)', async () => {
    const ex = await expertRow();
    const cv = await versionRow(ex);
    const exe = await sessionRow(ex, cv);
    await expect(
      insert('expert_session_limits', { executionId: exe, workspaceId: WS, limit: 'cost', value: 4, enforcement: 'unenforceable', reached: 'detected-late' }),
    ).rejects.toThrow(/check/i);
  });
});

suite('T1909 · task_assignments — superseded, never rewritten', () => {
  async function task(): Promise<string> {
    // `EPIC-046` widened `specificationId` to nullable, so a task needs nothing
    // but its workspace and description to exist.
    const taskId = id('t');
    await db.query(
      `INSERT INTO "tasks" ("id","workspaceId","description","engineName","engineVersion","updatedAt")
       VALUES ($1,$2,'T','spec-kit','0.14.3',now())`,
      [taskId, WS],
    );
    return taskId;
  }

  it('a pending-decision assignment names its decision (FR-EXP-054)', async () => {
    const t = await task();
    await expect(
      insert('task_assignments', { id: id('as'), workspaceId: WS, taskId: t, assigneeKind: 'expert', assigneeId: 'ex_1', rule: 'r', state: 'pending-decision', assignedBy: 'u_1' }),
    ).rejects.toThrow(/check/i);
  });

  it('may be superseded once and changed in no other way', async () => {
    const t = await task();
    const as = id('as');
    await insert('task_assignments', { id: as, workspaceId: WS, taskId: t, assigneeKind: 'person', assigneeId: 'u_9', rule: 'r', state: 'standing', assignedBy: 'u_1' });
    await expect(db.query(`UPDATE "task_assignments" SET "assigneeId"='u_8' WHERE "id"=$1`, [as])).rejects.toThrow(/append-only/i);
    await db.query(`UPDATE "task_assignments" SET "supersededAt"=now(), "supersededBy"='u_2' WHERE "id"=$1`, [as]);
    await expect(
      db.query(`UPDATE "task_assignments" SET "supersededBy"='u_3' WHERE "id"=$1`, [as]),
    ).rejects.toThrow(/append-only/i);
  });
});
