/**
 * `T2374` (EPIC-048, US5-5, `FR-LRN-042`) — scope widens only by a decision a
 * human takes on a `widen-scope` candidate. No other path widens it.
 *
 * - a `widen-scope` candidate must claim a scope strictly wider than the current
 *   version's;
 * - it always takes human review (`learning.review.widen-scope`);
 * - approved, it writes a new version with the wider scope and supersedes the old;
 * - a `supersede` candidate may not smuggle a wider scope in, and a reviewer's
 *   terms may only narrow — so no other path changes scope outward.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { ApproverGuard } from '../../src/modules/learning/approver.guard.js';
import { DecisionRequester } from '../../src/modules/learning/decision.requester.js';
import { InMemoryKnowledgeWriter } from '../../src/modules/learning/knowledge.writer.js';
import { InMemoryLearningStore } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { Materialiser } from '../../src/modules/learning/materialiser.js';
import { ReviewService } from '../../src/modules/learning/review.service.js';
import { SubmissionService, type SubmissionActor } from '../../src/modules/learning/submission.service.js';
import { learningWorld, submission, type LearningTestWorld } from '../helpers/learning-ports.js';

const AGENT: SubmissionActor = { kind: 'agent', workspaceId: 'ws_a', principalId: 'agent_1', projectId: 'p1' };
const workspace = { kind: 'workspace', projectIds: [] } as const;

let world: LearningTestWorld;
let store: InMemoryLearningStore;
let materialiser: Materialiser;
let submissions: SubmissionService;
let reviews: ReviewService;

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
  const policy = new LearningPolicyReader(world.ports.policy);
  materialiser = new Materialiser({ store, writer: new InMemoryKnowledgeWriter(store, world.ports.audit), ports: world.ports, policy, guard: new ApproverGuard(world.ports.principals) });
  const requester = new DecisionRequester({ store, ports: world.ports, policy, applyResolution: (c, r) => materialiser.applyResolution(c.workspaceId, c.id, r) });
  submissions = new SubmissionService({ store, ports: world.ports, policy, requestDecision: (c) => requester.request(c) });
  reviews = new ReviewService({ store, ports: world.ports, policy, materialiser });
});

async function v1(): Promise<{ versionId: string; entryId: string }> {
  const out = await submissions.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: 'widening' }) });
  const applied = await reviews.review('ws_a', 'u_h', out.body.candidateId, { decision: 'approve' });
  return { versionId: applied.versionId!, entryId: applied.entryId! };
}

describe('T2374 · widen-scope must be strictly wider', () => {
  it.each([
    ['the same scope', { kind: 'project', projectIds: ['p1'] }],
    ['a narrower-or-other project', { kind: 'project', projectIds: ['p2'] }],
  ])('%s is refused 400', async (_name, claimedScope) => {
    const { versionId } = await v1();
    await expect(submissions.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: 'widening', kind: 'widen-scope', targetVersionId: versionId, claimedScope }) })).rejects.toBeInstanceOf(ValidationFailedError);
  });
});

describe('T2374 · it always takes human review, and approved it supersedes', () => {
  it('asks learning.review.widen-scope even in a low-risk category; approved, v2 holds the wider scope and v1 is superseded', async () => {
    const { versionId, entryId } = await v1();
    world.decisions.next = 'auto-executed';
    const out = await submissions.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: 'widening', category: 'test-setup', kind: 'widen-scope', targetVersionId: versionId, claimedScope: workspace, statement: 'Useful in every project.' }) });
    world.decisions.next = 'pending';
    expect(world.decisions.requests.at(-1)!.actionType).toBe('learning.review.widen-scope');
    expect(out.body.state).toBe('proposed'); // an auto-executed review is not accepted (RK-5)

    const again = await submissions.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: 'widening other', kind: 'widen-scope', targetVersionId: versionId, claimedScope: workspace, statement: 'Useful in every project.' }) });
    const applied = await reviews.review('ws_a', 'u_h2', again.body.candidateId, { decision: 'approve' });
    expect(await store.version('ws_a', applied.versionId!)).toMatchObject({ entryId, version: 2, scope: workspace, proposedScope: workspace });
    expect(await store.currentStatus('ws_a', versionId)).toMatchObject({ status: 'superseded', successorVersionId: applied.versionId });
  });
});

describe('T2374 · no other path widens scope (FR-LRN-042)', () => {
  it('a supersede candidate claiming a wider scope than the current version is refused, naming widen-scope', async () => {
    const { versionId } = await v1();
    await expect(submissions.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: 'widening', kind: 'supersede', targetVersionId: versionId, claimedScope: workspace }) })).rejects.toThrow(/widen-scope/);
  });

  it('a supersede candidate keeping or narrowing the scope is accepted', async () => {
    const { versionId } = await v1();
    await expect(submissions.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: 'widening', kind: 'supersede', targetVersionId: versionId }) })).resolves.toMatchObject({ status: 201 });
  });

  it('a reviewer cannot widen through the terms of an approval', async () => {
    const out = await submissions.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: 'terms' }) });
    await expect(reviews.review('ws_a', 'u_h', out.body.candidateId, { decision: 'approve', scope: workspace })).rejects.toBeInstanceOf(ValidationFailedError);
  });
});
