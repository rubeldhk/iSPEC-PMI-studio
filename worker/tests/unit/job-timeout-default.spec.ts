/**
 * T147a (config half) — the wall-clock limit's DEFAULT is the quantified one.
 *
 * SC-011 / FR-025 (quantified 2026-08-07): generation requests resolve within
 * the configured wall-clock limit, **10 minutes by default**. Written to FAIL
 * first (Constitution V): at authoring time the worker hard-coded
 * `15 * 60 * 1000` inline in `main.ts` — a default that contradicted the
 * requirement and that no test could see.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_JOB_TIMEOUT_MS, resolveJobTimeoutMs } from '../../src/config.js';

describe('the job wall-clock default (SC-011, FR-025)', () => {
  it('is exactly the quantified 10 minutes', () => {
    expect(DEFAULT_JOB_TIMEOUT_MS).toBe(10 * 60 * 1000);
  });

  it('an operator can raise or lower it via JOB_TIMEOUT_MS', () => {
    expect(resolveJobTimeoutMs({ JOB_TIMEOUT_MS: '120000' })).toBe(120_000);
  });

  it('an absent or garbage value falls back to the default, never NaN', () => {
    expect(resolveJobTimeoutMs({})).toBe(DEFAULT_JOB_TIMEOUT_MS);
    expect(resolveJobTimeoutMs({ JOB_TIMEOUT_MS: 'soon' })).toBe(DEFAULT_JOB_TIMEOUT_MS);
    expect(resolveJobTimeoutMs({ JOB_TIMEOUT_MS: '-1' })).toBe(DEFAULT_JOB_TIMEOUT_MS);
    expect(resolveJobTimeoutMs({ JOB_TIMEOUT_MS: '0' })).toBe(DEFAULT_JOB_TIMEOUT_MS);
  });
});
