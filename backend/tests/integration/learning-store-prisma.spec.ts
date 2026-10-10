/**
 * `T2318` (EPIC-048) — `T2313`'s behaviour, against PostgreSQL.
 *
 * The in-memory store is what unit tests load; this is what the running
 * application holds. `DEF-044-003` and `DEF-045-002` are what happens when the two
 * differ silently: every unit test green, a race or a constraint only the
 * database sees. So the same claims are made here, through the adapter, on the
 * real schema — and two the in-memory store cannot make: the audit entry commits
 * in the writer's transaction, and the triggers stand behind the adapter.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { candidateRecord, citationFor, entryRecordFor, versionRecordFor, recordingAudit } from '../helpers/learning-fixtures.js';
import { PrismaKnowledgeWriter, PrismaLearningStore } from '../../src/modules/learning/learning.store.prisma.js';
import type { CandidateRecord, LearningStore } from '../../src/modules/learning/learning.store.js';
import type { AuditPort } from '../../src/modules/learning/learning.tokens.js';
import type { Materialisation } from '../../src/modules/learning/knowledge.writer.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_a';
const OTHER = 'ws_b';
let container: StartedPostgreSqlContainer;
let db: Client;
let prisma: PrismaClient;
let store: PrismaLearningStore;

/** Writes through the transaction it is handed — what `AuditService.record(input, tx)` does. */
const txAudit: AuditPort = {
  async record(entry, tx) {
    const writer = tx as { create(data: Record<string, unknown>): Promise<void> };
    await writer.create({ ...entry, occurredAt: new Date() });
  },
};

async function seed(over: Partial<CandidateRecord> = {}): Promise<CandidateRecord> {
  const c = candidateRecord({ workspaceId: WS, projectId: 'p1', ...over });
  await store.transaction((tx) =>
    tx.insertCandidate(c, [citationFor(c)], { workspaceId: c.workspaceId, candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() }),
  );
  return c;
}

function materialisation(c: CandidateRecord, over: Partial<Materialisation> = {}): Materialisation {
  const entry = entryRecordFor(c);
  const version = versionRecordFor(c, entry);
  return {
    workspaceId: c.workspaceId,
    candidateId: c.id,
    entry,
    version,
    statusEvents: [{ id: `se_${version.id}`, workspaceId: c.workspaceId, versionId: version.id, status: 'current', successorVersionId: null, reason: null, actorId: 'u_h', decisionId: version.decisionId, candidateId: c.id, at: new Date() }],
    transition: { decisionId: version.decisionId, actorKind: 'human', actorId: 'u_h', reason: null, at: new Date() },
    audit: [{ workspaceId: c.workspaceId, actorId: 'u_h', action: 'create', targetType: 'knowledge_entry_version', targetId: version.id, outcome: 'success' }],
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
  for (const ws of [WS, OTHER]) {
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$1,now())`, [ws]);
  }
  for (const p of ['p1', 'p2']) {
    await db.query(`INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt") VALUES ($1,$2,$1,'u_owner',now())`, [p, WS]);
  }
  prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
  store = new PrismaLearningStore(prisma);
}, 600_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.end();
  await container?.stop();
}, 120_000);

