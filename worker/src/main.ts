/**
 * Worker entry point (T004, T653).
 *
 * The only process permitted to hold a concrete engine and to spawn sandboxes
 * (ADR-0001, ADR-0002).
 *
 * T653: this process now CONSUMES. Convergence found it composing the registry,
 * logging `worker.started`, and exiting — so `consumeGenerationJob` and the
 * whole of F-00.4's persistence path were unreachable, and a submitted job could
 * never be picked up.
 */
import { Worker } from 'bullmq';
import { composeEngineRegistry } from './engine-composition.js';
import { createGenerationWorker, type RunningWorker } from './worker-bootstrap.js';
import type { JobPersistence } from './generation.consumer.js';

/** Hard wall-clock ceiling per job (FR-025). Also a cost control — RAID R-02. */
const JOB_TIMEOUT_MS = Number(process.env['JOB_TIMEOUT_MS'] ?? 15 * 60 * 1000);

/**
 * Persistence is not yet connected.
 *
 * `PrismaJobStore` exists on the API side, but the worker's write path is the
 * transactional specification/version/link write, and the models it needs
 * belong to EPIC-008/EPIC-009 — both **held** pending `PMI-DOC-004`. Failing
 * loudly is the honest behaviour: a worker that silently discarded results
 * would look healthy while losing every generation.
 */
function persistence(): JobPersistence {
  return {
    async transaction() {
      throw new Error(
        'Generation persistence is not connected: the specification and version models are ' +
          'owned by EPIC-008/EPIC-009, which are held pending PMI-DOC-004. See EPIC-001 T653.',
      );
    },
  };
}

async function main(): Promise<void> {
  const registry = composeEngineRegistry();

  const worker: RunningWorker = createGenerationWorker({
    factory: (queue, processor, opts) =>
      new Worker(queue, async (job) => processor({ data: job.data }), {
        connection: { url: process.env['REDIS_URL'] ?? 'redis://localhost:6379' },
        ...opts,
      }),
    // Per job, so a project's engine selection is honoured (FR-019).
    resolveEngine: () => registry.resolve(),
    persistence: persistence(),
    limits: { timeoutMs: JOB_TIMEOUT_MS },
  });

  const shutdown = async (): Promise<void> => {
    await worker.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  console.log(
    JSON.stringify({
      service: 'worker',
      msg: 'worker.started',
      engines: registry.list(),
      timeoutMs: JOB_TIMEOUT_MS,
    }),
  );
}

void main();
