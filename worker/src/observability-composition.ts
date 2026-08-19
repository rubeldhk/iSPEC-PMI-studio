/**
 * T661 — the worker's observability composition.
 *
 * `main.ts` builds the bundle; this module decides what a *job* means to it.
 * It exists so that "every finished job is logged and measured" is a unit-
 * testable claim rather than a shape that only appears inside a bootstrap
 * nothing can call — which is the condition DEF-001-001 arose from.
 *
 * The worker is the process that holds a concrete engine (ADR-0001), so it is
 * the process most able to leak what the engine produced. Every field here goes
 * through `redact()` on the way out, exactly as it does in the API.
 */
import type { Observability } from '@pmi/observability';
import type { ConsumeResult, GenerationJobPayload } from './generation.consumer.js';

/**
 * Record one finished job.
 *
 * Called from the `onResult` hook `createGenerationWorker` already exposes, so
 * no consumer signature changes to make the worker observable.
 *
 * `SC-011` — *"95% of generation requests complete or report a named failure
 * within their time limit"* — is a claim about a distribution of terminal
 * states. Terminal states happen here. Until this ran, nothing recorded them
 * and the criterion was unmeasurable.
 */
export function reportGenerationResult(
  observability: Observability,
  job: GenerationJobPayload,
  result: ConsumeResult,
  durationMs: number,
  engineName: string,
): void {
  observability.metrics.jobFinished({
    state: result.state,
    engineName,
    durationMs,
    ...(result.failureReason ? { failureReason: result.failureReason } : {}),
  });

  // A failed generation is not routine, and a log level is the cheapest filter
  // an operator has. `cancelled` is a user action and stays informational.
  const level = result.state === 'failed' || result.state === 'timed_out' ? 'warn' : 'info';

  observability
    .loggerFor({
      workspaceId: job.workspaceId,
      // The worker acts for the requester, not on its own behalf.
      actorId: job.requestedById,
      // PC-3: carried, never regenerated — this is the hop the trace was
      // missing while the worker logged nothing.
      correlationId: job.correlationId,
      jobId: job.id,
    })
    .log(level, 'job.finished', {
      state: result.state,
      engine: engineName,
      durationMs,
      ...(result.failureReason ? { failureReason: result.failureReason } : {}),
    });
}
