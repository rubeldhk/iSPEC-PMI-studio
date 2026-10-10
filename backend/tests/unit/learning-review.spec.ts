/**
 * `T2354` (EPIC-048, `FR-LRN-027`, `FR-LRN-028`, `FR-LRN-029`; `R-048-6` layer 1)
 * — a person decides a candidate through this Epic's review route.
 *
 * - approve writes the reviewer's terms **before** calling `approve`, so a crash
 *   between the two loses nothing;
 * - the approved scope is ⊆ the claimed scope (`400`) — narrowed, never widened;
 * - reject requires a reason and calls `refuse` (`A-031-1`);
 * - a non-human principal, or one of the candidate's AI source identities, is
 *   refused `403` and audited, and the decision stays pending;
 * - a human submitter's self-approval follows `EPIC-031`'s refusal.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, GovernanceSeamUnboundError, ValidationFailedError } from '../../src/core/errors.js';
import { ApproverGuard } from '../../src/modules/learning/approver.guard.js';
import { InMemoryKnowledgeWriter } from '../../src/modules/learning/knowledge.writer.js';
import { InMemoryLearningStore, type CandidateRecord } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { refusingPorts } from '../../src/modules/learning/learning.tokens.js';
import { Materialiser } from '../../src/modules/learning/materialiser.js';
import { ReviewService } from '../../src/modules/learning/review.service.js';
import { candidateRecord, citationFor } from '../helpers/learning-fixtures.js';
import { learningWorld, type LearningTestWorld } from '../helpers/learning-ports.js';

let world: LearningTestWorld;
let store: InMemoryLearningStore;

function review(ports = world.ports): ReviewService {
  const policy = new LearningPolicyReader(ports.policy);
  const materialiser = new Materialiser({ store, writer: new InMemoryKnowledgeWriter(store, ports.audit), ports, policy, guard: new ApproverGuard(ports.principals) });
  return new ReviewService({ store, ports, policy, materialiser });
}

/** A candidate pending review, its decision requested through the recorder. */
async function pending(over: Partial<CandidateRecord> = {}): Promise<CandidateRecord> {
  const c = candidateRecord({ category: 'architecture', ...over });
  const d = await world.decisions.decide({
    workspaceId: 'ws_a', projectId: c.projectId, actionType: 'learning.review.candidate', target: { type: 'learning-candidate', id: c.id }, objectVersion: c.objectDigest,
    actor: { kind: 'automation', id: 'learning-intake' }, requiredGates: [], requestedBy: c.sourcePrincipalId, triggeredBy: { ruleId: 'learning.candidate-submitted', eventId: c.id },
  });
  await store.transaction(async (tx) => {
    await tx.insertCandidate(c, [citationFor(c)], { workspaceId: 'ws_a', candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() });
    await tx.appendTransition({ workspaceId: 'ws_a', candidateId: c.id, state: 'pending-review', reason: null, decisionId: d.decisionId, actorKind: 'platform', actorId: 'learning-intake', at: new Date() });
  });
  return c;
}

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
});

describe('T2354 · approve', () => {
  it('writes the terms before calling approve, then materialises', async () => {
    const c = await pending({ claimedScope: { kind: 'projects', projectIds: ['p1', 'p2'] } });
    const seenAtApprove: unknown[] = [];
    const realApprove = world.decisions.approve.bind(world.decisions);
    world.ports.decisions = { ...world.ports.decisions, approve: async (input) => { seenAtApprove.push(await store.reviewTerms('ws_a', c.id, input.decisionId)); return realApprove(input); } };
    const out = await review().review('ws_a', 'u_h', c.id, { decision: 'approve', statement: 'Narrowed and edited.', scope: { kind: 'project', projectIds: ['p1'] }, classification: 'restricted' });
    expect(seenAtApprove[0]).toMatchObject({ approvedStatement: 'Narrowed and edited.', approvedScope: { kind: 'project', projectIds: ['p1'] }, classification: 'restricted', reviewerId: 'u_h' });
    expect(out).toMatchObject({ state: 'approved', version: 1 });
    expect(await store.versionForCandidate('ws_a', c.id)).toMatchObject({ statement: 'Narrowed and edited.', proposedStatement: c.statement, scope: { kind: 'project', projectIds: ['p1'] } });
  });

  it('approves as is when no terms are edited', async () => {
    const c = await pending();
    await review().review('ws_a', 'u_h', c.id, { decision: 'approve' });
    expect(await store.versionForCandidate('ws_a', c.id)).toMatchObject({ statement: c.statement, scope: c.claimedScope, approvedBy: 'u_h' });
  });

  it('refuses a scope wider than claimed — 400, nothing written, nothing approved', async () => {
    const c = await pending();
    await expect(review().review('ws_a', 'u_h', c.id, { decision: 'approve', scope: { kind: 'workspace', projectIds: [] } })).rejects.toBeInstanceOf(ValidationFailedError);
    expect(world.decisions.approvals).toEqual([]);
    expect(await store.reviewTerms('ws_a', c.id, 'dec_1')).toBeNull();
  });

  it('refuses a malformed scope or an empty statement — 400', async () => {
    const c = await pending();
    await expect(review().review('ws_a', 'u_h', c.id, { decision: 'approve', scope: { kind: 'galaxy' } })).rejects.toBeInstanceOf(ValidationFailedError);
    await expect(review().review('ws_a', 'u_h', c.id, { decision: 'approve', statement: '   ' })).rejects.toBeInstanceOf(ValidationFailedError);
  });
});

