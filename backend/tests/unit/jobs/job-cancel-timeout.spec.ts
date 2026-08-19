/**
 * T044 — cancellation and timeout produce `cancelled` / `timeout`, no artifact.
 * Written to FAIL before T045 exists (Constitution V).
 *
 * FR-024, FR-025, FR-027, SC-006.
 */
import { describe, expect, it, vi } from 'vitest';
import { runWithLimits } from '../../../src/modules/jobs/job-runner.service.js';

const never = () => new Promise<string>(() => {});

describe('runWithLimits()', () => {
  it('returns the value when work finishes inside the limit', async () => {
    const r = await runWithLimits(async () => 'done', { timeoutMs: 1000 });
    expect(r).toEqual({ outcome: 'succeeded', value: 'done' });
  });

  it('times out with reason "timeout" and no artifact', async () => {
    const r = await runWithLimits(never, { timeoutMs: 20 });
    expect(r).toEqual({ outcome: 'timed_out', reason: 'timeout' });
    expect(r).not.toHaveProperty('value');
  });

  it('cancels with reason "cancelled" and no artifact', async () => {
    const controller = new AbortController();
    const p = runWithLimits(never, { timeoutMs: 5000, signal: controller.signal });
    controller.abort();
    const r = await p;
    expect(r).toEqual({ outcome: 'cancelled', reason: 'cancelled' });
  });

  it('returns immediately if already cancelled before starting', async () => {
    const controller = new AbortController();
    controller.abort();
    const work = vi.fn(async () => 'x');
    const r = await runWithLimits(work, { timeoutMs: 5000, signal: controller.signal });
    expect(r.outcome).toBe('cancelled');
    expect(work).not.toHaveBeenCalled();
  });

  it('signals the work so it can stop cooperatively (E4)', async () => {
    let observed: AbortSignal | undefined;
    const controller = new AbortController();
    const p = runWithLimits(
      async (signal) => {
        observed = signal;
        return new Promise<string>(() => {});
      },
      { timeoutMs: 5000, signal: controller.signal },
    );
    controller.abort();
    await p;
    expect(observed?.aborted).toBe(true);
  });

  it('maps a thrown error to failed with reason "engine_error"', async () => {
    const r = await runWithLimits(
      async () => {
        throw new Error('boom');
      },
      { timeoutMs: 1000 },
    );
    expect(r).toEqual({ outcome: 'failed', reason: 'engine_error' });
  });

  it('does not leave a pending timer behind after resolving', async () => {
    // A leaked timer keeps the process alive; vitest would hang on teardown.
    const before = process.listenerCount('unhandledRejection');
    await runWithLimits(async () => 'ok', { timeoutMs: 50 });
    await new Promise((r) => setTimeout(r, 80));
    expect(process.listenerCount('unhandledRejection')).toBe(before);
  });
});
