/**
 * T721 — the band set, written to fail first. `FR-DPE-010`, `FR-DPE-004`.
 *
 * Three members, no fourth, **no `unknown`**. `FR-DPE-004` gives an
 * unclassified action the most restrictive band rather than a band of its own:
 * an `unknown` member would be a fourth treatment nobody specified, and the
 * first thing a permissive default would attach to.
 */
import { describe, expect, it } from 'vitest';
import { MOST_RESTRICTIVE_BAND, RISK_BANDS, isRiskBand, type RiskBand } from '../src/bands.js';

describe('T721 · FR-DPE-010 — exactly three bands', () => {
  it('names low, medium and high, in that order', () => {
    expect(RISK_BANDS).toEqual(['low', 'medium', 'high']);
  });

  it('has no fourth member and no unknown', () => {
    expect(RISK_BANDS).toHaveLength(3);
    expect(RISK_BANDS as readonly string[]).not.toContain('unknown');
    expect(Object.isFrozen(RISK_BANDS)).toBe(true);
  });

  it('rejects unknown at compile time', () => {
    // @ts-expect-error — 'unknown' is not a band.
    const bad: RiskBand = 'unknown';
    expect(bad).toBeDefined();
  });

  it('recognises only the three at runtime', () => {
    expect(['low', 'medium', 'high', 'unknown', 'HIGH', ''].filter(isRiskBand)).toEqual(['low', 'medium', 'high']);
  });
});

describe('T721 · FR-DPE-004 — the most restrictive band is a band', () => {
  it('is high', () => {
    expect(MOST_RESTRICTIVE_BAND).toBe('high');
  });
});
