/**
 * T046 — the worker consumer.
 *
 * Claims a job, resolves the engine, runs it under limits, and persists the
 * result. Two guarantees carry the weight:
 *
 *   SUCCESS  — specification, version, traceability links and the terminal
 *              state commit in ONE transaction. A crash mid-write leaves no
 *              orphan specification, which is what makes SC-002 structurally
 *              true rather than defended by a cleanup job.
 *
 *   FAILURE  — nothing but the terminal state is written (FR-027, SC-006).
 *
 * The worker is also the ONLY component that may hold a concrete engine:
 * `backend/` never does (FR-017, ADR-0001).
 */
import type {
  EngineFailureReason,
  RequirementInput,
  SpecificationEngine,
} from '@pmi/engine-contract';

export interface GenerationJobPayload {
  id: string;
  workspaceId: string;
  projectId: string;
  requestedById: string;
  correlationId: string;
  projectName: string;
  requirements: RequirementInput[];
}

export interface PersistenceTx {
  write(row: Record<string, unknown>): Promise<void>;
}

export interface JobPersistence {
  transaction<T>(fn: (tx: PersistenceTx) => Promise<T>): Promise<T>;
}

export interface ConsumeLimits {
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface ConsumeResult {
  state: 'succeeded' | 'failed' | 'cancelled' | 'timed_out';
  failureReason?: EngineFailureReason;
}

/** Which terminal state a given failure reason produces. */
function stateFor(reason: EngineFailureReason): ConsumeResult['state'] {
  if (reason === 'cancelled') return 'cancelled';
  if (reason === 'timeout') return 'timed_out';
  return 'failed';
}

export async function consumeGenerationJob(
  job: GenerationJobPayload,
  engine: SpecificationEngine,
  persistence: JobPersistence,
  limits: ConsumeLimits,
): Promise<ConsumeResult> {
  // E7: decided before the engine is touched, so an obviously invalid request
  // never becomes a billed run.
  if (job.requirements.length === 0) {
    return terminal(persistence, job, 'empty_selection');
  }
  if (limits.signal?.aborted) {
    return terminal(persistence, job, 'cancelled');
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  limits.signal?.addEventListener('abort', onAbort, { once: true });

  // Why a flag rather than inspecting the signal afterwards: the engine is
  // told to stop the same way in both cases, so it reports `cancelled` either
  // way. Only the worker knows WHICH clock ran out, and reporting a timeout as
  // a user cancellation would misattribute a cost overrun as a user action.
  let timedOutByLimit = false;
  const timer = setTimeout(() => {
    timedOutByLimit = true;
    controller.abort();
  }, limits.timeoutMs);

  /** Reclassify the engine's `cancelled` when it was our limit that fired. */
  const attribute = (reason: EngineFailureReason): EngineFailureReason =>
    reason === 'cancelled' && timedOutByLimit && !limits.signal?.aborted ? 'timeout' : reason;

  try {
    const result = await engine.generateSpecification(
      { projectName: job.projectName, requirements: job.requirements },
      {
        signal: controller.signal,
        timeoutMs: limits.timeoutMs,
        // PC-3: the correlation id crosses INTO the engine (and its sandbox).
        correlationId: job.correlationId,
      },
    );

    if (!result.ok) {
      return terminal(persistence, job, attribute(result.failure.reason));
    }
    if (limits.signal?.aborted) return terminal(persistence, job, 'cancelled');
    if (timedOutByLimit) return terminal(persistence, job, 'timeout');

    // One transaction: artifact + links + terminal state.
    await persistence.transaction(async (tx) => {
      await tx.write({
        kind: 'specification',
        jobId: job.id,
        workspaceId: job.workspaceId,
        projectId: job.projectId,
        title: result.value.title,
        engineName: result.producedBy.name,
        engineVersion: result.producedBy.version,
      });
      await tx.write({
        kind: 'specification_version',
        jobId: job.id,
        versionNumber: 1,
        contentRaw: result.value.contentRaw,
        contentParsed: result.value.contentParsed,
      });
      await tx.write({
        kind: 'traceability_link',
        jobId: job.id,
        relationship: 'generated_from',
        requirementRefs: job.requirements.map((r) => r.reference),
      });
      await tx.write({ kind: 'job_state', jobId: job.id, state: 'succeeded' });
    });

    return { state: 'succeeded' };
  } catch {
    return terminal(persistence, job, 'engine_error');
  } finally {
    clearTimeout(timer);
    limits.signal?.removeEventListener('abort', onAbort);
  }
}

/** Write ONLY the terminal state. No artifact, ever (FR-027, SC-006). */
async function terminal(
  persistence: JobPersistence,
  job: GenerationJobPayload,
  reason: EngineFailureReason,
): Promise<ConsumeResult> {
  const state = stateFor(reason);
  await persistence.transaction(async (tx) => {
    await tx.write({ kind: 'job_state', jobId: job.id, state, failureReason: reason });
  });
  return { state, failureReason: reason };
}
