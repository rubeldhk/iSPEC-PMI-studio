/**
 * T655 — the BullMQ binding for job dispatch.
 *
 * Convergence found `bullmq` declared as a dependency of both `backend` and
 * `worker` and imported by zero source files: `JobsService` took an optional
 * queue port that nothing supplied, so every submission created a durable row
 * and enqueued nothing. The job was real and could never start.
 *
 * The delegate is narrow on purpose. `JobsService` is testable without Valkey,
 * and swapping BullMQ for another transport is one class rather than a service
 * rewrite — the same reasoning as the engine and store ports.
 *
 * Framework-free (PC-1).
 */
import type { JobQueue } from './jobs.service.js';

/** The subset of a BullMQ `Queue` this binding uses. */
export interface QueueDelegate {
  add(
    name: string,
    data: Record<string, unknown>,
    opts?: Record<string, unknown>,
  ): Promise<unknown>;
}

/** The job name inside the queue. The queue itself is `GENERATION_QUEUE_NAME`. */
export const GENERATION_JOB_NAME = 'generate';

export class BullJobQueue implements JobQueue {
  constructor(private readonly queue: QueueDelegate) {}

  /**
   * The database job id is also the BullMQ job id.
   *
   * That is what makes redelivery safe: BullMQ deduplicates on `jobId`, so a
   * retried enqueue cannot produce a second metered engine run (RAID R-02).
   * The correlation identifier is CARRIED, never regenerated — PC-3 requires
   * one identifier across API → queue → worker → sandbox.
   */
  async enqueue(jobId: string, correlationId: string): Promise<void> {
    await this.queue.add(GENERATION_JOB_NAME, { jobId, correlationId }, { jobId });
  }
}

/**
 * A queue that records instead of dispatching.
 *
 * Used by tests and by deployments with no broker. Jobs remain durable in the
 * database either way — the queue is how work is *picked up*, not where it
 * lives.
 */
export class NullJobQueue implements JobQueue {
  readonly enqueued: { jobId: string; correlationId: string }[] = [];

  async enqueue(jobId: string, correlationId: string): Promise<void> {
    this.enqueued.push({ jobId, correlationId });
  }
}
