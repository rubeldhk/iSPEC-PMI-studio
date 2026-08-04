/**
 * T045 — cancellation and wall-clock timeout.
 *
 * FR-024 / FR-025 / FR-027. Every non-success outcome carries a NAMED reason and
 * NO value: there is no shape of this result that lets a caller persist a
 * partial artifact for a failed job.
 *
 * Framework-free (PC-1).
 */
import type { EngineFailureReason } from '@pmi/engine-contract';

export interface RunLimits {
  /** Hard wall-clock ceiling (FR-025). Also a cost control — RAID R-02. */
  timeoutMs: number;
  /** Caller-driven cancellation (FR-024). */
  signal?: AbortSignal;
}

export type RunOutcome<T> =
  | { outcome: 'succeeded'; value: T }
  | { outcome: 'failed'; reason: EngineFailureReason }
  | { outcome: 'cancelled'; reason: 'cancelled' }
  | { outcome: 'timed_out'; reason: 'timeout' };

/**
 * Run work under a cancellation signal and a hard time limit.
 *
 * The work receives a derived signal so it can stop cooperatively; the timer is
 * always cleared, so a completed run leaves nothing pending.
 */
export async function runWithLimits<T>(
  work: (signal: AbortSignal) => Promise<T>,
  limits: RunLimits,
): Promise<RunOutcome<T>> {
  if (limits.signal?.aborted) {
    return { outcome: 'cancelled', reason: 'cancelled' };
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled: RunOutcome<T> | undefined;

  const onOuterAbort = () => {
    settled ??= { outcome: 'cancelled', reason: 'cancelled' };
    controller.abort();
  };
  limits.signal?.addEventListener('abort', onOuterAbort, { once: true });

  const guard = new Promise<RunOutcome<T>>((resolve) => {
    timer = setTimeout(() => {
      settled ??= { outcome: 'timed_out', reason: 'timeout' };
      controller.abort();
      resolve(settled);
    }, limits.timeoutMs);

    controller.signal.addEventListener(
      'abort',
      () => {
        settled ??= { outcome: 'cancelled', reason: 'cancelled' };
        resolve(settled);
      },
      { once: true },
    );
  });

  const run = work(controller.signal).then(
    (value): RunOutcome<T> => settled ?? { outcome: 'succeeded', value },
    (): RunOutcome<T> => settled ?? { outcome: 'failed', reason: 'engine_error' },
  );

  try {
    return await Promise.race([run, guard]);
  } finally {
    if (timer) clearTimeout(timer);
    limits.signal?.removeEventListener('abort', onOuterAbort);
  }
}
