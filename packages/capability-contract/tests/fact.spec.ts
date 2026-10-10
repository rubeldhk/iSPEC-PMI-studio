/**
 * `T2115` (EPIC-039, `FR-HUB-023`) — a registry field is a value or a reason.
 * There is no third, blank shape: an empty reason does not type-check and is
 * refused at runtime.
 *
 * Written to FAIL before `T2116`.
 */
import { describe, expect, it } from 'vitest';
import { fact, isFact, notApplicable, type Fact } from '../src/fact.js';
import { COMMON_ERROR_CATEGORIES } from '../src/errors.js';
import { DERIVED_HEALTH_STATES, HEALTH_REASONS, HEALTH_STATES, deriveHealth } from '../src/health.js';

describe('T2115 · Fact<T>', () => {
  it('admits a value', () => {
    const f: Fact<string> = fact('1.0.0');
    expect(f).toEqual({ applicable: true, value: '1.0.0' });
  });

  it('admits a non-empty reason', () => {
    expect(notApplicable('inbound; liveness is observed by the client')).toEqual({ applicable: false, reason: 'inbound; liveness is observed by the client' });
  });

  it('refuses an empty or blank reason at runtime', () => {
    expect(() => notApplicable('')).toThrow(/reason/);
    expect(() => notApplicable('   ')).toThrow(/reason/);
  });

  it('refuses the blank shapes at compile time', () => {
    // @ts-expect-error — a Fact has no shape without value or reason.
    const blank: Fact<string> = { applicable: true };
    // @ts-expect-error — a not-applicable Fact must carry a reason.
    const silent: Fact<string> = { applicable: false };
    expect(isFact(blank)).toBe(false);
    expect(isFact(silent)).toBe(false);
    expect(isFact({ applicable: false, reason: '' })).toBe(false);
    expect(isFact(fact(0))).toBe(true);
  });
});

describe('T2116 · health and error vocabularies', () => {
  it('writes three health states; unknown is derived only', () => {
    expect([...HEALTH_STATES]).toEqual(['healthy', 'degraded', 'unhealthy']);
    expect([...DERIVED_HEALTH_STATES]).toEqual(['healthy', 'degraded', 'unhealthy', 'unknown']);
    expect(HEALTH_REASONS).toContain('credential-rejected');
    expect(HEALTH_REASONS).toContain('provider-throttled');
  });

  it('derives unknown from no check, and from a stale one (FR-HUB-027)', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(deriveHealth(null, now, 300)).toEqual({ state: 'unknown', reason: 'never-checked' });
    const fresh = { state: 'healthy' as const, checkedAt: new Date('2026-10-10T11:58:00Z') };
    expect(deriveHealth(fresh, now, 300)).toEqual({ state: 'healthy', checkedAt: fresh.checkedAt });
    const stale = { state: 'healthy' as const, checkedAt: new Date('2026-10-10T11:50:00Z') };
    expect(deriveHealth(stale, now, 300)).toEqual({ state: 'unknown', reason: 'stale (last checked 2026-10-10T11:50:00.000Z)', checkedAt: stale.checkedAt });
    const sick = { state: 'unhealthy' as const, reason: 'credential-rejected', checkedAt: new Date('2026-10-10T11:59:00Z') };
    expect(deriveHealth(sick, now, 300)).toEqual({ state: 'unhealthy', reason: 'credential-rejected', checkedAt: sick.checkedAt });
  });

  it('names the common error categories every capability shares', () => {
    expect([...COMMON_ERROR_CATEGORIES]).toEqual(['adapter-fault', 'provider-throttled', 'provider-unavailable', 'credential-rejected', 'not-found', 'timed-out']);
  });
});
