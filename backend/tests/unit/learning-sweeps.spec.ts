/**
 * `T2359` (EPIC-048) — the sweep schedule is off unless the deployment turns it
 * on, schedules every job when it is, and leaves nothing running on shutdown.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEARNING_JOB_INTERVALS_MS, LEARNING_JOB_NAMES } from '../../src/modules/learning/learning.jobs.js';
import { LearningSweeps } from '../../src/modules/learning/learning.sweeps.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('T2359 · LearningSweeps', () => {
  it('is off by default — nothing is scheduled', () => {
    const sweeps = new LearningSweeps({ run: vi.fn() }, false);
    sweeps.onApplicationBootstrap();
    expect(sweeps.scheduled).toBe(0);
  });

  it('when on, runs each job at its interval, one run at a time, and stops on shutdown', async () => {
    vi.useFakeTimers();
    let release: () => void = () => undefined;
    const run = vi.fn((_name: string) => new Promise<never>((resolve) => { release = () => resolve(undefined as never); }));
    const sweeps = new LearningSweeps({ run }, true);
    sweeps.onApplicationBootstrap();
    expect(sweeps.scheduled).toBe(LEARNING_JOB_NAMES.length);
    await vi.advanceTimersByTimeAsync(LEARNING_JOB_INTERVALS_MS['learning.resolve-decisions'] * 2);
    // The second tick found the first run still going and skipped rather than stacked.
    expect(run.mock.calls.filter(([n]) => n === 'learning.resolve-decisions')).toHaveLength(1);
    release();
    sweeps.onModuleDestroy();
    expect(sweeps.scheduled).toBe(0);
  });

  it('declares the five jobs of contracts/learning-api.md at their intervals', () => {
    expect(LEARNING_JOB_INTERVALS_MS).toEqual({
      'learning.resolve-decisions': 30_000,
      'learning.request-pending': 60_000,
      'learning.expire': 3_600_000,
      'learning.flags': 3_600_000,
      'learning.retrievability': 600_000,
    });
  });
});
