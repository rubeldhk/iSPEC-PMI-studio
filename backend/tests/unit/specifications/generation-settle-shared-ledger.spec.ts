/**
 * `T1321` (EPIC-041) — settling a job the commit already settled is not a transition.
 *
 * Found by `T1383`, the first run of `GenerateSpecificationService.run()` against
 * a ledger and a store that address the SAME `generation_jobs` row — which is
 * every composed deployment. `commitGeneration` writes `succeeded` and the
 * result reference inside its transaction; `settle()` then read `succeeded` and
 * asked the state machine for `succeeded → succeeded`, which it rightly refuses
 * (a terminal state has no successors). The refusal was caught and reported as
 * `engine_error`, so **every persisted success read as a failure**. The failure
 * path had the same shape one step later: `recordJobOutcome` wrote `failed`,
 * `settle` asked for `failed → failed`, and `run()` threw out of the worker.
 *
 * The comment on the old code said the repeat was harmless. It was never
 * exercised, because the store was never bound in production (`X16`).
 *
 * These tests use an in-memory store that mirrors its terminal writes into the
 * ledger — the shared-row shape, without a database.
 */
import { describe, expect, it } from 'vitest';
import {
  GenerateSpecificationService,
  InMemoryGenerationJobLedger,
} from '../../../src/modules/specifications/generate-specification.service.js';
import {
  InMemorySpecificationStore,
  type GenerationCommit,
  type JobOutcomeRecord,
} from '../../../src/modules/specifications/specifications-read.service.js';
import { PROJECT, StubEngine, WS, selection } from './helpers.js';

/** A store whose terminal writes land on the ledger too — one row, two readers. */
class SharedRowStore extends InMemorySpecificationStore {
  constructor(private readonly ledger: InMemoryGenerationJobLedger) {
    super();
  }

  override async commitGeneration(commit: GenerationCommit) {
    const record = await super.commitGeneration(commit);
    await this.ledger.updateState(commit.job.id, {
      state: 'succeeded',
      endedAt: new Date(),
      resultRef: commit.job.resultRef,
    });
    return record;
  }

  override async recordJobOutcome(outcome: JobOutcomeRecord): Promise<void> {
    await super.recordJobOutcome(outcome);
    await this.ledger.updateState(outcome.jobId, {
      state: outcome.state,
      failureReason: outcome.failureReason,
      endedAt: new Date(),
    });
  }
}

async function queuedJob(ledger: InMemoryGenerationJobLedger): Promise<string> {
  const row = await ledger.create({
    workspaceId: WS,
    projectId: PROJECT,
    kind: 'generate_specification',
    requestedById: 'u1',
    engineName: 'stub',
    engineVersion: '1',
    correlationId: 'corr_1',
    inputRefs: { requirementIds: selection().map((r) => r.id) },
    jobKey: 'key_1',
  });
  return row.id;
}

const order = (jobId: string) => ({
  jobId,
  workspaceId: WS,
  projectId: PROJECT,
  requestedById: 'u1',
  correlationId: 'corr_1',
  projectName: 'Payments',
  requirements: selection(),
  timeoutMs: 500,
});

describe('T1321 · settle on a shared ledger row', () => {
  it('a persisted success is reported as succeeded, not engine_error', async () => {
    const ledger = new InMemoryGenerationJobLedger();
    const store = new SharedRowStore(ledger);
    const service = new GenerateSpecificationService(
      { resolveForProject: async () => StubEngine.returning() as never },
      store,
      { ledger },
    );
    const jobId = await queuedJob(ledger);

    const outcome = await service.run(order(jobId));

    expect(outcome.state).toBe('succeeded');
    expect(outcome.failureReason).toBeUndefined();
    const job = await ledger.findById(jobId);
    expect(job?.state).toBe('succeeded');
    expect(job?.resultRef).toBe(outcome.specification?.id);
  });

  it('a failure the store already recorded settles without throwing', async () => {
    const ledger = new InMemoryGenerationJobLedger();
    const store = new SharedRowStore(ledger);
    const service = new GenerateSpecificationService(
      { resolveForProject: async () => { throw new Error('no engine'); } },
      store,
      { ledger },
    );
    const jobId = await queuedJob(ledger);

    const outcome = await service.run(order(jobId));

    expect(outcome).toMatchObject({ state: 'failed', failureReason: 'engine_unavailable' });
    expect((await ledger.findById(jobId))?.state).toBe('failed');
  });

  it('a genuinely impossible transition is still refused by the machine', async () => {
    // The fix narrows to SAME-state repeats. running → queued, or any other
    // impossible move, must still fail loudly rather than be written.
    const ledger = new InMemoryGenerationJobLedger();
    const store = new InMemorySpecificationStore();
    const service = new GenerateSpecificationService(
      { resolveForProject: async () => StubEngine.returning() as never },
      store,
      { ledger },
    );
    const jobId = await queuedJob(ledger);
    await ledger.updateState(jobId, { state: 'running' });
    await ledger.updateState(jobId, { state: 'cancelled', failureReason: 'cancelled' });

    // A job already cancelled cannot be claimed for a run.
    await expect(service.run(order(jobId))).rejects.toThrow(/cannot be claimed|cancelled/i);
  });
});
