/**
 * `T2137` (EPIC-039, `R-039-6`) — the periodic mechanism the repository did not
 * have. A port with two bindings: an unref'd timer in production, a manual
 * ticker in tests. `PMI_INTEGRATION_SCHEDULER=off` starts nothing.
 *
 * Written to FAIL before `T2138`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManualTicker, TimerTicker, tickerFromEnvironment } from '../../src/modules/integrations/health/ticker.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('T2137 · the manual ticker', () => {
  it('runs the callbacks only when advanced', async () => {
    const t = new ManualTicker();
    const seen: string[] = [];
    t.start(30_000, async () => {
      seen.push('health');
    });
    t.start(120_000, async () => {
      seen.push('intake');
    });
    expect(seen).toEqual([]);
    await t.advance();
    expect(seen).toEqual(['health', 'intake']);
    t.stop();
    await t.advance();
    expect(seen).toEqual(['health', 'intake']);
  });
});

describe('T2137 · the timer ticker', () => {
  it('is unref\'d, so it never holds the process open, and stops', async () => {
    vi.useFakeTimers();
    const t = new TimerTicker();
    let n = 0;
    t.start(1000, async () => {
      n += 1;
    });
    expect(t.handles().every((h) => typeof h.hasRef === 'function' && h.hasRef() === false)).toBe(true);
    await vi.advanceTimersByTimeAsync(3100);
    expect(n).toBe(3);
    t.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(n).toBe(3);
  });

  it('never runs two ticks of one job at once — a slow tick is skipped, not stacked', async () => {
    vi.useFakeTimers();
    const t = new TimerTicker();
    let running = 0;
    let max = 0;
    t.start(100, async () => {
      running += 1;
      max = Math.max(max, running);
      await new Promise((r) => setTimeout(r, 350));
      running -= 1;
    });
    await vi.advanceTimersByTimeAsync(1000);
    t.stop();
    expect(max).toBe(1);
  });
});

describe('T2137 · PMI_INTEGRATION_SCHEDULER', () => {
  it('off starts nothing', () => {
    const t = tickerFromEnvironment({ PMI_INTEGRATION_SCHEDULER: 'off' });
    t.start(1000, async () => undefined);
    expect(t.handles()).toEqual([]);
  });

  it('manual is the ManualTicker a route test advances', () => {
    expect(tickerFromEnvironment({ PMI_INTEGRATION_SCHEDULER: 'manual' })).toBeInstanceOf(ManualTicker);
  });

  it('anything else is the timer', () => {
    expect(tickerFromEnvironment({})).toBeInstanceOf(TimerTicker);
  });
});
