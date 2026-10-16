/**
 * `T2366` (EPIC-048, US4, `FR-LRN-035`, `FR-LRN-039`, `FR-LRN-073`, `SC-LRN-006`)
 * — approved knowledge, readable: browse, one entry's provenance, its history.
 *
 * - history lists every version, the candidate and decision behind each, every
 *   status event and flag — in order;
 * - browse filters by project, scope, category and status;
 * - provenance answers *where did this come from, who approved it, and what does
 *   it replace?* from the record alone;
 * - nothing is deleted: superseded and deprecated versions, and cleared flags,
 *   stay in the history.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/core/errors.js';
import { ApproverGuard } from '../../src/modules/learning/approver.guard.js';
import { DecisionRequester } from '../../src/modules/learning/decision.requester.js';
import { InMemoryKnowledgeWriter } from '../../src/modules/learning/knowledge.writer.js';
import { KnowledgeService } from '../../src/modules/learning/knowledge.service.js';
import { EvidenceView } from '../../src/modules/learning/evidence.view.js';
import { InMemoryLearningStore } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { Materialiser } from '../../src/modules/learning/materialiser.js';
import { SubmissionService, type SubmissionActor } from '../../src/modules/learning/submission.service.js';
import { learningWorld, submission, type LearningTestWorld } from '../helpers/learning-ports.js';

const AGENT: SubmissionActor = { kind: 'agent', workspaceId: 'ws_a', principalId: 'agent_1', projectId: 'p1' };
const PERSON: SubmissionActor = { kind: 'person', workspaceId: 'ws_a', userId: 'u_sub' };
const READER = { workspaceId: 'ws_a', userId: 'u_reader' };

let world: LearningTestWorld;
let store: InMemoryLearningStore;
let materialiser: Materialiser;
let submissions: SubmissionService;
let knowledge: KnowledgeService;

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
  const policy = new LearningPolicyReader(world.ports.policy);
  materialiser = new Materialiser({ store, writer: new InMemoryKnowledgeWriter(store, world.ports.audit), ports: world.ports, policy, guard: new ApproverGuard(world.ports.principals) });
  const requester = new DecisionRequester({ store, ports: world.ports, policy });
  submissions = new SubmissionService({ store, ports: world.ports, policy, requestDecision: (c) => requester.request(c) });
  knowledge = new KnowledgeService({ reads: store, evidence: new EvidenceView(world.ports) });
});

async function approved(over: Record<string, unknown>, actor: SubmissionActor = AGENT, approver = 'u_h'): Promise<{ candidateId: string; versionId: string; entryId: string }> {
  const body = actor.kind === 'person' ? (({ executionId: _x, ...rest }) => rest)(submission(over)) : submission(over);
  const out = await submissions.submit({ actor, projectId: 'p1', body });
  const resolution = world.decisions.resolveAs(out.body.decisionId!, { outcome: 'approved', actorKind: 'human', decidedBy: approver });
  const applied = await materialiser.applyResolution('ws_a', out.body.candidateId, resolution);
  return { candidateId: out.body.candidateId, versionId: applied.versionId!, entryId: applied.entryId! };
}

describe('T2366 · history (FR-LRN-035)', () => {
  it('every version, with the candidate and decision behind it, and every status event, in order', async () => {
    const v1 = await approved({ subject: 'history' });
    const v2 = await approved({ subject: 'history', kind: 'supersede', targetVersionId: v1.versionId, statement: 'v2 statement' }, PERSON, 'u_h2');
    await approved({ subject: 'history', kind: 'deprecate', targetVersionId: v2.versionId, statement: 'No longer true.' });
    const h = await knowledge.history('ws_a', v1.entryId);
    expect(h.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(h.versions[0]).toMatchObject({ candidate: { id: v1.candidateId, sourceKind: 'execution', sourcePrincipalId: 'agent_1' }, decision: { approvedByKind: 'human', approvedBy: 'u_h' } });
    expect(h.versions[1]).toMatchObject({ candidate: { id: v2.candidateId, sourceKind: 'person', sourcePrincipalId: 'u_sub' }, decision: { approvedBy: 'u_h2' } });
    expect(h.versions[0]!.statusEvents.map((s) => s.status)).toEqual(['current', 'superseded']);
    expect(h.versions[1]!.statusEvents.map((s) => s.status)).toEqual(['current', 'deprecated']);
    expect(h.events.map((e) => e.type)).toEqual(['approved', 'current', 'approved', 'current', 'superseded', 'deprecated']);
    const times = h.events.map((e) => e.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('flags, raised and cleared, are part of it — nothing is deleted (FR-LRN-039)', async () => {
    const v1 = await approved({ subject: 'flagged' });
    await store.transaction(async (tx) => {
      await tx.appendFlag({ id: 'kf_1', workspaceId: 'ws_a', versionId: v1.versionId, candidateId: null, kind: 'evidence-changed', detail: 'ev_1 integrity-failed', raisedAt: new Date(), clearsFlagId: null });
      await tx.appendFlag({ id: 'kf_2', workspaceId: 'ws_a', versionId: v1.versionId, candidateId: null, kind: 'evidence-changed', detail: 'ev_1 verified again', raisedAt: new Date(Date.now() + 1), clearsFlagId: 'kf_1' });
    });
    const h = await knowledge.history('ws_a', v1.entryId);
    expect(h.versions[0]!.flags.map((f) => [f.id, f.open])).toEqual([['kf_1', false], ['kf_2', false]]);
    expect(h.events.filter((e) => e.type === 'flag')).toHaveLength(2);
  });

  it('another workspace’s entry is 404', async () => {
    const v1 = await approved({ subject: 'mine' });
    await expect(knowledge.history('ws_b', v1.entryId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(knowledge.entry('ws_b', v1.entryId, { workspaceId: 'ws_b', userId: 'u_b' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('T2366 · provenance from the record alone (SC-LRN-006)', () => {
  it('where it came from, who approved it, and what it replaces', async () => {
    world.experts.set('exe_1', { expertId: 'expert_1', contractVersionId: 'ecv_1', contractVersion: 2, memoryPolicy: 'governed-knowledge' });
    const v1 = await approved({ subject: 'provenance' });
    const v2 = await approved({ subject: 'provenance', kind: 'supersede', targetVersionId: v1.versionId, statement: 'Refined.' }, AGENT, 'u_h2');
    const e = await knowledge.entry('ws_a', v1.entryId, READER);
    expect(e.current).toMatchObject({ id: v2.versionId, version: 2, statement: 'Refined.' });
    expect(e.status).toBe('current');
    expect(e.provenance).toMatchObject({
      candidateId: v2.candidateId,
      source: { kind: 'execution', executionId: 'exe_1', principalId: 'agent_1', expert: { id: 'expert_1', contractVersion: 2 } },
      evidence: [{ evidenceId: 'ev_1' }],
      approvedByKind: 'human',
      approvedBy: 'u_h2',
      decisionId: expect.any(String),
      replaces: { versionId: v1.versionId, version: 1 },
    });
    expect(e.retrievability).toEqual({ outcome: 'not-yet-retrievable', reason: 'indexing not attempted' });
  });
});

describe('T2674 · the entry shows each reader only the evidence they may see (FR-LRN-016)', () => {
  it('a reader without access to the attested target sees a withheld item — no id, no digest — and a count', async () => {
    const v1 = await approved({ subject: 'withheld provenance' });
    world.readable.clear();
    const e = await knowledge.entry('ws_a', v1.entryId, READER);
    expect(e.provenance!.evidence).toEqual([{ state: 'withheld' }]);
    expect(e.provenance!.withheldEvidenceCount).toBe(1);
    expect(JSON.stringify(e.provenance)).not.toContain('ev_1');
  });

  it('a reader who may read it sees the id, the digest and its live state', async () => {
    const v1 = await approved({ subject: 'visible provenance' });
    const e = await knowledge.entry('ws_a', v1.entryId, READER);
    expect(e.provenance!.evidence).toEqual([expect.objectContaining({ evidenceId: 'ev_1', state: 'verified' })]);
    expect(e.provenance!.withheldEvidenceCount).toBe(0);
  });
});

describe('T2366 · browse (FR-LRN-073)', () => {
  it('filters by project, scope, category and status', async () => {
    const a = await approved({ subject: 'a', category: 'architecture' });
    await approved({ subject: 'b', category: 'test-setup', claimedScope: { kind: 'projects', projectIds: ['p1', 'p2'] } });
    await approved({ subject: 'a', kind: 'supersede', targetVersionId: a.versionId, statement: 'a2' });

    const all = await knowledge.browse('ws_a', {});
    expect(all.items).toHaveLength(3);
    expect((await knowledge.browse('ws_a', { category: 'test-setup' })).items.map((i) => i.category)).toEqual(['test-setup']);
    expect((await knowledge.browse('ws_a', { status: 'superseded' })).items.map((i) => i.versionId)).toEqual([a.versionId]);
    expect((await knowledge.browse('ws_a', { projectId: 'p2' })).items.map((i) => i.scope.kind)).toEqual(['projects']);
    expect((await knowledge.browse('ws_a', { scopeKind: 'project', status: 'current' })).items).toHaveLength(1);
    expect((await knowledge.browse('ws_b', {})).items).toEqual([]);
  });

  it('each row carries status, retrievability and open flags', async () => {
    const v = await approved({ subject: 'row' });
    await store.transaction((tx) => tx.appendFlag({ id: 'kf_open', workspaceId: 'ws_a', versionId: v.versionId, candidateId: null, kind: 'source-invalid', detail: 'validation-failed', raisedAt: new Date(), clearsFlagId: null }));
    const row = (await knowledge.browse('ws_a', {})).items.find((i) => i.versionId === v.versionId)!;
    expect(row).toMatchObject({ status: 'current', retrievability: { outcome: 'not-yet-retrievable' }, openFlags: ['source-invalid'] });
  });

  it('refuses an unknown status or scope filter rather than ignoring it', async () => {
    await expect(knowledge.browse('ws_a', { status: 'archived' as never })).rejects.toThrow(/status/);
    await expect(knowledge.browse('ws_a', { scopeKind: 'galaxy' as never })).rejects.toThrow(/scope/);
  });
});
