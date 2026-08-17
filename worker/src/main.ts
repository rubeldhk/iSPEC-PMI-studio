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
 *
 * T661: this process is now OBSERVABLE. `T657` installed the bundle in the API
 * and could not install it here, because it lived under `backend/src/core/` and
 * the worker may not depend on `@pmi/backend`. So PP-010 was satisfied in one of
 * two long-running processes while `spec.md` claimed the platform, and `SC-011`
 * — a claim about the distribution of terminal job states — had nothing
 * recording terminal job states. See DEF-001-001.
 */
import { Worker } from 'bullmq';
import { buildObservability, newCorrelationId, NullMetricSink } from '@pmi/observability';
import { composeEngineRegistry } from './engine-composition.js';
import { reportGenerationResult } from './observability-composition.js';
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
  // The collector endpoint is configuration, not a Phase 1 decision
  // (system-design.md), so the default sink is inert rather than absent.
  const observability = buildObservability({ service: 'worker', sink: new NullMetricSink() });

  const registry = composeEngineRegistry();

  // Wall-clock per job, measured here rather than inside the consumer: the
  // consumer's own clock is the ENGINE's budget, and SC-011 asks how long the
  // platform took, which includes claiming and persisting.
  //
  // The engine name is captured at resolve time rather than read from the
  // registry afterwards, because selection is per job (FR-019) — reporting the
  // registry's default would misattribute every run on a project that chose
  // something else.
  const inFlight = new Map<string, { startedAt: number; engineName: string }>();

  const worker: RunningWorker = createGenerationWorker({
    factory: (queue, processor, opts) =>
      new Worker(queue, async (job) => processor({ data: job.data }), {
        connection: { url: process.env['REDIS_URL'] ?? 'redis://localhost:6379' },
        ...opts,
      }),
    // Per job, so a project's engine selection is honoured (FR-019).
    resolveEngine: (job) => {
      const engine = registry.resolve();
      inFlight.set(job.id, { startedAt: Date.now(), engineName: engine.descriptor.name });
      return engine;
    },
    persistence: persistence(),
    limits: { timeoutMs: JOB_TIMEOUT_MS },
    onResult: (job, result) => {
      const started = inFlight.get(job.id);
      inFlight.delete(job.id);
      reportGenerationResult(
        observability,
        job,
        result,
        started === undefined ? 0 : Date.now() - started.startedAt,
        started?.engineName ?? 'unknown',
      );
    },
  });

  const shutdown = async (): Promise<void> => {
    await worker.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  // A startup record is what makes the wiring observable from outside: if this
  // line is missing from a running process, observability is not installed.
  //
  // Through the structured logger, not `console.log(JSON.stringify(...))` —
  // a hand-rolled line carries no level, no workspace, no actor and no
  // correlation id, and never passes through `redact()`.
  observability
    .loggerFor({ workspaceId: 'platform', actorId: null, correlationId: newCorrelationId() })
    .log('info', 'worker.started', {
      engines: registry.list(),
      timeoutMs: JOB_TIMEOUT_MS,
    });
}

void main();
