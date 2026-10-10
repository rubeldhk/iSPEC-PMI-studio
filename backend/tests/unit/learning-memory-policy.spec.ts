/**
 * `T2338` (EPIC-048, `FR-LRN-055`, `FR-LRN-056`, `SC-LRN-009`) — what an Expert
 * may contribute is its contract's memory policy.
 *
 * - `none` — refused, and `memory-policy-refused` is appended to its execution;
 * - `governed-knowledge` — accepted;
 * - anything else — refused: an unrecognised policy is not a permission;
 * - nothing is stored per Expert: governed learning confers no private memory.
 *
 * These use an in-test `ExpertProvenance`, bound visibly. The real one is
 * `T2401` (`adapters/experts.adapter.ts`), asserted in `learning-adapter-experts.spec.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { InMemoryLearningStore } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { SubmissionService, type SubmissionActor } from '../../src/modules/learning/submission.service.js';
import { learningWorld, submission, type LearningTestWorld } from '../helpers/learning-ports.js';

const AGENT: SubmissionActor = { kind: 'agent', workspaceId: 'ws_a', principalId: 'agent_1', projectId: 'p1' };

let world: LearningTestWorld;
let store: InMemoryLearningStore;

function service(): SubmissionService {
  return new SubmissionService({ store, ports: world.ports, policy: new LearningPolicyReader(world.ports.policy) });
}

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
});

describe('T2338 · an Expert declaring none (FR-LRN-055)', () => {
  beforeEach(() => {
    world.experts.set('exe_1', { expertId: 'expert_1', contractVersionId: 'ecv_1', contractVersion: 1, memoryPolicy: 'none' });
  });

  it('is refused, naming the policy and the contract version', async () => {
    const err = await service().submit({ actor: AGENT, projectId: 'p1', body: submission() }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    expect((err as Error).message).toMatch(/memory policy "none"/);
    expect((err as ValidationFailedError).details).toMatchObject({ memoryPolicy: 'none', expertId: 'expert_1', contractVersion: 1 });
  });

  it('memory-policy-refused is appended to its execution, and nothing is stored', async () => {
    await service().submit({ actor: AGENT, projectId: 'p1', body: submission() }).catch(() => undefined);
    expect(world.events.map((e) => e.payload['kind'])).toEqual(['memory-policy-refused']);
    expect(await store.submissionsForExecution('ws_a', 'exe_1')).toBe(0);
  });
});

describe('T2338 · an Expert declaring governed-knowledge', () => {
  it('is accepted', async () => {
    world.experts.set('exe_1', { expertId: 'expert_1', contractVersionId: 'ecv_2', contractVersion: 2, memoryPolicy: 'governed-knowledge' });
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission() })).resolves.toMatchObject({ status: 201 });
  });
});

describe('T2338 · an unrecognised policy is not a permission', () => {
  it.each(['session', 'persistent', ''])('"%s" is refused', async (memoryPolicy) => {
    world.experts.set('exe_1', { expertId: 'expert_1', contractVersionId: 'ecv_3', contractVersion: 3, memoryPolicy });
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission() })).rejects.toBeInstanceOf(ValidationFailedError);
  });
});

describe('T2338 · nothing is stored per Expert (FR-LRN-056, SC-LRN-009)', () => {
  it('the store has no Expert-keyed read or write — an Expert is a column on a candidate, nothing more', () => {
    const names = new Set<string>();
    let proto: object | null = store;
    while (proto && proto !== Object.prototype) {
      for (const n of Object.getOwnPropertyNames(proto)) names.add(n);
      proto = Object.getPrototypeOf(proto) as object | null;
    }
    expect([...names].filter((n) => /expert|memory/i.test(n))).toEqual([]);
  });
});
