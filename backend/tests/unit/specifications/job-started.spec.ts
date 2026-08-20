/**
 * T838 — a generation run reports that it is RUNNING (F1, **US3 scenario 2**).
 *
 * Written to FAIL before T839 exists (Constitution V).
 *
 * Found by the `/speckit-converge EPIC-008` pass. `applyTransition` permits
 * `queued → running`, `findLive` treats `running` as joinable, and the API
 * contract documents both `state ∈ … running …` and `startedAt` — and nothing
 * performed the transition. A job went straight from `queued` to a terminal
 * state, so US3's second acceptance scenario ("the user sees that the job is
 * running and can continue using the rest of the platform") had no state to
 * show.
 *
 * The transition goes through `applyTransition`, not a raw write, which is what
 * makes a second consumer claiming the same job a refusal rather than a race.
 */
import { describe, expect, it } from 'vitest';
import { engineOk } from '@pmi/engine-contract';
import { JobsService } from '../../../src/modules/jobs/jobs.service.js';
import {
  GenerateSpecificationService,
  InMemoryGenerationJobLedger,
  InMemoryRequirementSelection,
  JobNotClaimableError,
} from '../../../src/modules/specifications/generate-specification.service.js';
import { InMemorySpecificationStore } from '../../../src/modules/specifications/specifications-read.service.js';
import { DESCRIPTOR, OUTPUT, PROJECT, StubEngine, WS, selection } from './helpers.js';

function world(): {
  ledger: InMemoryGenerationJobLedger;
  store: InMemorySpecificationStore;
  jobs: JobsService;
  requirements: InMemoryRequirementSelection;
} {
  const ledger = new InMemoryGenerationJobLedger();
  return {
    ledger,
    store: new InMemorySpecificationStore(),
    jobs: new JobsService(ledger),
    requirements: new InMemoryRequirementSelection(
      selection().map((r) => ({ id: r.id, workspaceId: WS, projectId: PROJECT })),
    ),
  };
}

async function queuedJob(ledger: InMemoryGenerationJobLedger): Promise<string> {
  const created = await ledger.create({
    workspaceId: WS,
    projectId: PROJECT,
    kind: 'generate_specification',
    requestedById: 'u1',
    engineName: 'stub',
    engineVersion: '1.0.0',
    correlationId: 'corr_1',
    inputRefs: { requirementIds: ['req_1'] },
    jobKey: 'key_1',
  });
  return created.id;
}

const order = (jobId: string, over: Record<string, unknown> = {}) => ({
  jobId,
  workspaceId: WS,
  projectId: PROJECT,
  requestedById: 'u1',
  correlationId: 'corr_1',
  projectName: 'Payments',
  requirements: selection(),
  timeoutMs: 1_000,
  ...over,
});

describe('the job is marked running BEFORE the engine is invoked (US3/AC2)', () => {
  it('the engine observes its own job already in `running`', async () => {
    const { ledger, store, requirements } = world();
    const jobId = await queuedJob(ledger);

    const observed: { state: string; startedAt: Date | null }[] = [];
    const engine = new StubEngine(async () => {
      const row = await ledger.findById(jobId);
      observed.push({ state: row!.state, startedAt: row!.startedAt });
      return engineOk(OUTPUT, DESCRIPTOR);
    });

    const svc = new GenerateSpecificationService({ resolveForProject: async () => engine }, store, {
      ledger,
      requirements,
    });
    const outcome = await svc.run(order(jobId) as never);

    expect(outcome.state).toBe('succeeded');
    expect(observed).toHaveLength(1);
    expect(observed[0]!.state).toBe('running');
    expect(observed[0]!.startedAt).toBeInstanceOf(Date);
  });

  it('stamps startedAt once, and does not move it again on completion', async () => {
    const { ledger, store, requirements } = world();
    const jobId = await queuedJob(ledger);
    let seen: Date | null = null;
    const engine = new StubEngine(async () => {
      seen = (await ledger.findById(jobId))!.startedAt;
      return engineOk(OUTPUT, DESCRIPTOR);
    });

    const svc = new GenerateSpecificationService({ resolveForProject: async () => engine }, store, {
      ledger,
      requirements,
    });
    await svc.run(order(jobId) as never);

    expect((await ledger.findById(jobId))!.startedAt).toEqual(seen);
  });
});

