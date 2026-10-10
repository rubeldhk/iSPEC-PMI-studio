/**
 * `T722` — the three risk bands. `FR-DPE-010`.
 *
 * Three members, no fourth, no `unknown`: `FR-DPE-004` gives an unclassified
 * action the most restrictive band rather than a band of its own, and an
 * `unknown` member would be the first thing a permissive default attached to.
 */
export const RISK_BANDS = Object.freeze(['low', 'medium', 'high'] as const);

export type RiskBand = (typeof RISK_BANDS)[number];

/** `FR-DPE-004` — what an action no rule classifies is treated as. */
export const MOST_RESTRICTIVE_BAND: RiskBand = 'high';

export function isRiskBand(candidate: unknown): candidate is RiskBand {
  return typeof candidate === 'string' && (RISK_BANDS as readonly string[]).includes(candidate);
}
