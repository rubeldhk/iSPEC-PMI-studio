/**
 * `T2116` (EPIC-039, `FR-HUB-026`, `FR-HUB-027`, `R-039-6`) — health.
 *
 * Three states are **written**; `unknown` is only ever **derived** — from no
 * check, or from one older than the interval. Nothing stores "healthy" that
 * could still read healthy after it went stale.
 */
export const HEALTH_STATES = Object.freeze(['healthy', 'degraded', 'unhealthy'] as const);
export type WrittenHealthState = (typeof HEALTH_STATES)[number];

export const DERIVED_HEALTH_STATES = Object.freeze(['healthy', 'degraded', 'unhealthy', 'unknown'] as const);
export type HealthState = (typeof DERIVED_HEALTH_STATES)[number];

/** The closed list of reasons a written non-healthy check may carry. */
export const HEALTH_REASONS = Object.freeze([
  'credential-rejected',
  'credential-missing',
  'provider-throttled',
  'provider-unreachable',
  'provider-error',
  'not-configured',
  'scope-wider-than-declared',
  'model-not-present',
  'model-version-changed',
  'model-not-listed',
  'binding-invalid',
  'timed-out',
] as const);
export type HealthReason = (typeof HEALTH_REASONS)[number];

/** What an adapter's `checkHealth` returns. Never `unknown`. */
export interface HealthObservation {
  readonly state: WrittenHealthState;
  readonly reason?: HealthReason;
  /** Provider message — sanitised by the Hub before it is stored. */
  readonly detail?: string;
  readonly retryAfterSeconds?: number;
  /** `Embed`: the model version observed (`FR-HUB-082`). */
  readonly modelVersion?: string;
  /** Resend-style keys: whether the credential is narrower than full access (`FR-HUB-034`). */
  readonly narrowing?: 'exact' | 'narrowed-at-issue' | 'not-narrowable';
}

export interface LatestCheck {
  readonly state: WrittenHealthState;
  readonly reason?: string;
  readonly checkedAt: Date;
}

export interface DerivedHealth {
  readonly state: HealthState;
  readonly reason?: string;
  readonly checkedAt?: Date;
}

/** Current health at `now`, from the latest check and the interval (`FR-HUB-027`). */
export function deriveHealth(latest: LatestCheck | null, now: Date, intervalSeconds: number): DerivedHealth {
  if (latest === null) return { state: 'unknown', reason: 'never-checked' };
  if (now.getTime() - latest.checkedAt.getTime() > intervalSeconds * 1000) {
    return { state: 'unknown', reason: `stale (last checked ${latest.checkedAt.toISOString()})`, checkedAt: latest.checkedAt };
  }
  return latest.reason === undefined || latest.state === 'healthy'
    ? { state: latest.state, checkedAt: latest.checkedAt }
    : { state: latest.state, reason: latest.reason, checkedAt: latest.checkedAt };
}