describe('the claim respects the state machine’s permitted transitions', () => {
  it('an already-cancelled request goes queued → cancelled WITHOUT being claimed', async () => {
    // `queued → cancelled` is permitted; `queued → failed` is not. A request
    // abandoned before any work began never started, so `startedAt` stays null.
    const { ledger, store, requirements } = world();
    const jobId = await queuedJob(ledger);
    const engine = StubEngine.returning();
    const svc = new GenerateSpecificationService({ resolveForProject: async () => engine }, store, {
      ledger,
      requirements,
    });

    const outcome = await svc.run(order(jobId, { signal: AbortSignal.abort() }) as never);

    expect(outcome.state).toBe('cancelled');
    const row = await ledger.findById(jobId);
    expect(row!.state).toBe('cancelled');
    expect(row!.startedAt).toBeNull();
    expect(engine.calls).toEqual([]);
  });

  it.each([
    ['an empty selection', { requirements: [] }, 'empty_selection'],
    ['an oversized selection', { requirements: selection(3) }, 'input_too_large'],
  ])(
    '%s is claimed first, then FAILED — because queued → failed is not a legal move',
    async (_label, over, reason) => {
      const { ledger, store, requirements } = world();
      const jobId = await queuedJob(ledger);
      const engine = StubEngine.returning();
      const svc = new GenerateSpecificationService({ resolveForProject: async () => engine }, store, {
        ledger,
        requirements,
        maxRequirements: 2,
      });

      const outcome = await svc.run(order(jobId, over) as never);

      expect(outcome.failureReason).toBe(reason);
      const row = await ledger.findById(jobId);
      expect(row!.state).toBe('failed');
      // Claimed, so `startedAt` is set — the worker did begin. What rule E7
      // protects is the ENGINE never being invoked, and it was not.
      expect(row!.startedAt).toBeInstanceOf(Date);
      expect(engine.calls).toEqual([]);
    },
  );

  it('an unresolvable engine fails the claimed job, and never invokes an engine', async () => {
    const { ledger, store, requirements } = world();
    const jobId = await queuedJob(ledger);
    const svc = new GenerateSpecificationService(
      {
        resolveForProject: async (): Promise<never> => {
          throw new Error('no engine registered');
        },
      },
      store,
      { ledger, requirements },
    );

    const outcome = await svc.run(order(jobId) as never);

    expect(outcome.failureReason).toBe('engine_unavailable');
    expect((await ledger.findById(jobId))!.state).toBe('failed');
  });
});

describe('the claim goes through applyTransition, not a raw write', () => {
  it('refuses to claim a job that is already finished, and never calls the engine', async () => {
    const { ledger, store, requirements } = world();
    const jobId = await queuedJob(ledger);
    await ledger.updateState(jobId, { state: 'running' });
    await ledger.updateState(jobId, { state: 'succeeded', endedAt: new Date() });

    const engine = StubEngine.returning();
    const svc = new GenerateSpecificationService({ resolveForProject: async () => engine }, store, {
      ledger,
      requirements,
    });

    await expect(svc.run(order(jobId) as never)).rejects.toBeInstanceOf(JobNotClaimableError);
    expect(engine.calls).toEqual([]);
    expect(store.commits).toEqual([]);
  });

  it('refuses to claim a job a second consumer is already running', async () => {
    const { ledger, store, requirements } = world();
    const jobId = await queuedJob(ledger);
    await ledger.updateState(jobId, { state: 'running', startedAt: new Date() });

    const svc = new GenerateSpecificationService(
      { resolveForProject: async () => StubEngine.returning() },
      store,
      { ledger, requirements },
    );
    await expect(svc.run(order(jobId) as never)).rejects.toBeInstanceOf(JobNotClaimableError);
  });
});

describe('the ledger stays optional', () => {
  it('a run with no ledger configured still completes — the claim is not a dependency', async () => {
    const store = new InMemorySpecificationStore();
    const svc = new GenerateSpecificationService(
      { resolveForProject: async () => StubEngine.returning() },
      store,
    );
    const outcome = await svc.run(order('job_unledgered') as never);
    expect(outcome.state).toBe('succeeded');
  });
});
