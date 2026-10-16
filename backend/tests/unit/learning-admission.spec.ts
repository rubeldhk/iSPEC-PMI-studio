/**
 * `T2372` (EPIC-048, US5, `FR-LRN-040`…`046`, `FR-LRN-055`; `R-048-11`) — may
 * this approved version be supplied to this package? The verdict matrix.
 *
 * | This Epic's rule | Reason | `detail` begins |
 * |---|---|---|
 * | approved scope excludes the project | `boundary` | `scope:` |
 * | classification not permitted / undetermined outside its origin | `classification` | `classification:` |
 * | reuse policy disallows | `boundary` | `reuse-policy:` |
 * | another workspace | `boundary` | `workspace:` |
 * | superseded / deprecated | `stale` | `superseded:` / `deprecated:` |
 * | project archived | `boundary` | `archived:` |
 * | an Expert declaring `none` | `permission` | `memory-policy:` |
 *
 * A batch of 200 makes **one** store read. The reader `EPIC-038`'s sources
 * adapter calls (`KnowledgeReader`, `T2333`) is asserted here too.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { KnowledgeGate, KnowledgeReader } from '../../src/modules/learning/supply.js';
import { InMemoryKnowledgeWriter } from '../../src/modules/learning/knowledge.writer.js';
import { InMemoryLearningStore, type CandidateRecord, type LearningReads } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { refusingPorts } from '../../src/modules/learning/learning.tokens.js';
import { candidateRecord, citationFor, entryRecordFor, recordingAudit, versionRecordFor } from '../helpers/learning-fixtures.js';
import { learningWorld, POLICY, type LearningTestWorld } from '../helpers/learning-ports.js';

let world: LearningTestWorld;
let store: InMemoryLearningStore;
let reads: number;

/** The store, counting reads of admission facts. */
function counted(): LearningReads {
  return new Proxy(store, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (prop === 'admissionFacts' && typeof value === 'function') {
        return (...args: unknown[]) => {
          reads += 1;
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  }) as LearningReads;
}

function gate(ports = world.ports): KnowledgeGate {
  return new KnowledgeGate({ reads: counted(), ports, policy: new LearningPolicyReader(ports.policy) });
}

/** An approved version, written as the materialiser would. */
async function version(over: Partial<CandidateRecord> & { classification?: string; scope?: CandidateRecord['claimedScope'] } = {}): Promise<{ entryId: string; versionId: string }> {
  const { classification, scope, ...cOver } = over;
  const c = candidateRecord({ subjectKey: `k:${Math.random()}`, idempotencyKey: `i:${Math.random()}`, ...cOver });
  await store.transaction((tx) => tx.insertCandidate(c, [citationFor(c)], { workspaceId: c.workspaceId, candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() }));
  const entry = entryRecordFor(c);
  const v = versionRecordFor(c, entry, { classification: classification ?? 'internal', scope: scope ?? c.claimedScope });
  await new InMemoryKnowledgeWriter(store, recordingAudit()).insertVersion({
    workspaceId: c.workspaceId, candidateId: c.id, entry, version: v,
    statusEvents: [{ id: `se_${v.id}`, workspaceId: c.workspaceId, versionId: v.id, status: 'current', successorVersionId: null, reason: null, actorId: 'u_h', decisionId: v.decisionId, candidateId: c.id, at: new Date() }],
    transition: { decisionId: v.decisionId, actorKind: 'human', actorId: 'u_h', reason: null, at: new Date() },
    audit: [],
  });
  return { entryId: entry.id, versionId: v.id };
}

const one = async (g: KnowledgeGate, v: { entryId: string; versionId: string }, target: { workspaceId?: string; projectId: string; executionId?: string }) =>
  (await g.admit([{ sourceId: v.entryId, sourceVersion: v.versionId }], { workspaceId: target.workspaceId ?? 'ws_a', projectId: target.projectId, ...(target.executionId ? { executionId: target.executionId } : {}) }))[0]!;

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
  reads = 0;
});

describe('T2372 · admitted', () => {
  it('a project-scoped entry in its own project, marked as approved knowledge (FR-LRN-052)', async () => {
    const v = await version();
    const verdict = await one(gate(), v, { projectId: 'p1' });
    expect(verdict).toEqual({ admitted: true, inclusionNote: `approved knowledge — entry ${v.entryId} v1, scope project p1` });
  });

  it('a workspace-scoped entry in another project whose permitted classifications include it (US5-2)', async () => {
    const v = await version({ scope: { kind: 'workspace', projectIds: [] } });
    expect(await one(gate(), v, { projectId: 'p2' })).toMatchObject({ admitted: true });
  });
});

