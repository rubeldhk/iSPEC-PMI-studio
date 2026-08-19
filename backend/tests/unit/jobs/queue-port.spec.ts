/**
 * T654 — the queue port is real, and a duplicate submission does not enqueue twice.
 *
 * Convergence found `bullmq` declared as a dependency of BOTH `backend` and
 * `worker` and imported by ZERO source files. `JobsService` accepted an optional
 * queue port that nothing ever supplied, so `submit()` created a durable row and
 * enqueued nothing — a job that could never start.
 *
 * The port stays narrow deliberately: this asserts the enqueue *contract*
 * without Valkey, and the BullMQ binding is one thin class behind it.
 */
import { describe, expect, it, vi } from 'vitest';
import { JobsService, type JobRequest } from '../../../src/modules/jobs/jobs.service.js';
import {
  BullJobQueue,
  NullJobQueue,
  type QueueDelegate,
} from '../../../src/modules/jobs/job-queue.js';
import { NullJobStore } from '../../../src/modules/jobs/job.store.js';

const CORRELATION = '00000000-0000-4000-8000-000000000000';

/** Typed so `mock.calls` is a tuple rather than `[]`. */
const makeAdd = () =>
  vi.fn(
    async (
      _name: string,
      _data: Record<string, unknown>,
      _opts?: Record<string, unknown>,
    ): Promise<unknown> => undefined,
  );

function request(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    workspaceId: 'ws',
    projectId: 'proj',
    kind: 'generate_specification',
    requestedById: 'user',
    engineName: 'speckit',
    engineVersion: 'v1',
    correlationId: CORRELATION,
    inputRefs: { requirementIds: ['r1'] },
    ...overrides,
  };
}

describe('T654 · BullJobQueue speaks the delegate BullMQ provides', () => {
  it('adds one job carrying the id and correlation identifier', async () => {
    const add = makeAdd();
    const queue = new BullJobQueue({ add } as QueueDelegate);

    await queue.enqueue('job-1', CORRELATION);

    expect(add).toHaveBeenCalledTimes(1);
    const [name, payload, opts] = add.mock.calls[0]!;
    expect(name).toBe('generate');
    expect(payload).toMatchObject({ jobId: 'job-1', correlationId: CORRELATION });
    // PC-3: the identifier is CARRIED, never regenerated downstream.
    expect(opts).toMatchObject({ jobId: 'job-1' });
  });

  it('uses the job id as the BullMQ job id, so redelivery cannot duplicate work', async () => {
    const add = makeAdd();
    const queue = new BullJobQueue({ add } as QueueDelegate);
    await queue.enqueue('job-1', CORRELATION);
    await queue.enqueue('job-1', CORRELATION);

    const ids = add.mock.calls.map((c) => (c[2] as { jobId: string }).jobId);
    expect(ids).toEqual(['job-1', 'job-1']);
  });
});

describe('T654 · the service enqueues exactly once per real submission', () => {
  it('enqueues on a new job', async () => {
    const store = new NullJobStore();
    const queue = new NullJobQueue();
    const result = await new JobsService(store, queue).submit(request());
    expect(queue.enqueued).toEqual([{ jobId: result.job.id, correlationId: CORRELATION }]);
  });

  it('does NOT enqueue when the submission joins a live job', async () => {
    const store = new NullJobStore();
    const queue = new NullJobQueue();
    const service = new JobsService(store, queue);

    await service.submit(request());
    const second = await service.submit(request());

    expect(second.joinedExisting).toBe(true);
    expect(queue.enqueued).toHaveLength(1);
  });

  it('refuses an empty selection before anything is created or enqueued (E7)', async () => {
    const store = new NullJobStore();
    const queue = new NullJobQueue();
    const service = new JobsService(store, queue);

    await expect(service.submit(request({ inputRefs: { requirementIds: [] } }))).rejects.toThrow();
    expect(store.created).toHaveLength(0);
    expect(queue.enqueued).toHaveLength(0);
  });
});
