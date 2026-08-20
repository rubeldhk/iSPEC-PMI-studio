/**
 * T846 — the generation job ledger's liveness rule (F5, Constitution V).
 *
 * Written to FAIL before the ledger satisfies it (Constitution V).
 *
 * Found by the `/speckit-converge EPIC-008` pass. `InMemoryGenerationJobLedger`
 * is a SECOND implementation of the queued/running liveness rule that
 * `NullJobStore` and `PrismaJobStore` already implement. EPIC-001's
 * `job-idempotency.spec.ts` proves the rule for its own store, and nothing
 * proved it for this one — the exact shape `T648` named: one requirement
 * written twice, both agreeing, with no behavioural test that would catch them
 * diverging.
 *
 * The rule matters twice over. Joining a live job is what stops a double-submit
 * billing a second engine run (RAID R-02); NOT joining a finished one is what
 * makes **US3 scenario 3**'s "the user can retry" true, because a retry after a
 * failure must start a new run rather than re-join the old failure forever.
 */
import { describe, expect, it } from 'vitest';
import { NullJobStore } from '../../../src/modules/jobs/job.store.js';
import { computeJobKey, JobsService, type JobRequest } from '../../../src/modules/jobs/jobs.service.js';
import { InMemoryGenerationJobLedger } from '../../../src/modules/specifications/generate-specification.service.js';
import { PROJECT, WS } from './helpers.js';

const REQUEST: JobRequest = {
  workspaceId: WS,
  projectId: PROJECT,
  kind: 'generate_specification',
  requestedById: 'u1',
  engineName: 'stub',
  engineVersion: '1.0.0',
  correlationId: 'corr_1',
  inputRefs: { requirementIds: ['req_1', 'req_2'] },
};

const KEY = computeJobKey(REQUEST);

async function seeded(): Promise<{ ledger: InMemoryGenerationJobLedger; id: string }> {
  const ledger = new InMemoryGenerationJobLedger();
  const { id } = await ledger.create({ ...REQUEST, jobKey: KEY });
  return { ledger, id };
}

describe('a LIVE job is joinable — a double-submit does not bill twice (RAID R-02)', () => {
  it.each([['queued'], ['running']] as const)('joins a %s job', async (state) => {
    const { ledger, id } = await seeded();
    if (state === 'running') await ledger.updateState(id, { state, startedAt: new Date() });

    const live = await ledger.findLive(PROJECT, KEY);
    expect(live?.id).toBe(id);
    expect(live?.state).toBe(state);
  });

  it('a duplicate submission through JobsService returns the existing job', async () => {
    const ledger = new InMemoryGenerationJobLedger();
    const jobs = new JobsService(ledger);
    const first = await jobs.submit(REQUEST);
    const second = await jobs.submit(REQUEST);

    expect(second.job.id).toBe(first.job.id);
    expect(second.joinedExisting).toBe(true);
  });
});

describe('a FINISHED job is NOT joinable — a retry starts a new run (US3/AC3)', () => {
  it.each([['succeeded'], ['failed'], ['cancelled'], ['timed_out']] as const)(
    'does not join a %s job',
    async (state) => {
      const { ledger, id } = await seeded();
      await ledger.updateState(id, { state: 'running' });
      await ledger.updateState(id, {
        state,
        ...(state === 'succeeded' ? {} : { failureReason: 'engine_error' as const }),
        endedAt: new Date(),
      });

      expect(await ledger.findLive(PROJECT, KEY)).toBeNull();
    },
  );

  it('re-submitting after a failure creates a NEW job, not a second join', async () => {
    const ledger = new InMemoryGenerationJobLedger();
    const jobs = new JobsService(ledger);
    const first = await jobs.submit(REQUEST);
    await ledger.updateState(first.job.id, { state: 'running' });
    await ledger.updateState(first.job.id, {
      state: 'failed',
      failureReason: 'engine_error',
      endedAt: new Date(),
    });

    const retry = await jobs.submit(REQUEST);
    expect(retry.job.id).not.toBe(first.job.id);
    expect(retry.joinedExisting).toBe(false);
  });
});

describe('scope: the key alone does not make a job joinable', () => {
  it('does not join across projects', async () => {
    const { ledger } = await seeded();
    expect(await ledger.findLive('proj_other', KEY)).toBeNull();
  });

  it('does not join a different selection', async () => {
    const { ledger } = await seeded();
    const otherKey = computeJobKey({ ...REQUEST, inputRefs: { requirementIds: ['req_9'] } });
    expect(await ledger.findLive(PROJECT, otherKey)).toBeNull();
  });
});

describe('the ledger and NullJobStore agree', () => {
  it('both join a live job and both refuse a finished one', async () => {
    // Two implementations of one requirement CAN disagree; this is the test
    // that fails when they start to.
    const ledger = new InMemoryGenerationJobLedger();
    const nullStore = new NullJobStore();

    for (const store of [ledger, nullStore]) {
      const created = await store.create({ ...REQUEST, jobKey: KEY });
      const live = await store.findLive(PROJECT, KEY);
      expect(live?.id, `${store.constructor.name} did not join a live job`).toBe(created.id);
    }

    // `NullJobStore` has no state transitions, so the divergence case is
    // asserted where it can be: the ledger must stop joining once finished.
    const created = (await ledger.findLive(PROJECT, KEY))!;
    await ledger.updateState(created.id, { state: 'running' });
    await ledger.updateState(created.id, {
      state: 'cancelled',
      failureReason: 'cancelled',
      endedAt: new Date(),
    });
    expect(await ledger.findLive(PROJECT, KEY)).toBeNull();
  });
});
