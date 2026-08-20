/**
 * T085 — inline job progress indicator (US3/US4, FR-026/FR-028).
 *
 * FR-028: a running job never blocks the rest of the platform, so this is an
 * inline element (no dialog) that polls and goes quiet at a terminal state.
 */
import { useEffect, useState, type ReactElement } from 'react';
import type { ApiClient, Job } from '../services/api';

const TERMINAL: ReadonlySet<Job['state']> = new Set(['succeeded', 'failed', 'cancelled', 'timed_out']);

export interface JobProgressProps {
  api: ApiClient;
  jobId: string;
  pollMs?: number;
  /** Called once, when the job first reaches a terminal state. */
  onSettled?: (job: Job) => void;
}

export function JobProgress({ api, jobId, pollMs = 2000, onSettled }: JobProgressProps): ReactElement {
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function poll(): Promise<void> {
      let latest: Job;
      try {
        latest = await api.getJob(jobId);
      } catch {
        return; // transient fetch failure — the next tick retries
      }
      if (cancelled) return;
      setJob(latest);
      if (TERMINAL.has(latest.state)) {
        if (timer !== null) clearInterval(timer);
        timer = null;
        onSettled?.(latest);
      }
    }

    void poll();
    timer = setInterval(() => void poll(), pollMs);
    return () => {
      cancelled = true;
      if (timer !== null) clearInterval(timer);
    };
    // onSettled intentionally excluded: re-subscribing on every render of the
    // parent would reset the poll cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, jobId, pollMs]);

  if (job === null) return <span>Checking job…</span>;
  return (
    <span>
      {job.kind}: {job.state}
      {job.state === 'failed' && job.failureReason !== null && <> — {job.failureReason}</>}
    </span>
  );
}
