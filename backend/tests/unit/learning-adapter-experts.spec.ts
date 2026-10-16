/**
 * `T2400` (EPIC-048, Phase 9, `R-048-10`, `FR-LRN-055`) — `ExpertProvenance`
 * through `EPIC-047`'s export (`A-047-2`), and `governed-knowledge` admitted by
 * `EPIC-047`'s own contract rule (`A-047-1`).
 *
 * The rows are `EPIC-047`'s: an Expert, a contract version validated by
 * `validateContract`, and a session, in its in-memory store; the answer comes
 * from `expertProvenance`, the read `ExpertsModule` exports. A submission from
 * the session's execution is then judged by `SubmissionService` with that
 * port: `governed-knowledge` is accepted, `none` refused and recorded on the
 * execution. The database `CHECK` half of `A-047-1` is `EPIC-047`'s
 * `expert-constraints.spec.ts`; it is not duplicated here.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { validateContract } from '../../src/modules/experts/contract.validation.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import type { ExpertSession, MemoryPolicy } from '../../src/modules/experts/expert.types.js';
import { expertProvenance } from '../../src/modules/experts/provenance.js';
import { expertsAdapter } from '../../src/modules/learning/adapters/experts.adapter.js';
import { InMemoryLearningStore } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { SubmissionService, type SubmissionActor } from '../../src/modules/learning/submission.service.js';
import { contract, expert, version } from '../helpers/expert-fixtures.js';
import { learningWorld, submission, type LearningTestWorld } from '../helpers/learning-ports.js';

const WS = 'ws_a';
const AGENT: SubmissionActor = { kind: 'agent', workspaceId: WS, principalId: 'agent_1', projectId: 'p1' };

let world: LearningTestWorld;

/** EPIC-047's rows for one Expert session on `exe_1`, under a contract declaring `memoryPolicy`. */
async function expertsWith(memoryPolicy: MemoryPolicy): Promise<InMemoryExpertsStore> {
  const store = new InMemoryExpertsStore();
  await store.addExpert(expert({ workspaceId: WS }));
  await store.addVersion(version({ workspaceId: WS, contract: validateContract({ ...contract(), memoryPolicy }) }));
  await store.addSession({
    executionId: 'exe_1', workspaceId: WS, expertId: 'ex_test', contractVersionId: 'cv_1', delegatedFromExecutionId: null,
    actorId: 'u_1', depth: 0, model: 'fixture', usedFallback: false, fallbackReason: null,
    effectiveAuthority: {} as ExpertSession['effectiveAuthority'], toolObservation: 'observed', unattended: false,
    reviewRequired: false, outcome: null, startedAt: '2026-10-09T09:00:00.000Z', endedAt: null,
  } as ExpertSession);
  return store;
}

function service(): SubmissionService {
  return new SubmissionService({ store: new InMemoryLearningStore(), ports: world.ports, policy: new LearningPolicyReader(world.ports.policy) });
}

beforeEach(() => {
  world = learningWorld();
});

describe('T2400 · ExpertProvenance answers through EPIC-047’s export', () => {
  it('names the Expert, the contract version the session started under and its memory policy', async () => {
    const port = expertsAdapter(expertProvenance(await expertsWith('governed-knowledge')));
    await expect(port.forExecution(WS, 'exe_1')).resolves.toEqual({
      expertId: 'ex_test', contractVersionId: 'cv_1', contractVersion: 1, memoryPolicy: 'governed-knowledge',
    });
  });

  it('a non-Expert execution, or one in another workspace, returns null', async () => {
    const port = expertsAdapter(expertProvenance(await expertsWith('none')));
    await expect(port.forExecution(WS, 'exe_not_an_expert')).resolves.toBeNull();
    await expect(port.forExecution('ws_other', 'exe_1')).resolves.toBeNull();
  });

  it('a fault in EPIC-047 is thrown as itself — never read as "not an Expert"', async () => {
    const port = expertsAdapter({ async forExecution() { throw new Error('contract version cannot be read'); } });
    await expect(port.forExecution(WS, 'exe_1')).rejects.toThrow(/cannot be read/);
  });
});

describe('T2400 · EPIC-047’s contract rule admits governed-knowledge (A-047-1)', () => {
  it('validateContract accepts governed-knowledge and none, and still refuses anything else', () => {
    expect(validateContract({ ...contract(), memoryPolicy: 'governed-knowledge' }).memoryPolicy).toBe('governed-knowledge');
    expect(validateContract({ ...contract(), memoryPolicy: 'none' }).memoryPolicy).toBe('none');
    expect(() => validateContract({ ...contract(), memoryPolicy: 'session' })).toThrow();
  });

  it('a governed-knowledge Expert’s submission is accepted', async () => {
    world.ports.experts = expertsAdapter(expertProvenance(await expertsWith('governed-knowledge')));
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission() })).resolves.toMatchObject({ status: 201 });
  });

  it('a none Expert’s submission is refused, naming the policy, and recorded on its execution', async () => {
    world.ports.experts = expertsAdapter(expertProvenance(await expertsWith('none')));
    const err = await service().submit({ actor: AGENT, projectId: 'p1', body: submission() }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    expect((err as Error).message).toMatch(/memory policy "none"/);
    expect(world.events.map((e) => e.payload['kind'])).toEqual(['memory-policy-refused']);
  });
});
