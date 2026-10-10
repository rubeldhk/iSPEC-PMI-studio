/**
 * `T2342` (EPIC-048, `FR-LRN-017`, `FR-LRN-036`, `R-048-15`) — the same
 * observation twice is one candidate with two sources; an observation that
 * contradicts an approved entry says so.
 *
 * - A submission whose `subjectKey` matches an **open** candidate attaches as a
 *   corroboration — its source and evidence kept, no second candidate — and
 *   `corroborated` is appended to the corroborating execution (`FR-LRN-060`).
 * - Two concurrent submissions of one subject produce one candidate (the
 *   advisory lock on `(workspaceId, subjectKey)`).
 * - A `new` candidate whose subject matches a **current** approved entry is
 *   conflicting and names it (`FR-LRN-036`).
 * - Corroboration never changes the candidate, or what eligibility reads.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryLearningStore } from '../../src/modules/learning/learning.store.js';
import { InMemoryKnowledgeWriter } from '../../src/modules/learning/knowledge.writer.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { findConflict, SubmissionService, subjectKeyOf, type SubmissionActor } from '../../src/modules/learning/submission.service.js';
import { entryRecordFor, recordingAudit, versionRecordFor } from '../helpers/learning-fixtures.js';
import { learningWorld, submission, type LearningTestWorld } from '../helpers/learning-ports.js';

const AGENT_1: SubmissionActor = { kind: 'agent', workspaceId: 'ws_a', principalId: 'agent_1', projectId: 'p1' };
const AGENT_2: SubmissionActor = { kind: 'agent', workspaceId: 'ws_a', principalId: 'agent_2', projectId: 'p1' };
const PERSON: SubmissionActor = { kind: 'person', workspaceId: 'ws_a', userId: 'u_sub' };

let world: LearningTestWorld;
let store: InMemoryLearningStore;

function service(): SubmissionService {
  return new SubmissionService({ store, ports: world.ports, policy: new LearningPolicyReader(world.ports.policy) });
}

beforeEach(() => {
  world = learningWorld();
  world.executions.set('exe_2', { executionId: 'exe_2', workspaceId: 'ws_a', projectId: 'p1', governanceState: 'governed', terminal: null, invalidatedBy: [] });
  store = new InMemoryLearningStore();
});

describe('T2342 · corroboration (FR-LRN-017)', () => {
  it('attaches a matching submission to the open candidate, keeping its source and evidence', async () => {
    const first = await service().submit({ actor: AGENT_1, projectId: 'p1', body: submission({ subject: 'DB must start first' }) });
    const second = await service().submit({
      actor: AGENT_2,
      projectId: 'p1',
      body: submission({ executionId: 'exe_2', subject: '  db MUST start first! ', statement: 'Start Postgres before the integration suite.', evidence: [{ evidenceId: 'ev_2', digest: { sha256: 'a'.repeat(64) } }] }),
    });
    expect(second.status).toBe(200);
    expect(second.body.candidateId).toBe(first.body.candidateId);
    expect(second.body.corroborationId).toEqual(expect.any(String));

    const corroborations = await store.corroborations('ws_a', first.body.candidateId);
    expect(corroborations).toHaveLength(1);
    expect(corroborations[0]).toMatchObject({ sourceKind: 'execution', executionId: 'exe_2', sourcePrincipalId: 'agent_2', statement: 'Start Postgres before the integration suite.' });
    const citations = await store.citations('ws_a', first.body.candidateId);
    expect(citations.find((c) => c.corroborationId === second.body.corroborationId)?.evidenceId).toBe('ev_2');
    expect(await store.candidatesInStates(['proposed', 'pending-review'])).toHaveLength(1);
  });

  it('corroborated is appended to the corroborating execution, with the candidate id', async () => {
    const first = await service().submit({ actor: AGENT_1, projectId: 'p1', body: submission({ subject: 'same thing' }) });
    await service().submit({ actor: AGENT_2, projectId: 'p1', body: submission({ executionId: 'exe_2', subject: 'same thing' }) });
    const corroborated = world.events.find((e) => e.payload['kind'] === 'corroborated');
    expect(corroborated).toMatchObject({ executionId: 'exe_2', emittedBy: 'agent_2', payload: { kind: 'corroborated', candidateId: first.body.candidateId } });
  });

  it('a person can corroborate too', async () => {
    const first = await service().submit({ actor: AGENT_1, projectId: 'p1', body: submission({ subject: 'same' }) });
    const { executionId: _x, ...body } = submission({ subject: 'same' });
    const out = await service().submit({ actor: PERSON, projectId: 'p1', body });
    expect(out.body.candidateId).toBe(first.body.candidateId);
    expect((await store.corroborations('ws_a', first.body.candidateId))[0]).toMatchObject({ sourceKind: 'person', sourcePrincipalId: 'u_sub', executionId: null });
  });

  it('a closed candidate is not corroborated — a new submission opens a new one', async () => {
    const first = await service().submit({ actor: AGENT_1, projectId: 'p1', body: submission({ subject: 'reopened' }) });
    await store.transaction((tx) => tx.appendTransition({ workspaceId: 'ws_a', candidateId: first.body.candidateId, state: 'withdrawn', reason: null, decisionId: null, actorKind: 'human', actorId: 'u', at: new Date() }));
    const again = await service().submit({ actor: AGENT_2, projectId: 'p1', body: submission({ executionId: 'exe_2', subject: 'reopened' }) });
    expect(again.status).toBe(201);
    expect(again.body.candidateId).not.toBe(first.body.candidateId);
  });

  it('a replayed corroboration returns the original corroboration', async () => {
    await service().submit({ actor: AGENT_1, projectId: 'p1', body: submission({ subject: 'twice' }) });
    const body = submission({ executionId: 'exe_2', subject: 'twice', idempotencyKey: 'corr-once' });
    const a = await service().submit({ actor: AGENT_2, projectId: 'p1', body });
    const b = await service().submit({ actor: AGENT_2, projectId: 'p1', body });
    expect(b.body.corroborationId).toBe(a.body.corroborationId);
    expect(b.body.replayed).toBe(true);
    expect(world.events.filter((e) => e.payload['kind'] === 'corroborated')).toHaveLength(1);
  });

  it('two concurrent submissions of one subject produce one candidate', async () => {
    const [a, b] = await Promise.all([
      service().submit({ actor: AGENT_1, projectId: 'p1', body: submission({ subject: 'race' }) }),
      service().submit({ actor: AGENT_2, projectId: 'p1', body: submission({ executionId: 'exe_2', subject: 'race' }) }),
    ]);
    expect(a.body.candidateId).toBe(b.body.candidateId);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(await store.candidatesInStates(['proposed', 'pending-review'])).toHaveLength(1);
  });
});

describe('T2342 · corroboration never changes eligibility', () => {
  it('the candidate’s own record and citations are unchanged', async () => {
    const first = await service().submit({ actor: AGENT_1, projectId: 'p1', body: submission({ subject: 'stable', confidence: { level: 'low', basis: 'hunch' } }) });
    const before = await store.candidate('ws_a', first.body.candidateId);
    const ownBefore = (await store.citations('ws_a', first.body.candidateId)).filter((c) => c.corroborationId === null);
    await service().submit({ actor: AGENT_2, projectId: 'p1', body: submission({ executionId: 'exe_2', subject: 'stable', confidence: { level: 'high', basis: 'sure' } }) });
    expect(await store.candidate('ws_a', first.body.candidateId)).toEqual(before);
    expect((await store.citations('ws_a', first.body.candidateId)).filter((c) => c.corroborationId === null)).toEqual(ownBefore);
    expect(await store.transitions('ws_a', first.body.candidateId)).toHaveLength(1);
  });
});

describe('T2342 · conflict with an approved entry (FR-LRN-036)', () => {
  async function approvedEntry(subject: string): Promise<{ entryId: string; versionId: string }> {
    const writer = new InMemoryKnowledgeWriter(store, recordingAudit());
    const out = await service().submit({ actor: AGENT_1, projectId: 'p1', body: submission({ subject }) });
    const c = (await store.candidate('ws_a', out.body.candidateId))!;
    const entry = entryRecordFor(c);
    const version = versionRecordFor(c, entry);
    await writer.insertVersion({
      workspaceId: 'ws_a', candidateId: c.id, entry, version,
      statusEvents: [{ id: `se_${version.id}`, workspaceId: 'ws_a', versionId: version.id, status: 'current', successorVersionId: null, reason: null, actorId: 'u_h', decisionId: version.decisionId, candidateId: c.id, at: new Date() }],
      transition: { decisionId: version.decisionId, actorKind: 'human', actorId: 'u_h', reason: null, at: new Date() },
      audit: [],
    });
    return { entryId: entry.id, versionId: version.id };
  }

  it('a new candidate on the subject of a current entry is conflicting and names it', async () => {
    const { entryId, versionId } = await approvedEntry('known fact');
    const out = await service().submit({ actor: AGENT_2, projectId: 'p1', body: submission({ executionId: 'exe_2', subject: 'Known  fact', statement: 'The opposite is true.' }) });
    const c = (await store.candidate('ws_a', out.body.candidateId))!;
    expect(c.subjectKey).toBe(subjectKeyOf('architecture', 'known fact'));
    await expect(findConflict(store, c)).resolves.toMatchObject({ entryId, versionId, version: 1 });
  });

  it('a supersede candidate is not conflicting — it proposes the replacement', async () => {
    const { versionId } = await approvedEntry('replaced fact');
    const out = await service().submit({ actor: AGENT_2, projectId: 'p1', body: submission({ executionId: 'exe_2', subject: 'replaced fact', kind: 'supersede', targetVersionId: versionId }) });
    await expect(findConflict(store, (await store.candidate('ws_a', out.body.candidateId))!)).resolves.toBeNull();
  });

  it('no entry on the subject, no conflict', async () => {
    const out = await service().submit({ actor: AGENT_1, projectId: 'p1', body: submission({ subject: 'fresh' }) });
    await expect(findConflict(store, (await store.candidate('ws_a', out.body.candidateId))!)).resolves.toBeNull();
  });
});