suite('T2318 · the PostgreSQL store behaves as T2313 says', () => {
  describe('workspace scoping on every read (FR-LRN-008)', () => {
    it('a candidate of another workspace is absent by id, key and subject', async () => {
      const c = await seed();
      expect(await store.candidate(OTHER, c.id)).toBeNull();
      expect(await store.candidateByIdempotencyKey(OTHER, c.idempotencyKey)).toBeNull();
      expect(await store.openCandidateFor(OTHER, c.subjectKey, 'new', null)).toBeNull();
      expect(await store.transitions(OTHER, c.id)).toEqual([]);
      expect(await store.citations(OTHER, c.id)).toEqual([]);
      const mine = await store.candidate(WS, c.id);
      expect(mine).toMatchObject({ id: c.id, claimedScope: c.claimedScope, late: false });
      expect(mine?.submittedAt).toBeInstanceOf(Date);
    });

    it('knowledge of another workspace is absent', async () => {
      const c = await seed({ subjectKey: 'test-setup:scoped' });
      const m = materialisation(c);
      await new PrismaKnowledgeWriter(prisma, recordingAudit()).insertVersion(m);
      expect(await store.entry(OTHER, m.entry!.id)).toBeNull();
      expect(await store.version(OTHER, m.version!.id)).toBeNull();
      expect(await store.versionsByIds(OTHER, [m.version!.id])).toEqual([]);
      expect(await store.currentVersionBySubjectKey(OTHER, c.subjectKey)).toBeNull();
      expect((await store.browse(OTHER, {})).items).toEqual([]);
      expect(await store.version(WS, m.version!.id)).toMatchObject({ id: m.version!.id, scope: c.claimedScope });
    });
  });

  describe('append-only', () => {
    it('the adapter offers no update or delete', () => {
      const names = Object.getOwnPropertyNames(Object.getPrototypeOf(store)).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(store))));
      expect(names.filter((n) => /update|delete|remove|upsert|patch/i.test(n))).toEqual([]);
    });

    it('a transition after a terminal state is refused', async () => {
      const c = await seed();
      await store.transaction((tx) => tx.appendTransition({ workspaceId: WS, candidateId: c.id, state: 'withdrawn', reason: null, decisionId: null, actorKind: 'human', actorId: c.sourcePrincipalId, at: new Date() }));
      await expect(
        store.transaction((tx) => tx.appendTransition({ workspaceId: WS, candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() })),
      ).rejects.toThrow(/terminal/);
    });

    it('a failed transaction leaves nothing behind', async () => {
      const c = candidateRecord({ workspaceId: WS, projectId: 'p1' });
      await expect(
        store.transaction(async (tx) => {
          await tx.insertCandidate(c, [citationFor(c)], { workspaceId: WS, candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() });
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(await store.candidate(WS, c.id)).toBeNull();
    });

    it('a candidate needs at least one citation (FR-LRN-012)', async () => {
      const c = candidateRecord({ workspaceId: WS, projectId: 'p1' });
      await expect(
        store.transaction((tx) => tx.insertCandidate(c, [], { workspaceId: WS, candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() })),
      ).rejects.toThrow(/citation/);
    });

    it('a second candidate with the same idempotency key is a ConflictError naming it', async () => {
      const c = await seed();
      await expect(seed({ id: `${c.id}_x`, idempotencyKey: c.idempotencyKey })).rejects.toMatchObject({ code: 'conflict' });
    });

    it('appendTransition refuses approved', async () => {
      const c = await seed();
      await expect(
        store.transaction((tx) => tx.appendTransition({ workspaceId: WS, candidateId: c.id, state: 'approved', reason: null, decisionId: 'd', actorKind: 'human', actorId: 'u_h', at: new Date() })),
      ).rejects.toThrow(/approved/);
    });
  });

  describe('the writer', () => {
    it('writes version, status, approved transition and audit in one transaction', async () => {
      const c = await seed({ subjectKey: 'test-setup:together' });
      const m = materialisation(c);
      await expect(new PrismaKnowledgeWriter(prisma, txAudit).insertVersion(m)).resolves.toBe('written');
      expect((await store.currentTransition(WS, c.id))?.state).toBe('approved');
      expect((await store.currentStatus(WS, m.version!.id))?.status).toBe('current');
      const audit = await db.query(`SELECT 1 FROM audit_entries WHERE "targetId" = $1`, [m.version!.id]);
      expect(audit.rowCount).toBe(1);
    });

    it('rolls everything back when the audit write fails', async () => {
      const c = await seed({ subjectKey: 'test-setup:audit-fails' });
      const m = materialisation(c);
      const failing: AuditPort = { record: async () => { throw new Error('Audit unbound'); } };
      await expect(new PrismaKnowledgeWriter(prisma, failing).insertVersion(m)).rejects.toThrow('Audit unbound');
      expect(await store.version(WS, m.version!.id)).toBeNull();
      expect((await store.currentTransition(WS, c.id))?.state).toBe('proposed');
    });

    it('answers already-terminal for a decided candidate, writing nothing', async () => {
      const c = await seed({ subjectKey: 'test-setup:twice' });
      const writer = new PrismaKnowledgeWriter(prisma, recordingAudit());
      await writer.insertVersion(materialisation(c));
      const second = materialisation(c);
      await expect(writer.insertVersion(second)).resolves.toBe('already-terminal');
      expect(await store.version(WS, second.version!.id)).toBeNull();
    });

    it('supersedes the current version and names the successor; refuses to supersede a non-current one', async () => {
      const writer = new PrismaKnowledgeWriter(prisma, recordingAudit());
      const c1 = await seed({ subjectKey: 'test-setup:history' });
      const m1 = materialisation(c1);
      await writer.insertVersion(m1);
      const c2 = await seed({ subjectKey: 'test-setup:history', kind: 'supersede', targetVersionId: m1.version!.id });
      const v2 = { ...versionRecordFor(c2, m1.entry!), version: 2 };
      await writer.insertVersion({
        ...materialisation(c2),
        entry: null,
        version: v2,
        statusEvents: [
          { id: `se_${v2.id}`, workspaceId: WS, versionId: v2.id, status: 'current', successorVersionId: null, reason: null, actorId: 'u_h', decisionId: v2.decisionId, candidateId: c2.id, at: new Date(Date.now() + 5) },
          { id: `se_${m1.version!.id}_s`, workspaceId: WS, versionId: m1.version!.id, status: 'superseded', successorVersionId: v2.id, reason: null, actorId: 'u_h', decisionId: v2.decisionId, candidateId: c2.id, at: new Date(Date.now() + 5) },
        ],
        transition: { decisionId: v2.decisionId, actorKind: 'human', actorId: 'u_h', reason: null, at: new Date() },
      });
      expect((await store.currentStatus(WS, m1.version!.id))).toMatchObject({ status: 'superseded', successorVersionId: v2.id });
      expect((await store.currentVersionBySubjectKey(WS, 'test-setup:history'))?.id).toBe(v2.id);
      expect((await store.versionsOfEntry(WS, m1.entry!.id)).map((v) => v.version)).toEqual([1, 2]);

      const c3 = await seed({ subjectKey: 'test-setup:history', kind: 'supersede', targetVersionId: m1.version!.id });
      const v3 = { ...versionRecordFor(c3, m1.entry!), version: 3 };
      await expect(
        writer.insertVersion({
          ...materialisation(c3),
          entry: null,
          version: v3,
          statusEvents: [
            { id: `se_${v3.id}`, workspaceId: WS, versionId: v3.id, status: 'current', successorVersionId: null, reason: null, actorId: 'u_h', decisionId: v3.decisionId, candidateId: c3.id, at: new Date() },
            { id: `se_${m1.version!.id}_t`, workspaceId: WS, versionId: m1.version!.id, status: 'superseded', successorVersionId: v3.id, reason: null, actorId: 'u_h', decisionId: v3.decisionId, candidateId: c3.id, at: new Date() },
          ],
        }),
      ).rejects.toThrow(/not current/);
    });

    it('the source-exclusion trigger stands behind the adapter (FR-LRN-027)', async () => {
      const c = await seed({ subjectKey: 'test-setup:self' });
      const m = materialisation(c);
      await expect(
        new PrismaKnowledgeWriter(prisma, recordingAudit()).insertVersion({ ...m, version: { ...m.version!, approvedBy: c.sourcePrincipalId } }),
      ).rejects.toThrow(/source/);
    });
  });

  describe('latest rows', () => {
    it('state is the max seq, and open-candidate lookup follows it', async () => {
      const c = await seed({ subjectKey: 'test-setup:latest' });
      await store.transaction((tx) => tx.appendTransition({ workspaceId: WS, candidateId: c.id, state: 'pending-review', reason: null, decisionId: 'd_1', actorKind: 'platform', actorId: 'learning-intake', at: new Date() }));
      expect((await store.transitions(WS, c.id)).map((t) => [t.seq, t.state])).toEqual([
        [1, 'proposed'],
        [2, 'pending-review'],
      ]);
      expect((await store.openCandidateFor(WS, 'test-setup:latest', 'new', null))?.id).toBe(c.id);
      expect((await store.candidatesInStates(['pending-review'], WS)).map((r) => r.candidate.id)).toContain(c.id);
      await store.transaction((tx) => tx.appendTransition({ workspaceId: WS, candidateId: c.id, state: 'withdrawn', reason: null, decisionId: null, actorKind: 'human', actorId: 'u', at: new Date() }));
      expect(await store.openCandidateFor(WS, 'test-setup:latest', 'new', null)).toBeNull();
    });

    it('counts candidates and corroborations per execution (FR-LRN-007)', async () => {
      const c = await seed({ executionId: 'exe_count', subjectKey: 'test-setup:count' });
      await store.transaction((tx) =>
        tx.insertCorroboration(
          { id: `co_${c.id}`, workspaceId: WS, candidateId: c.id, sourceKind: 'execution', executionId: 'exe_count', sourcePrincipalId: 'agent_2', expertId: null, expertContractVersionId: null, statement: 's', confidenceLevel: 'low', confidenceBasis: 'b', late: false, idempotencyKey: `co_idem_${c.id}`, correlationId: 'c', submittedAt: new Date() },
          [citationFor(c, { corroborationId: `co_${c.id}` })],
        ),
      );
      expect(await store.submissionsForExecution(WS, 'exe_count')).toBe(2);
      expect((await store.corroborationByIdempotencyKey(WS, `co_idem_${c.id}`))?.candidateId).toBe(c.id);
    });

    it('browses newest first, filters, and pages by token', async () => {
      const writer = new PrismaKnowledgeWriter(prisma, recordingAudit());
      for (let i = 0; i < 3; i += 1) {
        const c = await seed({ subjectKey: `browse:${i}`, category: 'browse-cat' });
        const m = materialisation(c);
        await writer.insertVersion({ ...m, version: { ...m.version!, approvedAt: new Date(Date.UTC(2026, 0, 1 + i)) } });
      }
      const first = await store.browse(WS, { category: 'browse-cat', limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();
      expect(first.items[0]!.version.approvedAt.getTime()).toBeGreaterThan(first.items[1]!.version.approvedAt.getTime());
      const second = await store.browse(WS, { category: 'browse-cat', limit: 2, after: first.nextCursor! });
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      expect((await store.browse(WS, { category: 'browse-cat', status: 'superseded' })).items).toEqual([]);
      expect((await store.browse(WS, { category: 'browse-cat', projectId: 'p2' })).items).toEqual([]);
      expect((await store.browse(WS, { category: 'browse-cat', projectId: 'p1', status: 'current' })).items).toHaveLength(3);
    });
  });

  it('is a LearningStore', () => {
    const typed: LearningStore = store;
    expect(typeof typed.transaction).toBe('function');
  });
});
