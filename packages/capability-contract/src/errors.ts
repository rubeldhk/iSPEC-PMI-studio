/**
 * `T2116` (EPIC-039) — the error categories every capability shares
 * (`contracts/capability-contract.md` §1). Each contract adds its own on top;
 * the set per version is closed.
 */
export const COMMON_ERROR_CATEGORIES = Object.freeze([
  'adapter-fault',
  'provider-throttled',
  'provider-unavailable',
  'credential-rejected',
  'not-found',
  'timed-out',
] as const);
export type CommonErrorCategory = (typeof COMMON_ERROR_CATEGORIES)[number];
