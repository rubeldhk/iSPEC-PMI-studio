/**
 * `T2326` (EPIC-048, US1) — where a candidate comes from, and how much of it.
 *
 * `FR-LRN-005` a registered execution, or within the grace period after its end;
 * `FR-LRN-006` a person names themselves; `FR-LRN-007` bounded per execution;
 * `FR-LRN-008` isolated by workspace; `FR-LRN-061` idempotent; `FR-LRN-063` a
 * provisional execution's candidate stays `proposed` and asks for no decision.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ValidationFailedError } from '../../src/core/errors.js';
import { InMemoryLearningStore } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { SubmissionService, type SubmissionActor } from '../../src/modules/learning/submission.service.js';
import { learningWorld, submission, type LearningTestWorld } from '../helpers/learning-ports.js';

const AGENT: SubmissionActor = { kind: 'agent', workspaceId: 'ws_a', principalId: 'agent_1', projectId: 'p1' };
const PERSON: SubmissionActor = { kind: 'person', workspaceId: 'ws_a', userId: 'u_sub' };

let world: LearningTestWorld;
let store: InMemoryLearningStore;
let requestDecision: ReturnType<typeof vi.fn>;
let now: Date;

function service(): SubmissionService {
  return new SubmissionService({
    store,
    ports: world.ports,
    policy: new LearningPolicyReader(world.ports.policy),
    now: () => now,
    requestDecision,
  });
}

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
  requestDecision = vi.fn(async () => ({ state: 'pending-review' as const, decisionId: 'dec_x', eligibility: { automatic: false, failedConditions: ['category-not-declared-low-risk'] } }));
  now = new Date('2026-10-09T12:00:00Z');
});

describe('T2326 · the source execution (FR-LRN-005)', () => {
  it('records a registered execution’s observation as a proposed candidate', async () => {
    const out = await service().submit({ actor: AGENT, projectId: 'p1', body: submission() });
    expect(out.status).toBe(201);
    const candidate = await store.candidate('ws_a', out.body.candidateId);
    expect(candidate).toMatchObject({ sourceKind: 'execution', executionId: 'exe_1', sourcePrincipalId: 'agent_1', late: false, provisional: false });
    expect((await store.transitions('ws_a', out.body.candidateId))[0]).toMatchObject({ state: 'proposed', seq: 1 });
  });

  it('refuses an unregistered execution, storing nothing', async () => {
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission({ executionId: 'exe_ghost' }) })).rejects.toThrow(/not registered/);
    expect(await store.candidatesInStates(['proposed'])).toEqual([]);
  });

  it('refuses an agent submission naming no execution, as a missing source', async () => {
    const { executionId: _e, ...body } = submission();
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body })).rejects.toMatchObject({ details: { missing: ['source'] } });
  });

  it('refuses an execution bound to another project of the workspace', async () => {
    world.executions.set('exe_p2', { executionId: 'exe_p2', workspaceId: 'ws_a', projectId: 'p2', governanceState: 'governed', terminal: null, invalidatedBy: [] });
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission({ executionId: 'exe_p2' }) })).rejects.toBeInstanceOf(ValidationFailedError);
  });

  it('accepts a submission after the terminal event within 24 h, recorded late', async () => {
    world.executions.set('exe_done', { executionId: 'exe_done', workspaceId: 'ws_a', projectId: 'p1', governanceState: 'governed', terminal: { type: 'completed', at: '2026-10-09T00:00:00Z' }, invalidatedBy: [] });
    const out = await service().submit({ actor: AGENT, projectId: 'p1', body: submission({ executionId: 'exe_done' }) });
    expect(out.body.late).toBe(true);
    expect((await store.candidate('ws_a', out.body.candidateId))?.late).toBe(true);
  });

  it('refuses one after the grace period, naming the terminal event and the period', async () => {
    world.executions.set('exe_old', { executionId: 'exe_old', workspaceId: 'ws_a', projectId: 'p1', governanceState: 'governed', terminal: { type: 'failed', at: '2026-10-08T11:00:00Z' }, invalidatedBy: [] });
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission({ executionId: 'exe_old' }) })).rejects.toThrow(/failed.*24 h|24 h.*failed/);
  });
});

describe('T2326 · a person (FR-LRN-006)', () => {
  it('names the person as the source, with no execution', async () => {
    const { executionId: _e, ...body } = submission();
    const out = await service().submit({ actor: PERSON, projectId: 'p1', body });
    expect(await store.candidate('ws_a', out.body.candidateId)).toMatchObject({ sourceKind: 'person', executionId: null, sourcePrincipalId: 'u_sub' });
  });

  it('a person cannot submit as an execution', async () => {
    await expect(service().submit({ actor: PERSON, projectId: 'p1', body: submission() })).rejects.toThrow(/person/);
  });

  it('refuses a project outside the workspace', async () => {
    const { executionId: _e, ...body } = submission({ claimedScope: { kind: 'project', projectIds: ['px'] } });
    await expect(service().submit({ actor: PERSON, projectId: 'px', body })).rejects.toBeInstanceOf(ValidationFailedError);
  });
});

describe('T2326 · the bound (FR-LRN-007)', () => {
  it('refuses the 21st submission for one execution', async () => {
    const svc = service();
    for (let i = 0; i < 20; i += 1) {
      await svc.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: `subject ${i}` }) });
    }
    await expect(svc.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: 'one too many' }) })).rejects.toThrow(/20/);
    expect(await store.submissionsForExecution('ws_a', 'exe_1')).toBe(20);
  });
});

describe('T2326 · workspace isolation (FR-LRN-008)', () => {
  it('another workspace’s execution is refused, and candidates never cross', async () => {
    world.executions.set('exe_b', { executionId: 'exe_b', workspaceId: 'ws_b', projectId: 'px', governanceState: 'governed', terminal: null, invalidatedBy: [] });
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission({ executionId: 'exe_b' }) })).rejects.toThrow(/not registered/);
    const mine = await service().submit({ actor: AGENT, projectId: 'p1', body: submission() });
    expect(await store.candidate('ws_b', mine.body.candidateId)).toBeNull();
  });
});

describe('T2326 · provisional executions (FR-LRN-063)', () => {
  it('records proposed and requests no decision', async () => {
    world.executions.set('exe_off', { executionId: 'exe_off', workspaceId: 'ws_a', projectId: 'p1', governanceState: 'provisional', terminal: null, invalidatedBy: [] });
    const out = await service().submit({ actor: AGENT, projectId: 'p1', body: submission({ executionId: 'exe_off' }) });
    expect(out.body).toMatchObject({ state: 'proposed', provisional: true });
    expect(requestDecision).not.toHaveBeenCalled();
  });

  it('a governed execution’s candidate does ask for one', async () => {
    const out = await service().submit({ actor: AGENT, projectId: 'p1', body: submission() });
    expect(requestDecision).toHaveBeenCalledTimes(1);
    expect(out.body).toMatchObject({ state: 'pending-review', decisionId: 'dec_x' });
  });
});

describe('T2326 · idempotency (FR-LRN-061)', () => {
  it('a retried idempotencyKey returns the original, writing nothing new', async () => {
    const body = submission({ idempotencyKey: 'retry-me' });
    const first = await service().submit({ actor: AGENT, projectId: 'p1', body });
    const second = await service().submit({ actor: AGENT, projectId: 'p1', body });
    expect(second.status).toBe(200);
    expect(second.body.candidateId).toBe(first.body.candidateId);
    expect(second.body.replayed).toBe(true);
    expect(await store.submissionsForExecution('ws_a', 'exe_1')).toBe(1);
    expect(requestDecision).toHaveBeenCalledTimes(1);
  });

  it('the same key with different content is a conflict, not someone else’s answer', async () => {
    await service().submit({ actor: AGENT, projectId: 'p1', body: submission({ idempotencyKey: 'k' }) });
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission({ idempotencyKey: 'k', statement: 'Something else entirely.' }) })).rejects.toBeInstanceOf(ConflictError);
  });
});