describe('T2372 · the matrix of R-048-11', () => {
  it('scope: a project-scoped entry elsewhere → boundary, scope: (FR-LRN-041, US5-1)', async () => {
    const v = await version();
    expect(await one(gate(), v, { projectId: 'p2' })).toMatchObject({ admitted: false, reason: 'boundary', detail: expect.stringMatching(/^scope:/) });
  });

  it('classification not permitted → classification (US5-3)', async () => {
    const v = await version({ scope: { kind: 'workspace', projectIds: [] }, classification: 'restricted' });
    expect(await one(gate(), v, { projectId: 'p2' })).toMatchObject({ admitted: false, reason: 'classification', detail: expect.stringMatching(/^classification:/) });
  });

  it('undetermined classification outside its origin → classification; inside it → admitted (FR-LRN-044)', async () => {
    const v = await version({ scope: { kind: 'workspace', projectIds: [] }, classification: 'undetermined' });
    expect(await one(gate(), v, { projectId: 'p2' })).toMatchObject({ admitted: false, reason: 'classification', detail: expect.stringMatching(/^classification:.*undetermined/) });
    expect(await one(gate(), v, { projectId: 'p1' })).toMatchObject({ admitted: true });
  });

  it('reuse policy disallows workspace scope → boundary, reuse-policy: (FR-LRN-040)', async () => {
    world.policyDocs.set('ws_a', { content: JSON.stringify({ ...POLICY, reuse: { ...POLICY.reuse, workspaceScopeAllowed: false } }), version: 2, actorId: 'u' });
    const v = await version({ scope: { kind: 'workspace', projectIds: [] } });
    expect(await one(gate(), v, { projectId: 'p2' })).toMatchObject({ admitted: false, reason: 'boundary', detail: expect.stringMatching(/^reuse-policy:/) });
  });

  it('reuse policy disallows named sets → boundary, reuse-policy:', async () => {
    world.policyDocs.set('ws_a', { content: JSON.stringify({ ...POLICY, reuse: { ...POLICY.reuse, namedSetsAllowed: false } }), version: 2, actorId: 'u' });
    const v = await version({ scope: { kind: 'projects', projectIds: ['p1', 'p2'] } });
    expect(await one(gate(), v, { projectId: 'p2' })).toMatchObject({ admitted: false, reason: 'boundary', detail: expect.stringMatching(/^reuse-policy:/) });
  });

  it('no learning policy → nothing reusable beyond the origin project', async () => {
    world.policyDocs.delete('ws_a');
    const v = await version({ scope: { kind: 'workspace', projectIds: [] } });
    expect(await one(gate(), v, { projectId: 'p2' })).toMatchObject({ admitted: false, reason: 'boundary', detail: expect.stringMatching(/^reuse-policy:/) });
  });

  it('another workspace → boundary, workspace: — whatever authorisations exist (FR-LRN-043, US5-4)', async () => {
    const v = await version({ scope: { kind: 'workspace', projectIds: [] } });
    expect(await one(gate(), v, { workspaceId: 'ws_b', projectId: 'px' })).toMatchObject({ admitted: false, reason: 'boundary', detail: expect.stringMatching(/^workspace:/) });
  });

  it('superseded → stale, superseded:; deprecated → stale, deprecated: (FR-LRN-033)', async () => {
    const v = await version();
    await store.transaction(async () => undefined);
    const writer = new InMemoryKnowledgeWriter(store, recordingAudit());
    const c2 = candidateRecord({ kind: 'deprecate', targetVersionId: v.versionId, statement: 'gone', idempotencyKey: 'dep' });
    await store.transaction((tx) => tx.insertCandidate(c2, [citationFor(c2)], { workspaceId: 'ws_a', candidateId: c2.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() }));
    await writer.insertVersion({
      workspaceId: 'ws_a', candidateId: c2.id, entry: null, version: null,
      statusEvents: [{ id: 'se_dep', workspaceId: 'ws_a', versionId: v.versionId, status: 'deprecated', successorVersionId: null, reason: 'gone', actorId: 'u_h', decisionId: 'd', candidateId: c2.id, at: new Date() }],
      transition: { decisionId: 'd', actorKind: 'human', actorId: 'u_h', reason: null, at: new Date() },
      audit: [],
    });
    expect(await one(gate(), v, { projectId: 'p1' })).toMatchObject({ admitted: false, reason: 'stale', detail: expect.stringMatching(/^deprecated:/) });

    const w = await version();
    const c3 = candidateRecord({ kind: 'supersede', targetVersionId: w.versionId, idempotencyKey: 'sup' });
    await store.transaction((tx) => tx.insertCandidate(c3, [citationFor(c3)], { workspaceId: 'ws_a', candidateId: c3.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() }));
    const v2 = { ...versionRecordFor(c3, entryRecordFor(c3, { id: w.entryId })), version: 2 };
    await writer.insertVersion({
      workspaceId: 'ws_a', candidateId: c3.id, entry: null, version: v2,
      statusEvents: [
        { id: 'se_v2', workspaceId: 'ws_a', versionId: v2.id, status: 'current', successorVersionId: null, reason: null, actorId: 'u_h', decisionId: 'd2', candidateId: c3.id, at: new Date() },
        { id: 'se_w', workspaceId: 'ws_a', versionId: w.versionId, status: 'superseded', successorVersionId: v2.id, reason: null, actorId: 'u_h', decisionId: 'd2', candidateId: c3.id, at: new Date() },
      ],
      transition: { decisionId: 'd2', actorKind: 'human', actorId: 'u_h', reason: null, at: new Date() },
      audit: [],
    });
    expect(await one(gate(), w, { projectId: 'p1' })).toMatchObject({ admitted: false, reason: 'stale', detail: expect.stringMatching(new RegExp(`^superseded:.*${v2.id}`)) });
  });

  it('an archived project’s project-scoped entries stop being supplied; wider ones are unaffected (FR-LRN-046)', async () => {
    const narrow = await version();
    const wide = await version({ scope: { kind: 'workspace', projectIds: [] } });
    world.projects.set('p1', { id: 'p1', status: 'archived', workspaceId: 'ws_a' });
    expect(await one(gate(), narrow, { projectId: 'p1' })).toMatchObject({ admitted: false, reason: 'boundary', detail: expect.stringMatching(/^archived:/) });
    expect(await one(gate(), wide, { projectId: 'p2' })).toMatchObject({ admitted: true });
  });

  it('an Expert declaring none → permission, memory-policy: — every entry (FR-LRN-055, SC-LRN-009)', async () => {
    world.experts.set('exe_x', { expertId: 'expert_1', contractVersionId: 'ecv', contractVersion: 1, memoryPolicy: 'none' });
    const v = await version();
    expect(await one(gate(), v, { projectId: 'p1', executionId: 'exe_x' })).toMatchObject({ admitted: false, reason: 'permission', detail: expect.stringMatching(/^memory-policy:/) });
  });

  it('an Expert declaring governed-knowledge is admitted', async () => {
    world.experts.set('exe_y', { expertId: 'expert_1', contractVersionId: 'ecv', contractVersion: 2, memoryPolicy: 'governed-knowledge' });
    expect(await one(gate(), await version(), { projectId: 'p1', executionId: 'exe_y' })).toMatchObject({ admitted: true });
  });

  it('ExpertProvenance unbound excludes knowledge from any execution’s package — it may be an Expert’s (R-048-10)', async () => {
    const v = await version();
    const ports = { ...world.ports, experts: refusingPorts().experts };
    expect(await one(gate(ports), v, { projectId: 'p1', executionId: 'exe_1' })).toMatchObject({ admitted: false, reason: 'permission', detail: expect.stringMatching(/^memory-policy:.*ExpertProvenance/) });
    expect(await one(gate(ports), v, { projectId: 'p1' })).toMatchObject({ admitted: true });
  });

  it('a version that is not of the named entry is not admitted', async () => {
    const v = await version();
    expect(await one(gate(), { entryId: 'ke_other', versionId: v.versionId }, { projectId: 'p1' })).toMatchObject({ admitted: false, reason: 'boundary' });
  });
});

