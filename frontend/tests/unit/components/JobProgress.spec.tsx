/**
 * T084a — the job progress indicator polls without blocking interaction.
 * Written to FAIL before T085 exists (Constitution V).
 *
 * FR-028: a running job never blocks other platform use — so the indicator is
 * an inline element, not a modal, and its polling stops the moment the job
 * reaches a terminal state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { JobProgress } from '../../../src/components/JobProgress';
import type { ApiClient, Job } from '../../../src/services/api';

function job(state: Job['state'], failureReason: Job['failureReason'] = null): Job {
  return { id: 'job1', kind: 'generate_specification', state, failureReason, startedAt: null, resultRef: null };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('JobProgress (FR-028)', () => {
  it('polls the job on an interval', async () => {
    const getJob = vi.fn(async () => job('running'));
    const api = { getJob } as unknown as ApiClient;
    render(<JobProgress api={api} jobId="job1" pollMs={1000} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    // Initial fetch + three interval polls.
    expect(getJob.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('STOPS polling once the job is terminal', async () => {
    const getJob = vi
      .fn<() => Promise<Job>>()
      .mockResolvedValueOnce(job('running'))
      .mockResolvedValue(job('succeeded'));
    const api = { getJob } as unknown as ApiClient;
    render(<JobProgress api={api} jobId="job1" pollMs={1000} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    const callsAtTerminal = getJob.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(getJob.mock.calls.length).toBe(callsAtTerminal);
    expect(screen.getByText(/succeeded/i)).toBeDefined();
  });

  it('is INLINE — no dialog, nothing that could block the rest of the UI', async () => {
    const api = { getJob: vi.fn(async () => job('running')) } as unknown as ApiClient;
    render(<JobProgress api={api} jobId="job1" pollMs={1000} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(/running/i)).toBeDefined();
  });

  it('a failed job shows its distinguishable reason (FR-026)', async () => {
    const api = {
      getJob: vi.fn(async () => job('failed', 'engine_unavailable')),
    } as unknown as ApiClient;
    render(<JobProgress api={api} jobId="job1" pollMs={1000} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByText(/engine_unavailable/)).toBeDefined();
  });
});