describe('T2354 · reject (FR-LRN-029)', () => {
  it('requires a reason', async () => {
    const c = await pending();
    await expect(review().review('ws_a', 'u_h', c.id, { decision: 'reject' })).rejects.toThrow(/reason/);
    expect(world.decisions.refusals).toEqual([]);
  });

  it('calls refuse as a human rejection with the reason, and records rejected', async () => {
    const c = await pending();
    const out = await review().review('ws_a', 'u_h', c.id, { decision: 'reject', reason: 'Not true for this repository.' });
    expect(world.decisions.refusals[0]).toMatchObject({ by: { kind: 'human', id: 'u_h' }, kind: 'rejected', reason: 'Not true for this repository.' });
    expect(out.state).toBe('rejected');
    expect(await store.currentTransition('ws_a', c.id)).toMatchObject({ state: 'rejected', actorId: 'u_h', reason: 'Not true for this repository.' });
    expect(await store.candidate('ws_a', c.id)).not.toBeNull();
  });
});

describe('T2354 · who may decide (FR-LRN-027, R-048-6 layer 1)', () => {
  it.each([
    ['an agent principal', 'agent_9', 'agent'],
    ['a service principal', 'svc_1', 'service'],
  ] as const)('%s is refused 403, audited, and the decision stays pending', async (_name, id, kind) => {
    world.principals.set(id, kind);
    const c = await pending();
    await expect(review().review('ws_a', id, c.id, { decision: 'approve' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(world.decisions.approvals).toEqual([]);
    expect(world.audit.at(-1)).toMatchObject({ action: 'access_refused', outcome: 'refused', targetId: c.id });
    expect((await store.currentTransition('ws_a', c.id))?.state).toBe('pending-review');
  });

  it('the candidate’s own agent — even if recorded as a user — is refused 403', async () => {
    world.principals.set('agent_1', 'human');
    const c = await pending();
    await expect(review().review('ws_a', 'agent_1', c.id, { decision: 'reject', reason: 'x' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(world.decisions.refusals).toEqual([]);
  });

  it('a human submitter’s self-approval follows EPIC-031’s refusal', async () => {
    const c = await pending({ sourceKind: 'person', executionId: null, sourcePrincipalId: 'u_sub' });
    await expect(review().review('ws_a', 'u_sub', c.id, { decision: 'approve' })).rejects.toThrow(/Self-approval/);
    expect(await store.versionForCandidate('ws_a', c.id)).toBeNull();
  });

  it('Principals unbound refuses review 503', async () => {
    const c = await pending();
    await expect(review({ ...world.ports, principals: refusingPorts().principals }).review('ws_a', 'u_h', c.id, { decision: 'approve' })).rejects.toBeInstanceOf(GovernanceSeamUnboundError);
  });

  it('LearningDecisions unbound refuses 503 — nothing approved', async () => {
    const c = await pending();
    await expect(review({ ...world.ports, decisions: refusingPorts().decisions }).review('ws_a', 'u_h', c.id, { decision: 'approve' })).rejects.toBeInstanceOf(GovernanceSeamUnboundError);
    expect(await store.versionForCandidate('ws_a', c.id)).toBeNull();
  });
});

describe('T2354 · state', () => {
  it('a candidate not pending review is 409', async () => {
    const c = await pending();
    await review().review('ws_a', 'u_h', c.id, { decision: 'reject', reason: 'no' });
    await expect(review().review('ws_a', 'u_h', c.id, { decision: 'approve' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('another workspace’s candidate is 404', async () => {
    const c = await pending();
    await expect(review().review('ws_b', 'u_h', c.id, { decision: 'approve' })).rejects.toMatchObject({ code: 'not_found' });
  });

  it('a decision that is neither approve nor reject is 400', async () => {
    const c = await pending();
    await expect(review().review('ws_a', 'u_h', c.id, { decision: 'maybe' })).rejects.toBeInstanceOf(ValidationFailedError);
  });
});