describe('T2372 · one batched read (R-048-22)', () => {
  it('200 candidates, one store read, verdicts in order', async () => {
    const vs = [];
    for (let i = 0; i < 200; i += 1) vs.push(await version({ scope: i % 2 === 0 ? { kind: 'project', projectIds: ['p1'] } : { kind: 'workspace', projectIds: [] } }));
    reads = 0;
    const t0 = performance.now();
    const verdicts = await gate().admit(vs.map((v) => ({ sourceId: v.entryId, sourceVersion: v.versionId })), { workspaceId: 'ws_a', projectId: 'p2' });
    const ms = performance.now() - t0;
    expect(reads).toBe(1);
    expect(verdicts).toHaveLength(200);
    expect(verdicts.map((v) => v.admitted)).toEqual(vs.map((_, i) => i % 2 === 1));
    expect(ms).toBeLessThan(250);
  });
});

describe('T2333 · KnowledgeReader — what EPIC-038 reads for knowledge-entry', () => {
  it('current version, text with no project partition, and status', async () => {
    const v = await version();
    const reader = new KnowledgeReader(store);
    expect(await reader.currentVersion('ws_a', v.entryId)).toEqual({ resolves: true, version: v.versionId });
    expect(await reader.read('ws_a', v.entryId, v.versionId)).toEqual({ text: 'Integration tests need the local database started first.', projectId: null });
    expect(await reader.status('ws_a', v.entryId, v.versionId)).toEqual({ status: 'current' });
    expect(await reader.currentVersion('ws_b', v.entryId)).toMatchObject({ resolves: false });
    expect(await reader.read('ws_b', v.entryId, v.versionId)).toBeNull();
  });
});
