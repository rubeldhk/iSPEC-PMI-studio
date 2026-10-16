/**
 * `T2330` (EPIC-048, `FR-LRN-060`, `R-048-17`) — what happens to a submission is
 * an event on its source execution, not a separate log.
 *
 * `submitted`, `late-submitted`, `refused` and `bound-exceeded` are appended
 * through `Executions.appendEvent` with an idempotency key; the payload carries
 * the outcome and the candidate id, never the statement. A person's candidate has
 * no execution, so it appends nothing. (`corroborated` is asserted with
 * corroboration itself, in `learning-corroboration.spec.ts`, `T2342`.)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryLearningStore } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { SubmissionService, type SubmissionActor } from '../../src/modules/learning/submission.service.js';
import { learningWorld, submission, type LearningTestWorld } from '../helpers/learning-ports.js';

const AGENT: SubmissionActor = { kind: 'agent', workspaceId: 'ws_a', principalId: 'agent_1', projectId: 'p1' };
const PERSON: SubmissionActor = { kind: 'person', workspaceId: 'ws_a', userId: 'u_sub' };
const STATEMENT = 'Integration tests need the local database started first.';

let world: LearningTestWorld;
let store: InMemoryLearningStore;
let now: Date;

function service(): SubmissionService {
  return new SubmissionService({ store, ports: world.ports, policy: new LearningPolicyReader(world.ports.policy), now: () => now });
}

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
  now = new Date('2026-10-09T12:00:00Z');
});

function kinds(): string[] {
  return world.events.map((e) => String(e.payload['kind']));
}

describe('T2330 · outcomes are events on the source execution', () => {
  it('submitted — with the candidate id, an idempotency key, and the submitter as emitter', async () => {
    const out = await service().submit({ actor: AGENT, projectId: 'p1', body: submission() });
    expect(world.events).toHaveLength(1);
    expect(world.events[0]).toMatchObject({ workspaceId: 'ws_a', executionId: 'exe_1', emittedBy: 'agent_1', payload: { kind: 'submitted', candidateId: out.body.candidateId } });
    expect(world.events[0]!.idempotencyKey).toMatch(/\S+/);
  });

  it('late-submitted after the terminal event, inside the grace period', async () => {
    world.executions.set('exe_done', { executionId: 'exe_done', workspaceId: 'ws_a', projectId: 'p1', governanceState: 'governed', terminal: { type: 'completed', at: '2026-10-09T08:00:00Z' }, invalidatedBy: [] });
    await service().submit({ actor: AGENT, projectId: 'p1', body: submission({ executionId: 'exe_done' }) });
    expect(kinds()).toEqual(['late-submitted']);
  });

  it('refused — naming why, when an execution is named and registered (quickstart Q1)', async () => {
    const { evidence: _e, confidence: _c, claimedScope: _s, ...body } = submission();
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body })).rejects.toThrow();
    expect(kinds()).toEqual(['refused']);
    expect(String(world.events[0]!.payload['reason'])).toMatch(/evidence|confidence|scope/);
  });

  it('refused for a secret, naming the rule and never the value', async () => {
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission({ statement: 'key AKIAABCDEFGHIJKLMNOP' }) })).rejects.toThrow();
    expect(kinds()).toEqual(['refused']);
    expect(JSON.stringify(world.events[0]!.payload)).not.toContain('AKIA');
  });

  it('bound-exceeded on the 21st', async () => {
    const svc = service();
    for (let i = 0; i < 20; i += 1) await svc.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: `s ${i}` }) });
    await expect(svc.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: 'over' }) })).rejects.toThrow();
    expect(kinds().at(-1)).toBe('bound-exceeded');
  });

  it('T2687 · concurrent submissions on different subjects never exceed the bound (FR-LRN-007)', async () => {
    const svc = service();
    for (let i = 0; i < 18; i += 1) await svc.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: `s ${i}` }) });
    // Two places left; five arrive at once, each on its own subject (its own subject lock).
    const outcomes = await Promise.allSettled([0, 1, 2, 3, 4].map((i) => svc.submit({ actor: AGENT, projectId: 'p1', body: submission({ subject: `race ${i}` }) })));
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(2);
    expect(await store.submissionsForExecution('ws_a', 'exe_1')).toBe(20);
    expect(kinds().filter((k) => k === 'bound-exceeded')).toHaveLength(3);
  });

  it('nothing for an execution that is not registered — there is nowhere to record it', async () => {
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission({ executionId: 'exe_ghost' }) })).rejects.toThrow();
    expect(world.events).toEqual([]);
  });
});

describe('T2330 · no statement text in any payload', () => {
  it('payloads carry kind, candidateId and reason only', async () => {
    await service().submit({ actor: AGENT, projectId: 'p1', body: submission() });
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission({ category: 'nope' }) })).rejects.toThrow();
    for (const e of world.events) {
      expect(Object.keys(e.payload).every((k) => ['kind', 'candidateId', 'reason'].includes(k))).toBe(true);
      expect(JSON.stringify(e.payload)).not.toContain(STATEMENT);
    }
  });
});

describe('T2330 · a person appends nothing', () => {
  it('has no execution to append to', async () => {
    const { executionId: _x, ...body } = submission();
    await service().submit({ actor: PERSON, projectId: 'p1', body });
    expect(world.events).toEqual([]);
  });
});

describe('T2330 · idempotent appends', () => {
  it('a replayed submission does not append a second event', async () => {
    const body = submission({ idempotencyKey: 'once' });
    await service().submit({ actor: AGENT, projectId: 'p1', body });
    await service().submit({ actor: AGENT, projectId: 'p1', body });
    expect(kinds()).toEqual(['submitted']);
  });
});
