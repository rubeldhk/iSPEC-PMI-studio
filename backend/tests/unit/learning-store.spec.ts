/**
 * `T2313` (EPIC-048) — the store's shape is part of the fence (`R-048-4` fence 1).
 *
 * - Every read is workspace-scoped (`FR-LRN-008`): another workspace's row is
 *   absent, not forbidden.
 * - Every table is append-only: no update, no delete, anywhere on the surface.
 * - The store interface services receive has **no** version-insert method; only
 *   `KnowledgeWriter` has one, and only `materialiser.ts` receives a writer.
 * - Current state and current version are the latest rows, never a column.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryLearningStore, type CandidateRecord } from '../../src/modules/learning/learning.store.js';
import { InMemoryKnowledgeWriter } from '../../src/modules/learning/knowledge.writer.js';
import { candidateRecord, citationFor, versionRecordFor, entryRecordFor, recordingAudit } from '../helpers/learning-fixtures.js';

const WS = 'ws_a';
const OTHER = 'ws_b';

async function seedCandidate(store: InMemoryLearningStore, over: Partial<CandidateRecord> = {}): Promise<CandidateRecord> {
  const c = candidateRecord({ workspaceId: WS, ...over });
  await store.transaction((tx) =>
    tx.insertCandidate(c, [citationFor(c)], { workspaceId: c.workspaceId, candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() }),
  );
  return c;
}

describe('T2313 · workspace scoping on every read (FR-LRN-008)', () => {
  it('a candidate of another workspace is absent by id, by key and by subject', async () => {
    const store = new InMemoryLearningStore();
    const c = await seedCandidate(store);
    expect(await store.candidate(OTHER, c.id)).toBeNull();
    expect(await store.candidateByIdempotencyKey(OTHER, c.idempotencyKey)).toBeNull();
    expect(await store.openCandidateFor(OTHER, c.subjectKey, 'new', null)).toBeNull();
    expect(await store.transitions(OTHER, c.id)).toEqual([]);
    expect(await store.citations(OTHER, c.id)).toEqual([]);
    expect(await store.candidate(WS, c.id)).not.toBeNull();
  });

  it('knowledge of another workspace is absent', async () => {
    const store = new InMemoryLearningStore();
    const writer = new InMemoryKnowledgeWriter(store, recordingAudit());
    const c = await seedCandidate(store);
    const entry = entryRecordFor(c);
    const version = versionRecordFor(c, entry);
    await writer.insertVersion({
      workspaceId: WS,
      candidateId: c.id,
      entry,
      version,
      statusEvents: [{ id: 'se_1', workspaceId: WS, versionId: version.id, status: 'current', successorVersionId: null, reason: null, actorId: 'u_h', decisionId: version.decisionId, candidateId: c.id, at: new Date() }],
      transition: { decisionId: version.decisionId, actorKind: 'human', actorId: 'u_h', reason: null, at: new Date() },
      audit: [{ workspaceId: WS, actorId: 'u_h', action: 'create', targetType: 'knowledge_entry_version', targetId: version.id, outcome: 'success' }],
    });
    expect(await store.entry(OTHER, entry.id)).toBeNull();
    expect(await store.version(OTHER, version.id)).toBeNull();
    expect(await store.versionsByIds(OTHER, [version.id])).toEqual([]);
    expect(await store.currentVersionBySubjectKey(OTHER, c.subjectKey)).toBeNull();
    expect((await store.browse(OTHER, {})).items).toEqual([]);
    expect(await store.version(WS, version.id)).not.toBeNull();
  });
});

describe('T2313 · append-only, every table', () => {
  it('the store offers no update, delete, set or remove of any kind', () => {
    const store = new InMemoryLearningStore();
    const names = methodNames(store);
    expect(names.filter((n) => /update|delete|remove|set[A-Z]|edit|patch|replace|upsert/i.test(n))).toEqual([]);
  });

  it('the writer offers no update or delete either', () => {
    const writer = new InMemoryKnowledgeWriter(new InMemoryLearningStore(), recordingAudit());
    expect(methodNames(writer).filter((n) => /update|delete|remove|set[A-Z]|edit|patch/i.test(n))).toEqual([]);
  });

  it('a transition after a terminal state is refused', async () => {
    const store = new InMemoryLearningStore();
    const c = await seedCandidate(store);
    await store.transaction((tx) => tx.appendTransition({ workspaceId: WS, candidateId: c.id, state: 'withdrawn', reason: null, decisionId: null, actorKind: 'human', actorId: c.sourcePrincipalId, at: new Date() }));
    await expect(
      store.transaction((tx) => tx.appendTransition({ workspaceId: WS, candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() })),
    ).rejects.toThrow(/terminal/);
  });

  it('a failed transaction leaves nothing behind', async () => {
    const store = new InMemoryLearningStore();
    const c = candidateRecord({ workspaceId: WS });
    await expect(
      store.transaction(async (tx) => {
        await tx.insertCandidate(c, [citationFor(c)], { workspaceId: WS, candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await store.candidate(WS, c.id)).toBeNull();
  });

  it('a candidate needs at least one citation (FR-LRN-012)', async () => {
    const store = new InMemoryLearningStore();
    const c = candidateRecord({ workspaceId: WS });
    await expect(
      store.transaction((tx) => tx.insertCandidate(c, [], { workspaceId: WS, candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() })),
    ).rejects.toThrow(/citation/);
  });

  it('a second candidate with the same (workspaceId, idempotencyKey) is refused', async () => {
    const store = new InMemoryLearningStore();
    const c = await seedCandidate(store);
    await expect(seedCandidate(store, { id: 'lc_other', idempotencyKey: c.idempotencyKey })).rejects.toThrow(/idempotency/);
  });
});

describe('T2313 · the store has no version insert; only KnowledgeWriter does (R-048-4)', () => {
  it('no method on the store or a transaction inserts a version, a status event or an approved transition', async () => {
    const store = new InMemoryLearningStore();
    const forbidden = (n: string): boolean => /version|status|knowledge|materiali/i.test(n) && /insert|append|add|create|write|record/i.test(n);
    expect(methodNames(store).filter(forbidden)).toEqual([]);
    await store.transaction(async (tx) => {
      expect(methodNames(tx).filter(forbidden)).toEqual([]);
    });
  });

  it('appendTransition refuses approved — only the writer moves a candidate there', async () => {
    const store = new InMemoryLearningStore();
    const c = await seedCandidate(store);
    await expect(
      store.transaction((tx) => tx.appendTransition({ workspaceId: WS, candidateId: c.id, state: 'approved', reason: null, decisionId: 'd_1', actorKind: 'human', actorId: 'u_h', at: new Date() })),
    ).rejects.toThrow(/approved/);
  });

  it('KnowledgeWriter.insertVersion is the one insert, and it writes version, status and approved transition together', async () => {
    const store = new InMemoryLearningStore();
    const writer = new InMemoryKnowledgeWriter(store, recordingAudit());
    expect(typeof writer.insertVersion).toBe('function');
    const c = await seedCandidate(store);
    const entry = entryRecordFor(c);
    const version = versionRecordFor(c, entry);
    const result = await writer.insertVersion({
      workspaceId: WS,
      candidateId: c.id,
      entry,
      version,
      statusEvents: [{ id: 'se_1', workspaceId: WS, versionId: version.id, status: 'current', successorVersionId: null, reason: null, actorId: 'u_h', decisionId: version.decisionId, candidateId: c.id, at: new Date() }],
      transition: { decisionId: version.decisionId, actorKind: 'human', actorId: 'u_h', reason: null, at: new Date() },
      audit: [{ workspaceId: WS, actorId: 'u_h', action: 'create', targetType: 'knowledge_entry_version', targetId: version.id, outcome: 'success' }],
    });
    expect(result).toBe('written');
    expect((await store.currentTransition(WS, c.id))?.state).toBe('approved');
    expect((await store.currentStatus(WS, version.id))?.status).toBe('current');
    expect(await store.versionForCandidate(WS, c.id)).toMatchObject({ id: version.id });
  });

  it('the writer refuses an audit that cannot be written — and writes nothing', async () => {
    const store = new InMemoryLearningStore();
    const writer = new InMemoryKnowledgeWriter(store, { record: async () => { throw new Error('Audit unbound'); } });
    const c = await seedCandidate(store);
    const entry = entryRecordFor(c);
    const version = versionRecordFor(c, entry);
    await expect(
      writer.insertVersion({
        workspaceId: WS,
        candidateId: c.id,
        entry,
        version,
        statusEvents: [],
        transition: { decisionId: version.decisionId, actorKind: 'human', actorId: 'u_h', reason: null, at: new Date() },
        audit: [{ workspaceId: WS, actorId: 'u_h', action: 'create', targetType: 'knowledge_entry_version', targetId: version.id, outcome: 'success' }],
      }),
    ).rejects.toThrow('Audit unbound');
    expect(await store.version(WS, version.id)).toBeNull();
    expect((await store.currentTransition(WS, c.id))?.state).toBe('proposed');
  });
});

describe('T2313 · current state and current version are the latest rows', () => {
  it('state is the max seq', async () => {
    const store = new InMemoryLearningStore();
    const c = await seedCandidate(store);
    await store.transaction((tx) => tx.appendTransition({ workspaceId: WS, candidateId: c.id, state: 'pending-review', reason: null, decisionId: 'd_1', actorKind: 'platform', actorId: 'learning-intake', at: new Date() }));
    const all = await store.transitions(WS, c.id);
    expect(all.map((t) => [t.seq, t.state])).toEqual([
      [1, 'proposed'],
      [2, 'pending-review'],
    ]);
    expect((await store.currentTransition(WS, c.id))?.state).toBe('pending-review');
  });

  it('status is the latest status row per version', async () => {
    const store = new InMemoryLearningStore();
    const writer = new InMemoryKnowledgeWriter(store, recordingAudit());
    const c1 = await seedCandidate(store);
    const entry = entryRecordFor(c1);
    const v1 = versionRecordFor(c1, entry);
    await writer.insertVersion({
      workspaceId: WS, candidateId: c1.id, entry, version: v1,
      statusEvents: [{ id: 'se_1', workspaceId: WS, versionId: v1.id, status: 'current', successorVersionId: null, reason: null, actorId: 'u_h', decisionId: v1.decisionId, candidateId: c1.id, at: new Date() }],
      transition: { decisionId: v1.decisionId, actorKind: 'human', actorId: 'u_h', reason: null, at: new Date() },
      audit: [],
    });
    const c2 = await seedCandidate(store, { id: 'lc_2', idempotencyKey: 'idem_2', kind: 'supersede', targetVersionId: v1.id });
    const v2 = { ...versionRecordFor(c2, entry), version: 2 };
    await writer.insertVersion({
      workspaceId: WS, candidateId: c2.id, entry: null, version: v2,
      statusEvents: [
        { id: 'se_2', workspaceId: WS, versionId: v2.id, status: 'current', successorVersionId: null, reason: null, actorId: 'u_h', decisionId: v2.decisionId, candidateId: c2.id, at: new Date() },
        { id: 'se_3', workspaceId: WS, versionId: v1.id, status: 'superseded', successorVersionId: v2.id, reason: null, actorId: 'u_h', decisionId: v2.decisionId, candidateId: c2.id, at: new Date() },
      ],
      transition: { decisionId: v2.decisionId, actorKind: 'human', actorId: 'u_h', reason: null, at: new Date() },
      audit: [],
    });
    expect((await store.currentStatus(WS, v1.id))?.status).toBe('superseded');
    expect((await store.currentStatus(WS, v1.id))?.successorVersionId).toBe(v2.id);
    expect((await store.currentStatus(WS, v2.id))?.status).toBe('current');
    expect((await store.currentVersionBySubjectKey(WS, c1.subjectKey))?.id).toBe(v2.id);
    expect((await store.versionsOfEntry(WS, entry.id)).map((v) => v.version)).toEqual([1, 2]);
  });
});

function methodNames(obj: object): string[] {
  const names = new Set<string>();
  let proto: object | null = obj;
  while (proto && proto !== Object.prototype) {
    for (const n of Object.getOwnPropertyNames(proto)) {
      if (n !== 'constructor' && typeof (obj as Record<string, unknown>)[n] === 'function') names.add(n);
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return [...names];
}
