/**
 * T653 — the worker consumes.
 *
 * Convergence found `main.ts` composing the engine registry, logging
 * `worker.started`, and exiting. `consumeGenerationJob` — the whole of F-00.4's
 * persistence path, with 8 passing tests — was referenced by nothing but its own
 * spec, and no BullMQ `Worker` existed anywhere in the repository. Jobs could be
 * created and never picked up.
 *
 * The BullMQ constructor is injected as a narrow factory so the dispatch
 * contract is testable without Valkey, exactly as the engine and store ports are.
 */
import type { SpecificationEngine } from '@pmi/engine-contract';
import {
  consumeGenerationJob,
  type ConsumeLimits,
  type ConsumeResult,
  type GenerationJobPayload,
  type JobPersistence,
} from './generation.consumer.js';

/** Must match `backend/src/modules/jobs/jobs.module.ts`. Asserted on both sides. */
export const GENERATION_QUEUE_NAME = 'generation';

/** What a running consumer exposes. Enough to shut it down. */
export interface RunningWorker {
  close(): Promise<void>;
}

/** The subset of BullMQ's `Worker` constructor this bootstrap uses. */
export type WorkerFactory = (
  queue: string,
  processor: (job: { data: unknown }) => Promise<unknown>,
  opts: Record<string, unknown>,
) => RunningWorker;

/**
 * `T1321` (EPIC-041, `R-041-6`) — what the API actually enqueues.
 *
 * `BullJobQueue.enqueue` sends `{ jobId, correlationId }` and nothing else; the
 * rest of the order lives in `generation_jobs`. A runner is keyed by job id and
 * reads the rest from the database through `@pmi/backend/worker-api`, so the
 * payload mismatch between producer and consumer that `T1383` found is closed
 * here rather than by teaching the API to send a payload the worker guesses at.
 */
export interface EnqueuedJob {
  readonly jobId: string;
  readonly correlationId: string;
}

export interface GenerationRunner {
  run(jobId: string, options: ConsumeLimits): Promise<ConsumeResult>;
}

export interface GenerationWorkerDeps {
  factory: WorkerFactory;
  /**
   * The production path (`T1321`): `createGenerationRunner()` from
   * `@pmi/backend/worker-api`, which hydrates the order from the database and
   * runs the API's own commit. When present, `resolveEngine` and `persistence`
   * are not consulted — the runner resolves engines through its own deps.
   */
  runner?: GenerationRunner;
  /** Resolved per job, so a project's engine selection is honoured (FR-019). Legacy payload path. */
  resolveEngine?: (job: GenerationJobPayload) => SpecificationEngine;
  /** Legacy payload path. Required when no runner is supplied. */
  persistence?: JobPersistence;
  limits: ConsumeLimits;
  concurrency?: number;
  onResult?: (job: GenerationJobPayload, result: ConsumeResult) => void;
}

/**
 * Bind a consumer to the generation queue.
 *
 * Concurrency is bounded on purpose. Every job is a metered AI agent invocation
 * inside a container, so an unbounded worker is an unbounded bill (RAID R-02)
 * and an unbounded number of sandboxes.
 *
 * Refuses at construction — not at the first job — when it has neither a
 * runner nor a persistence: a worker that discovers at its first job that it
 * cannot persist is the failure `T1320` exists to prevent.
 */
export function createGenerationWorker(deps: GenerationWorkerDeps): RunningWorker {
  const { factory, runner, resolveEngine, persistence, limits, concurrency = 2, onResult } = deps;

  if (runner === undefined && (persistence === undefined || resolveEngine === undefined)) {
    throw new Error(
      'createGenerationWorker needs a runner (the production path via @pmi/backend/worker-api), or a persistence and resolveEngine for the legacy payload path. It was given neither.',
    );
  }

  return factory(
    GENERATION_QUEUE_NAME,
    async (job) => {
      if (runner !== undefined) {
        const { jobId, correlationId } = job.data as EnqueuedJob;
        const result = await runner.run(jobId, limits);
        // The payload shape `onResult` reads is the legacy one; the two fields
        // observability actually uses are id and correlationId.
        onResult?.(
          {
            id: jobId,
            correlationId,
            workspaceId: 'unknown',
            projectId: 'unknown',
            requestedById: 'unknown',
            projectName: '',
            requirements: [],
          },
          result,
        );
        return result;
      }

      const payload = job.data as GenerationJobPayload;
      const result = await consumeGenerationJob(payload, resolveEngine!(payload), persistence!, limits);
      onResult?.(payload, result);
      return result;
    },
    { concurrency },
  );
}
