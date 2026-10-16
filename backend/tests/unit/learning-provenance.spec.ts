/**
 * `T2336` (EPIC-048, US2) — a candidate carries where it came from and how sure
 * its submitter was.
 *
 * - `FR-LRN-011`: an Expert session records the Expert, its contract version id
 *   and number, through `ExpertProvenance` (`EPIC-047`, `A-047-2`).
 * - `ExpertProvenance` unbound: an execution-sourced submission cannot be judged
 *   against its Expert's memory policy, so it is refused `503` naming the port;
 *   a person's submission is unaffected (`R-048-10`).
 * - `FR-LRN-013`: stated confidence is stored as given and never raised.
 * - `FR-LRN-014`, US2-5: the claimed scope is stored as claimed; a named set is
 *   at least two projects of this workspace.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError, ValidationFailedError } from '../../src/core/errors.js';
import { InMemoryLearningStore } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { refusingPorts } from '../../src/modules/learning/learning.tokens.js';
import { SubmissionService, type SubmissionActor } from '../../src/modules/learning/submission.service.js';
import { learningWorld, submission, type LearningTestWorld } from '../helpers/learning-ports.js';

const AGENT: SubmissionActor = { kind: 'agent', workspaceId: 'ws_a', principalId: 'agent_1', projectId: 'p1' };
const PERSON: SubmissionActor = { kind: 'person', workspaceId: 'ws_a', userId: 'u_sub' };

let world: LearningTestWorld;
let store: InMemoryLearningStore;

function service(): SubmissionService {
  return new SubmissionService({ store, ports: world.ports, policy: new LearningPolicyReader(world.ports.policy) });
}

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
});

describe('T2336 · Expert provenance (FR-LRN-011)', () => {
  it('records the Expert, its contract version id and number', async () => {
    world.experts.set('exe_1', { expertId: 'expert_1', contractVersionId: 'ecv_7', contractVersion: 3, memoryPolicy: 'governed-knowledge' });
    const out = await service().submit({ actor: AGENT, projectId: 'p1', body: submission() });
    expect(await store.candidate('ws_a', out.body.candidateId)).toMatchObject({ expertId: 'expert_1', expertContractVersionId: 'ecv_7', expertContractVersion: 3 });
  });

  it('a non-Expert execution records none', async () => {
    const out = await service().submit({ actor: AGENT, projectId: 'p1', body: submission() });
    expect(await store.candidate('ws_a', out.body.candidateId)).toMatchObject({ expertId: null, expertContractVersionId: null, expertContractVersion: null });
  });

  it('ExpertProvenance unbound refuses an execution-sourced submission 503, naming the port, storing nothing', async () => {
    world.ports.experts = refusingPorts().experts;
    const err = await service().submit({ actor: AGENT, projectId: 'p1', body: submission() }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GovernanceSeamUnboundError);
    expect((err as Error).message).toContain('ExpertProvenance');
    expect(await store.submissionsForExecution('ws_a', 'exe_1')).toBe(0);
  });

  it('…and leaves a person’s submission unaffected', async () => {
    world.ports.experts = refusingPorts().experts;
    const { executionId: _x, ...body } = submission();
    await expect(service().submit({ actor: PERSON, projectId: 'p1', body })).resolves.toMatchObject({ status: 201 });
  });
});

describe('T2336 · confidence is stated, never raised (FR-LRN-013)', () => {
  it.each(['low', 'medium', 'high'] as const)('%s is stored as %s with its basis', async (level) => {
    const out = await service().submit({ actor: AGENT, projectId: 'p1', body: submission({ confidence: { level, basis: `basis for ${level}` } }) });
    expect(await store.candidate('ws_a', out.body.candidateId)).toMatchObject({ confidenceLevel: level, confidenceBasis: `basis for ${level}` });
  });

  it('corroboration does not raise it either', async () => {
    const first = await service().submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: 'same', confidence: { level: 'low', basis: 'a hunch' } }) });
    world.executions.set('exe_2', { executionId: 'exe_2', workspaceId: 'ws_a', projectId: 'p1', governanceState: 'governed', terminal: null, invalidatedBy: [] });
    await service().submit({ actor: { ...AGENT, principalId: 'agent_2' }, projectId: 'p1', body: submission({ executionId: 'exe_2', subject: 'same', confidence: { level: 'high', basis: 'certain' } }) });
    expect((await store.candidate('ws_a', first.body.candidateId))?.confidenceLevel).toBe('low');
  });
});

describe('T2336 · claimed scope is a proposal, stored as claimed (FR-LRN-014, US2-5)', () => {
  it('a workspace claim is recorded as a workspace claim', async () => {
    const out = await service().submit({ actor: AGENT, projectId: 'p1', body: submission({ claimedScope: { kind: 'workspace', projectIds: [] } }) });
    expect((await store.candidate('ws_a', out.body.candidateId))?.claimedScope).toEqual({ kind: 'workspace', projectIds: [] });
  });

  it('a named set of two projects of the workspace is recorded as claimed', async () => {
    const out = await service().submit({ actor: AGENT, projectId: 'p1', body: submission({ claimedScope: { kind: 'projects', projectIds: ['p1', 'p2'] } }) });
    expect((await store.candidate('ws_a', out.body.candidateId))?.claimedScope).toEqual({ kind: 'projects', projectIds: ['p1', 'p2'] });
  });

  it('a named set reaching outside the workspace is refused, naming the project', async () => {
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission({ claimedScope: { kind: 'projects', projectIds: ['p1', 'px'] } }) })).rejects.toThrow(/px/);
  });

  it('a named set of one is refused (≥ 2)', async () => {
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission({ claimedScope: { kind: 'projects', projectIds: ['p1'] } }) })).rejects.toBeInstanceOf(ValidationFailedError);
  });

  it('a project claim names the source project and no other', async () => {
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission({ claimedScope: { kind: 'project', projectIds: ['p2'] } }) })).rejects.toThrow(/source project/);
  });
});
