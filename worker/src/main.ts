/**
 * Worker entry point (T004, T653, T1321).
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
 *
 * T1321 (EPIC-041, `R-041-6`): this process now PERSISTS. Until 2026-09-03 the
 * `persistence()` here threw on every job — honest, and a hold PMI-DOC-004
 * discharged on 2026-08-20 that nobody returned for (PMI-DOC-004B §2.1). The
 * worker now runs the API's own commit through the one permitted edge,
 * `@pmi/backend/worker-api`: a runner keyed by the job id the API enqueued,
 * which hydrates the order from `generation_jobs` and commits specification,
 * version, links, job state and owner grant in one transaction. And it records
 * what it composed into `engine_registrations`, so the API can resolve a
 * descriptor for a submission without ever holding an engine.
 */
import { Worker } from 'bullmq';
import { buildObservability, newCorrelationId, NullMetricSink } from '@pmi/observability';
import { createGenerationRunner, recordEngineRegistrations } from '@pmi/backend/worker-api';
import { composeEngineRegistry } from './engine-composition.js';
import { reportGenerationResult } from './observability-composition.js';
import { createGenerationWorker, type RunningWorker } from './worker-bootstrap.js';
import { resolveJobTimeoutMs } from './config.js';

/** Hard wall-clock ceiling per job (FR-025, SC-011: 10 min default). Also a cost control — RAID R-02. */
const JOB_TIMEOUT_MS = resolveJobTimeoutMs(process.env);

async function main(): Promise<void> {
  // The collector endpoint is configuration, not a Phase 1 decision
  // (system-design.md), so the default sink is inert rather than absent.
  const observability = buildObservability({ service: 'worker', sink: new NullMetricSink() });

  const registry = composeEngineRegistry();

  // What this worker can run, written where the API can read it (T1321). The
  // API registers each as descriptor-only and refuses to run it — that refusal
  // is ADR-0001 holding, not a gap.
  const defaultName = registry.resolve().descriptor.name;
  await recordEngineRegistrations(
    registry.list().map((d) => ({
      name: d.name,
      version: d.version,
      capabilities: d.capabilities,
      isDefault: d.name === defaultName,
    })),
  );

  // Wall-clock per job, measured here rather than inside the consumer: the
  // consumer's own clock is the ENGINE's budget, and SC-011 asks how long the
  // platform took, which includes claiming and persisting.
  const inFlight = new Map<string, { startedAt: number; engineName: string }>();

  const runner = createGenerationRunner({
    // Per job, so a project's engine selection is honoured (FR-019).
    resolveEngine: (engineName) => registry.resolve(engineName ?? undefined),
  });

  const worker: RunningWorker = createGenerationWorker({
    factory: (queue, processor, opts) =>
      new Worker(
        queue,
        async (job) => {
          inFlight.set(String(job.id), { startedAt: Date.now(), engineName: 'per-job' });
          return processor({ data: job.data });
        },
        {
          connection: {
            url: process.env['VALKEY_URL'] ?? process.env['REDIS_URL'] ?? 'redis://localhost:6379',
          },
          ...opts,
        },
      ),
    runner,
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
  observability
    .loggerFor({ workspaceId: 'platform', actorId: null, correlationId: newCorrelationId() })
    .log('info', 'worker.started', {
      engines: registry.list(),
      timeoutMs: JOB_TIMEOUT_MS,
    });
}

void main();
