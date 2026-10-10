/**
 * `T2364` (EPIC-048, US4, `FR-LRN-031`, `-033`, `-034`) — knowledge changes
 * without forgetting, from submission to status.
 *
 * - `supersede` and `deprecate` candidates always ask `learning.review.*` — even
 *   in a low-risk category, at project scope, with verified evidence (US4-5);
 * - an approved deprecation writes `deprecated` with reason, actor and instant,
 *   and no new version;
 * - a target that is not the current version is refused `400` at submission;
 * - an approved version is never edited — a supersession leaves it byte-for-byte.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { ApproverGuard } from '../../src/modules/learning/approver.guard.js';
import { DecisionRequester } from '../../src/modules/learning/decision.requester.js';
import { InMemoryKnowledgeWriter } from '../../src/modules/learning/knowledge.writer.js';
import { InMemoryLearningStore } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { Materialiser } from '../../src/modules/learning/materialiser.js';
import { SubmissionService, type SubmissionActor } from '../../src/modules/learning/submission.service.js';
import { learningWorld, submission, type LearningTestWorld } from '../helpers/learning-ports.js';

const AGENT: SubmissionActor = { kind: 'agent', workspaceId: 'ws_a', principalId: 'agent_1', projectId: 'p1' };

let world: LearningTestWorld;
let store: InMemoryLearningStore;
let materialiser: Materialiser;
let submissions: SubmissionService;

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
  const policy = new LearningPolicyReader(world.ports.policy);
  materialiser = new Materialiser({ store, writer: new InMemoryKnowledgeWriter(store, world.ports.audit), ports: world.ports, policy, guard: new ApproverGuard(world.ports.principals) });
  const requester = new DecisionRequester({ store, ports: world.ports, policy, applyResolution: (c, r) => materialiser.applyResolution(c.workspaceId, c.id, r) });
  submissions = new SubmissionService({ store, ports: world.ports, policy, requestDecision: (c) => requester.request(c) });
});

/** Submit and approve as a human, through the real path. */
async function approved(over: Record<string, unknown>, approver = 'u_h'): Promise<{ candidateId: string; versionId: string; entryId: string }> {
  const out = await submissions.submit({ actor: AGENT, projectId: 'p1', body: submission(over) });
  const resolution = world.decisions.resolveAs(out.body.decisionId!, { outcome: 'approved', actorKind: 'human', decidedBy: approver });
  const applied = await materialiser.applyResolution('ws_a', out.body.candidateId, resolution);
  return { candidateId: out.body.candidateId, versionId: applied.versionId!, entryId: applied.entryId! };
}

describe('T2364 · supersession and deprecation always take human review (FR-LRN-034, US4-5)', () => {
  it.each(['supersede', 'deprecate'] as const)('%s asks learning.review.%s, even in a low-risk category with everything else eligible', async (kind) => {
    const v1 = await approved({ subject: `fact for ${kind}` });
    world.decisions.next = 'auto-executed';
    const out = await submissions.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: `fact for ${kind}`, category: 'test-setup', kind, targetVersionId: v1.versionId }) });
    expect(world.decisions.requests.at(-1)!.actionType).toBe(`learning.review.${kind}`);
    expect(out.body.reasonIfNot).toContain('kind-not-new');
    // Had EPIC-031 auto-executed the review anyway, the guard refuses it (RK-5).
    expect(out.body.state).toBe('proposed');
    expect((await store.currentStatus('ws_a', v1.versionId))?.status).toBe('current');
  });
});

describe('T2364 · deprecation (FR-LRN-033)', () => {
  it('writes deprecated with reason, actor and instant — and no new version', async () => {
    const v1 = await approved({ subject: 'deprecated fact' });
    const dep = await approved({ subject: 'deprecated fact', kind: 'deprecate', targetVersionId: v1.versionId, statement: 'Stopped being true after the 2026 migration.' }, 'u_h2');
    const status = await store.currentStatus('ws_a', v1.versionId);
    expect(status).toMatchObject({ status: 'deprecated', reason: 'Stopped being true after the 2026 migration.', actorId: 'u_h2' });
    expect(status?.at).toBeInstanceOf(Date);
    expect(await store.versionForCandidate('ws_a', dep.candidateId)).toBeNull();
    expect((await store.versionsOfEntry('ws_a', v1.entryId)).map((v) => v.version)).toEqual([1]);
  });
});

describe('T2364 · only the current version is acted on (FR-LRN-031)', () => {
  it.each(['supersede', 'deprecate', 'widen-scope'] as const)('%s of a superseded version is refused 400 at submission', async (kind) => {
    const v1 = await approved({ subject: `chain ${kind}` });
    await approved({ subject: `chain ${kind}`, kind: 'supersede', targetVersionId: v1.versionId, statement: 'v2' });
    const err = await submissions
      .submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: `chain ${kind}`, kind, targetVersionId: v1.versionId, claimedScope: kind === 'widen-scope' ? { kind: 'workspace', projectIds: [] } : { kind: 'project', projectIds: ['p1'] } }) })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    expect((err as Error).message).toMatch(/superseded/);
  });

  it('a version that does not exist is refused 400', async () => {
    await expect(submissions.submit({ actor: AGENT, projectId: 'p1', body: submission({ kind: 'supersede', targetVersionId: 'kv_nope' }) })).rejects.toBeInstanceOf(ValidationFailedError);
  });
});

describe('T2364 · an approved version is never edited (FR-LRN-031)', () => {
  it('supersession leaves v1 exactly as it was, and adds v2 beside it', async () => {
    const v1 = await approved({ subject: 'immutable' });
    const before = structuredClone(await store.version('ws_a', v1.versionId));
    const v2 = await approved({ subject: 'immutable', kind: 'supersede', targetVersionId: v1.versionId, statement: 'The refined fact.' });
    expect(await store.version('ws_a', v1.versionId)).toEqual(before);
    expect(await store.version('ws_a', v2.versionId)).toMatchObject({ entryId: v1.entryId, version: 2, statement: 'The refined fact.' });
    expect(await store.currentStatus('ws_a', v1.versionId)).toMatchObject({ status: 'superseded', successorVersionId: v2.versionId });
  });
});
