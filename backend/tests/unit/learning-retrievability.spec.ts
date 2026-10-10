/**
 * `T2376` (EPIC-048, `FR-LRN-051`, `FR-LRN-053`, `R-048-13`) — retrievability is
 * recorded from the reindex outcome, never assumed.
 *
 * - every approval, supersession, deprecation and widening calls
 *   `KnowledgeIndex.reindex` for `knowledge-entry`, entry id and version id;
 * - `indexed` / `current` → `retrievable`;
 * - a `503` (no embedding provider — the normal state today) or a `400` (no
 *   `knowledge-entry` source class) → `not-yet-retrievable` with the reason;
 * - no attempt reads *not yet retrievable — indexing not attempted*, never
 *   retrievable;
 * - `learning.retrievability` retries what is not yet retrievable.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApproverGuard } from '../../src/modules/learning/approver.guard.js';
import { DecisionRequester } from '../../src/modules/learning/decision.requester.js';
import { InMemoryKnowledgeWriter } from '../../src/modules/learning/knowledge.writer.js';
import { LearningJobs } from '../../src/modules/learning/learning.jobs.js';
import { InMemoryLearningStore } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { refusingPorts } from '../../src/modules/learning/learning.tokens.js';
import { Materialiser } from '../../src/modules/learning/materialiser.js';
import { RetrievabilityService } from '../../src/modules/learning/retrievability.js';
import { retrievabilityOf, ReviewService } from '../../src/modules/learning/review.service.js';
import { SubmissionService, type SubmissionActor } from '../../src/modules/learning/submission.service.js';
import { learningWorld, submission, type LearningTestWorld } from '../helpers/learning-ports.js';

const AGENT: SubmissionActor = { kind: 'agent', workspaceId: 'ws_a', principalId: 'agent_1', projectId: 'p1' };

let world: LearningTestWorld;
let store: InMemoryLearningStore;
let submissions: SubmissionService;
let reviews: ReviewService;
let jobs: LearningJobs;

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
  const policy = new LearningPolicyReader(world.ports.policy);
  const retrievability = new RetrievabilityService({ store, ports: world.ports });
  const materialiser = new Materialiser({
    store,
    writer: new InMemoryKnowledgeWriter(store, world.ports.audit),
    ports: world.ports,
    policy,
    guard: new ApproverGuard(world.ports.principals),
    after: [retrievability.afterMaterialise()],
  });
  const requester = new DecisionRequester({ store, ports: world.ports, policy, applyResolution: (c, r) => materialiser.applyResolution(c.workspaceId, c.id, r) });
  submissions = new SubmissionService({ store, ports: world.ports, policy, requestDecision: (c) => requester.request(c) });
  reviews = new ReviewService({ store, ports: world.ports, policy, materialiser });
  jobs = new LearningJobs({ store, ports: world.ports, materialiser, requester, retrievability });
});

async function approve(over: Record<string, unknown>, reviewer = 'u_h'): Promise<{ versionId: string; entryId: string; retrievability?: unknown }> {
  const out = await submissions.submit({ actor: AGENT, projectId: 'p1', body: submission(over) });
  const applied = await reviews.review('ws_a', reviewer, out.body.candidateId, { decision: 'approve' });
  return { versionId: applied.versionId!, entryId: applied.entryId!, retrievability: applied.retrievability };
}

describe('T2376 · every knowledge change asks for a reindex (FR-LRN-051)', () => {
  it('approval, supersession, widening and deprecation — knowledge-entry, entry id, version id', async () => {
    const v1 = await approve({ subject: 'reindexed' });
    const v2 = await approve({ subject: 'reindexed', kind: 'supersede', targetVersionId: v1.versionId, statement: 'v2' });
    const v3 = await approve({ subject: 'reindexed', kind: 'widen-scope', targetVersionId: v2.versionId, claimedScope: { kind: 'workspace', projectIds: [] } });
    await approve({ subject: 'reindexed', kind: 'deprecate', targetVersionId: v3.versionId, statement: 'stopped being true' });
    expect(world.reindexed).toEqual([
      { workspaceId: 'ws_a', sourceType: 'knowledge-entry', entryId: v1.entryId, versionId: v1.versionId },
      { workspaceId: 'ws_a', sourceType: 'knowledge-entry', entryId: v1.entryId, versionId: v2.versionId },
      { workspaceId: 'ws_a', sourceType: 'knowledge-entry', entryId: v1.entryId, versionId: v3.versionId },
      { workspaceId: 'ws_a', sourceType: 'knowledge-entry', entryId: v1.entryId, versionId: v3.versionId },
    ]);
  });
});

describe('T2376 · the outcome is recorded as it is (FR-LRN-053)', () => {
  it.each(['indexed', 'current'] as const)('%s → retrievable', async (outcome) => {
    world.indexOutcome = outcome;
    const v = await approve({ subject: `ok ${outcome}` });
    expect(await retrievabilityOf(store, 'ws_a', v.versionId)).toEqual({ outcome: 'retrievable', reason: null });
    expect(v.retrievability).toEqual({ outcome: 'retrievable', reason: null });
  });

  it('503 (no embedding provider) → not yet retrievable, naming it', async () => {
    world.indexOutcome = 'unbound';
    const v = await approve({ subject: 'no embedding' });
    expect(await retrievabilityOf(store, 'ws_a', v.versionId)).toMatchObject({ outcome: 'not-yet-retrievable', reason: expect.stringMatching(/EmbeddingPort/) });
  });

  it('400 (no knowledge-entry source class) → not yet retrievable, naming it', async () => {
    world.indexOutcome = 'bad-request';
    const v = await approve({ subject: 'no class' });
    expect(await retrievabilityOf(store, 'ws_a', v.versionId)).toMatchObject({ outcome: 'not-yet-retrievable', reason: expect.stringMatching(/source class/) });
  });

  it('KnowledgeIndex unbound → not yet retrievable — the approval stands', async () => {
    world.ports.index = refusingPorts().index;
    const v = await approve({ subject: 'unbound index' });
    expect(await store.version('ws_a', v.versionId)).not.toBeNull();
    expect(await retrievabilityOf(store, 'ws_a', v.versionId)).toMatchObject({ outcome: 'not-yet-retrievable', reason: expect.stringMatching(/KnowledgeIndex/) });
  });

  it('no attempt at all reads not yet retrievable — indexing not attempted; never retrievable', async () => {
    expect(await retrievabilityOf(store, 'ws_a', 'kv_never')).toEqual({ outcome: 'not-yet-retrievable', reason: 'indexing not attempted' });
  });

  it('a deprecated version is recorded not retrievable — admission is the guarantee it is never supplied', async () => {
    const v = await approve({ subject: 'gone' });
    world.indexOutcome = 'not-resolvable' as never;
    await approve({ subject: 'gone', kind: 'deprecate', targetVersionId: v.versionId, statement: 'no longer true' });
    expect(await retrievabilityOf(store, 'ws_a', v.versionId)).toMatchObject({ outcome: 'not-yet-retrievable', reason: expect.stringMatching(/deprecated/) });
  });
});

describe('T2376 · learning.retrievability retries', () => {
  it('a version not yet retrievable becomes retrievable once the index can take it', async () => {
    world.indexOutcome = 'unbound';
    const v = await approve({ subject: 'later' });
    world.indexOutcome = 'indexed';
    const report = await jobs.run('learning.retrievability', { workspaceId: 'ws_a' });
    expect(report).toMatchObject({ outcome: 'succeeded', changed: 1 });
    expect(await retrievabilityOf(store, 'ws_a', v.versionId)).toEqual({ outcome: 'retrievable', reason: null });
    // Nothing left to retry.
    expect((await jobs.run('learning.retrievability', { workspaceId: 'ws_a' })).changed).toBe(0);
  });
});
