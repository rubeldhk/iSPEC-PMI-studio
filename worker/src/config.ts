/**
 * T147a — the job wall-clock limit, as configuration with a QUANTIFIED default.
 *
 * SC-011 / FR-025 (quantified 2026-08-07): generation requests complete or
 * report a named failure within the configured limit — **10 minutes by
 * default**. The default lived inline in `main.ts` as 15 minutes, where no
 * test could see it; now it is here, asserted by
 * `worker/tests/unit/job-timeout-default.spec.ts`.
 */
export const DEFAULT_JOB_TIMEOUT_MS = 10 * 60 * 1000;

/** Resolve the limit from the environment; garbage never becomes NaN. */
export function resolveJobTimeoutMs(env: Record<string, string | undefined>): number {
  const raw = Number(env['JOB_TIMEOUT_MS']);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_JOB_TIMEOUT_MS;
}
