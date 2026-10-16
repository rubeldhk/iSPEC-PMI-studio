/**
 * `T2352` (EPIC-048, `FR-LRN-031`, `-032`, `-038`, `-062`; `R-048-4`, `R-048-6`;
 * `MP-1b`'s target) — the only knowledge write, and what each resolution does.
 *
 * - A version is written **only** on a resolution the approver guard accepts.
 * - Version + `current` status + `approved` transition commit together.
 * - Review terms win when they exist; otherwise the proposed statement and
 *   claimed scope. Both the proposed and approved forms are kept (`FR-LRN-028`).
 * - Classification: the terms', else the category default, else `undetermined`.
 * - A supersession marks the predecessor `superseded`, naming the successor, in
 *   the same transaction. A deprecation writes `deprecated` and no version.
 * - Every materialisation, supersession, deprecation and scope change is audited
 *   through `Audit`; `Audit` unbound refuses and writes nothing.
 * - **I1**: a refused resolution returns the candidate to `proposed` with the
 *   reason, a flag and an audit record — never left `pending-review` with a
 *   decision `EPIC-031` has already closed.
 * - A closure (`A-031-1`) is `rejected`, `expired` or `withdrawn` accordingly.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApproverGuard } from '../../src/modules/learning/approver.guard.js';
import { InMemoryKnowledgeWriter } from '../../src/modules/learning/knowledge.writer.js';
import { InMemoryLearningStore, type CandidateRecord, type CorroborationRecord } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { Materialiser } from '../../src/modules/learning/materialiser.js';
import { refusingPorts, type ResolutionView } from '../../src/modules/learning/learning.tokens.js';
import { candidateRecord, citationFor } from '../helpers/learning-fixtures.js';
import { learningWorld, POLICY, type LearningTestWorld } from '../helpers/learning-ports.js';

let world: LearningTestWorld;
let store: InMemoryLearningStore;

function materialiser(ports = world.ports): Materialiser {
  return new Materialiser({
    store,
    writer: new InMemoryKnowledgeWriter(store, ports.audit),
    ports,
    policy: new LearningPolicyReader(ports.policy),
    guard: new ApproverGuard(ports.principals),
  });
}

async function pending(over: Partial<CandidateRecord> = {}, decisionId = 'dec_1'): Promise<CandidateRecord> {
  const c = candidateRecord(over);
  await store.transaction(async (tx) => {
    await tx.insertCandidate(c, [citationFor(c)], { workspaceId: c.workspaceId, candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() });
    await tx.appendTransition({ workspaceId: c.workspaceId, candidateId: c.id, state: 'pending-review', reason: null, decisionId, actorKind: 'platform', actorId: 'learning-intake', at: new Date() });
  });
  return c;
}

function approvedBy(id: string, over: Partial<ResolutionView> = {}): ResolutionView {
  return {
    decisionId: 'dec_1',
    resolvingDecisionId: 'dec_1_r',
    outcome: 'approved',
    actorKind: 'human',
    decidedBy: id,
    actionType: 'learning.review.candidate',
    requestedBy: 'agent_1',
    effectiveClass: 'high',
    explanation: { policyVersion: '3', matchedRule: 'rule:x', riskClass: 'high', authorityApplied: 'steering' },
    ...over,
  };
}

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
});

describe('T2352 · only an accepted resolution writes knowledge', () => {
  it('an accepted human approval writes version, current status and approved transition together', async () => {
    const c = await pending();
    const out = await materialiser().applyResolution('ws_a', c.id, approvedBy('u_h'));
    expect(out).toMatchObject({ state: 'approved', version: 1 });
    const v = await store.versionForCandidate('ws_a', c.id);
    expect(v).toMatchObject({ approvedByKind: 'human', approvedBy: 'u_h', decisionId: 'dec_1', resolvingDecisionId: 'dec_1_r', version: 1 });
    expect((await store.currentStatus('ws_a', v!.id))?.status).toBe('current');
    expect(await store.currentTransition('ws_a', c.id)).toMatchObject({ state: 'approved', decisionId: 'dec_1', actorKind: 'human', actorId: 'u_h' });
  });

  it('an accepted policy approval records approvedByKind policy', async () => {
    const c = await pending({ category: 'test-setup' });
    await materialiser().applyResolution('ws_a', c.id, approvedBy('learning-intake', { outcome: 'auto-executed', actorKind: 'automation', actionType: 'learning.approve.test-setup', resolvingDecisionId: null }));
    expect(await store.versionForCandidate('ws_a', c.id)).toMatchObject({ approvedByKind: 'policy', approvedBy: 'policy:v3', resolvingDecisionId: null });
    expect((await store.currentTransition('ws_a', c.id))?.actorKind).toBe('policy');
  });

  it('a pending decision writes nothing', async () => {
    const c = await pending();
    const out = await materialiser().applyResolution('ws_a', c.id, null);
    expect(out.state).toBe('pending-review');
    expect(await store.versionForCandidate('ws_a', c.id)).toBeNull();
  });

  it('an unaccepted approval writes nothing (MP-1b)', async () => {
    const c = await pending();
    await materialiser().applyResolution('ws_a', c.id, approvedBy('agent_1'));
    expect(await store.versionForCandidate('ws_a', c.id)).toBeNull();
    expect(await store.currentVersions('ws_a')).toEqual([]);
  });
});

describe('T2352 · I1 — a refused resolution returns the candidate to proposed', () => {
  it('with the reason, the refused decision, a flag and an audit record', async () => {
    world.principals.set('agent_9', 'agent');
    const c = await pending();
    const out = await materialiser().applyResolution('ws_a', c.id, approvedBy('agent_9'));
    expect(out).toMatchObject({ state: 'proposed', reason: 'decision-not-accepted' });
    expect(await store.currentTransition('ws_a', c.id)).toMatchObject({ state: 'proposed', reason: 'decision-not-accepted', decisionId: 'dec_1', actorKind: 'platform' });
    const flags = await store.flags('ws_a', { candidateId: c.id });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ kind: 'decision-not-accepted' });
    expect(flags[0]!.detail).toMatch(/agent_9/);
    expect(world.audit.at(-1)).toMatchObject({ targetType: 'learning_candidate', targetId: c.id, outcome: 'refused' });
  });

  it('policy-auto-executed-review is its own reason (RK-5)', async () => {
    const c = await pending();
    const out = await materialiser().applyResolution('ws_a', c.id, approvedBy('learning-intake', { outcome: 'auto-executed', actorKind: 'automation', actionType: 'learning.review.candidate' }));
    expect(out.reason).toBe('policy-auto-executed-review');
    expect((await store.flags('ws_a', { candidateId: c.id }))[0]!.kind).toBe('policy-auto-executed-review');
  });
});

describe('T2352 · terms, forms and classification (FR-LRN-028, FR-LRN-038)', () => {
  it('without terms: the proposed statement, the claimed scope, the category default classification', async () => {
    const c = await pending({ category: 'architecture' });
    await materialiser().applyResolution('ws_a', c.id, approvedBy('u_h'));
    expect(await store.versionForCandidate('ws_a', c.id)).toMatchObject({
      statement: c.statement, proposedStatement: c.statement, scope: c.claimedScope, proposedScope: c.claimedScope, classification: 'internal',
    });
  });

  it('with terms: the approved statement and the narrowed scope, both forms kept', async () => {
    const c = await pending({ claimedScope: { kind: 'projects', projectIds: ['p1', 'p2'] } });
    await store.transaction((tx) =>
      tx.insertReviewTerms({ id: 'lrt_1', workspaceId: 'ws_a', candidateId: c.id, decisionId: 'dec_1', approvedStatement: 'Edited by the reviewer.', approvedScope: { kind: 'project', projectIds: ['p1'] }, classification: 'restricted', reviewerId: 'u_h', at: new Date() }),
    );
    await materialiser().applyResolution('ws_a', c.id, approvedBy('u_h'));
    expect(await store.versionForCandidate('ws_a', c.id)).toMatchObject({
      statement: 'Edited by the reviewer.',
      proposedStatement: c.statement,
      scope: { kind: 'project', projectIds: ['p1'] },
      proposedScope: { kind: 'projects', projectIds: ['p1', 'p2'] },
      classification: 'restricted',
    });
  });

  it('no default anywhere → undetermined, a value and not a null (FR-LRN-044)', async () => {
    world.policyDocs.set('ws_a', { content: JSON.stringify({ ...POLICY, categories: [{ key: 'architecture', description: 'x' }] }), version: 2, actorId: 'u' });
    const c = await pending({ category: 'architecture' });
    await materialiser().applyResolution('ws_a', c.id, approvedBy('u_h'));
    expect((await store.versionForCandidate('ws_a', c.id))?.classification).toBe('undetermined');
  });
});

describe('T2352 · supersession, deprecation, widening (FR-LRN-031, -032, -033, -042)', () => {
  async function approvedV1(): Promise<{ versionId: string; entryId: string }> {
    const c = await pending({ subjectKey: 'architecture:fact' });
    const out = await materialiser().applyResolution('ws_a', c.id, approvedBy('u_h'));
    return { versionId: out.versionId!, entryId: out.entryId! };
  }

  it('a supersession writes v2 and marks v1 superseded naming v2 — v1 itself unchanged', async () => {
    const { versionId, entryId } = await approvedV1();
    const before = await store.version('ws_a', versionId);
    const c2 = await pending({ subjectKey: 'architecture:fact', kind: 'supersede', targetVersionId: versionId, statement: 'The newer fact.', idempotencyKey: 'k2' }, 'dec_2');
    const out = await materialiser().applyResolution('ws_a', c2.id, approvedBy('u_h', { decisionId: 'dec_2', resolvingDecisionId: 'dec_2_r', actionType: 'learning.review.supersede' }));
    expect(out).toMatchObject({ state: 'approved', entryId, version: 2 });
    expect(await store.currentStatus('ws_a', versionId)).toMatchObject({ status: 'superseded', successorVersionId: out.versionId });
    expect(await store.version('ws_a', versionId)).toEqual(before);
  });

  it('a deprecation writes deprecated with reason, actor, instant — and no version', async () => {
    const { versionId } = await approvedV1();
    const c2 = await pending({ subjectKey: 'architecture:fact', kind: 'deprecate', targetVersionId: versionId, statement: 'No longer true since the migration.', idempotencyKey: 'k3' }, 'dec_3');
    const out = await materialiser().applyResolution('ws_a', c2.id, approvedBy('u_h2', { decisionId: 'dec_3', actionType: 'learning.review.deprecate' }));
    expect(out.state).toBe('approved');
    expect(await store.versionForCandidate('ws_a', c2.id)).toBeNull();
    expect(await store.currentStatus('ws_a', versionId)).toMatchObject({ status: 'deprecated', reason: 'No longer true since the migration.', actorId: 'u_h2', decisionId: 'dec_3', candidateId: c2.id });
  });

  it('a widening writes a new version with the wider scope and supersedes the old', async () => {
    const { versionId } = await approvedV1();
    const c2 = await pending({ subjectKey: 'architecture:fact', kind: 'widen-scope', targetVersionId: versionId, claimedScope: { kind: 'workspace', projectIds: [] }, statement: 'Useful everywhere.', idempotencyKey: 'k4' }, 'dec_4');
    const out = await materialiser().applyResolution('ws_a', c2.id, approvedBy('u_h', { decisionId: 'dec_4', actionType: 'learning.review.widen-scope' }));
    const v2 = await store.version('ws_a', out.versionId!);
    expect(v2).toMatchObject({ scope: { kind: 'workspace', projectIds: [] }, version: 2 });
    // The statement is the entry's, not the widening request's rationale.
    expect(v2?.statement).toBe((await store.version('ws_a', versionId))?.statement);
    expect((await store.currentStatus('ws_a', versionId))?.status).toBe('superseded');
  });
});

describe('T2352 · audit (FR-LRN-062)', () => {
  it('every materialisation, supersession and deprecation is audited', async () => {
    const c = await pending({ subjectKey: 'architecture:audited' });
    const out = await materialiser().applyResolution('ws_a', c.id, approvedBy('u_h'));
    expect(world.audit.some((a) => a.targetId === out.versionId && a.action === 'create' && a.outcome === 'success')).toBe(true);
    const c2 = await pending({ subjectKey: 'architecture:audited', kind: 'supersede', targetVersionId: out.versionId!, idempotencyKey: 'k5' }, 'dec_5');
    const out2 = await materialiser().applyResolution('ws_a', c2.id, approvedBy('u_h', { decisionId: 'dec_5' }));
    expect(world.audit.some((a) => a.targetId === out.versionId && a.action === 'update' && a.detail?.['change'] === 'superseded')).toBe(true);
    expect(world.audit.some((a) => a.targetId === out2.versionId && a.detail?.['change'] === 'materialised')).toBe(true);
  });

  it('Audit unbound refuses — nothing is written', async () => {
    const c = await pending();
    const ports = { ...world.ports, audit: refusingPorts().audit };
    await expect(materialiser(ports).applyResolution('ws_a', c.id, approvedBy('u_h'))).rejects.toThrow(/Audit/);
    expect(await store.versionForCandidate('ws_a', c.id)).toBeNull();
    expect((await store.currentTransition('ws_a', c.id))?.state).toBe('pending-review');
  });
});

describe('T2352 · closures (A-031-1)', () => {
  it.each([
    ['rejected', 'human', 'Wrong for this repository.'],
    ['expired', 'platform', 'review window of 30 days elapsed'],
    ['withdrawn', 'platform', 'withdrawn by the submitter'],
  ] as const)('%s', async (kind, actorKind, reason) => {
    const c = await pending();
    const by = kind === 'rejected' ? 'u_h' : 'learning-intake';
    await materialiser().applyResolution('ws_a', c.id, approvedBy(by, { outcome: 'refused', actorKind: kind === 'rejected' ? 'human' : 'automation', closure: { kind, reason } }));
    expect(await store.currentTransition('ws_a', c.id)).toMatchObject({ state: kind, reason, actorKind });
  });

  it('a refusal with no closure (by policy) returns the candidate to proposed', async () => {
    const c = await pending();
    await materialiser().applyResolution('ws_a', c.id, approvedBy('learning-intake', { outcome: 'refused', actorKind: 'automation' }));
    expect(await store.currentTransition('ws_a', c.id)).toMatchObject({ state: 'proposed', reason: 'decision-refused-by-policy' });
  });

  it('an already-terminal candidate is left as it is', async () => {
    const c = await pending();
    await materialiser().applyResolution('ws_a', c.id, approvedBy('u_h'));
    const again = await materialiser().applyResolution('ws_a', c.id, approvedBy('u_h'));
    expect(again.state).toBe('approved');
    expect((await store.transitions('ws_a', c.id)).filter((t) => t.state === 'approved')).toHaveLength(1);
  });
});

describe('T2352 · corroborating agents are AI sources too', () => {
  it('an approval by a corroborating agent writes nothing', async () => {
    const c = await pending();
    const co: CorroborationRecord = { id: 'co_1', workspaceId: 'ws_a', candidateId: c.id, sourceKind: 'execution', executionId: 'exe_2', sourcePrincipalId: 'u_h2', expertId: null, expertContractVersionId: null, statement: 's', confidenceLevel: 'low', confidenceBasis: 'b', late: false, idempotencyKey: 'co_k', correlationId: 'c', submittedAt: new Date(), objectDigest: null };
    await store.transaction((tx) => tx.insertCorroboration(co, [citationFor(c, { corroborationId: 'co_1' })]));
    await materialiser().applyResolution('ws_a', c.id, approvedBy('u_h2'));
    expect(await store.versionForCandidate('ws_a', c.id)).toBeNull();
  });
});
