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

export interface GenerationWorkerDeps {
  factory: WorkerFactory;
  /** Resolved per job, so a project's engine selection is honoured (FR-019). */
  resolveEngine: (job: GenerationJobPayload) => SpecificationEngine;
  persistence: JobPersistence;
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
 */
export function createGenerationWorker(deps: GenerationWorkerDeps): RunningWorker {
  const { factory, resolveEngine, persistence, limits, concurrency = 2, onResult } = deps;

  return factory(
    GENERATION_QUEUE_NAME,
    async (job) => {
      const payload = job.data as GenerationJobPayload;
      const result = await consumeGenerationJob(
        payload,
        resolveEngine(payload),
        persistence,
        limits,
      );
      onResult?.(payload, result);
      return result;
    },
    { concurrency },
  );
}
