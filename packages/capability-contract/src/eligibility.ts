/**
 * `T2120` (EPIC-039, `R-039-7`) — the Capability Resolver's pure core.
 *
 * `evaluateCandidates` is **total**: every condition of `FR-HUB-031` is
 * evaluated for every candidate, in one fixed order, and each candidate's
 * record lists every condition with its result and names the first failure.
 * That is what makes a refusal explainable candidate by candidate
 * (`FR-HUB-036`, `BR-0174`) and what stops a later edit from short-circuiting a
 * condition for one candidate and silently skipping it.
 *
 * No retry, no queue, no fallback (`FR-HUB-035`): the function decides, and the
 * caller records what it decided before any provider is called.
 */
import type { HealthState } from './health.js';
import type { CapabilityName } from './vocabulary.js';

export const ELIGIBILITY_CONDITIONS = Object.freeze(['in-build', 'active', 'implements-major', 'configured', 'credential', 'health', 'environment', 'policy'] as const);
export type EligibilityCondition = (typeof ELIGIBILITY_CONDITIONS)[number];

/** Per-candidate ineligibility reasons (data-model §6 `reasons`). */
export type IneligibilityReason =
  | 'not-in-build'
  | 'retired'
  | 'incompatible-major'
  | 'not-configured'
  | 'credential-missing'
  | 'health-unknown'
  | 'health-unhealthy'
  | 'health-degraded-not-permitted'
  | 'environment-not-permitted'
  | 'policy-pending'
  | 'policy-not-permitted';

export type RefusalCode =
  | 'unknown-capability'
  | 'provider-pinned'
  | 'caller-not-platform'
  | 'no-compatible-adapter'
  | 'no-eligible-adapter'
  | 'ambiguous'
  | 'scope-not-narrowable'
  | 'policy-seam-unbound'
  | 'credential-material-in-content'
  | 'invalid-input'
  | 'batch-too-large'
  | 'text-too-long';

export type PolicyStatus = 'permitted' | 'pending' | 'not-permitted' | 'not-applicable';

export interface CandidateFacts {
  readonly entryKey: string;
  readonly registryEntryId?: string;
  readonly direction: 'outbound' | 'inbound';
  readonly inBuild: boolean;
  readonly active: boolean;
  readonly majors: readonly number[];
  readonly configured: boolean;
  /** 1 = most preferred; null when not configured. */
  readonly preference: number | null;
  readonly credential: 'present' | 'missing' | 'not-required';
  readonly health: { readonly state: HealthState; readonly reason?: string };
  readonly permitDegraded: boolean;
  readonly environmentPermitted: boolean;
  readonly policy: { readonly status: PolicyStatus; readonly reason?: string; readonly explanation?: unknown };
}

export interface ConditionResult {
  readonly condition: EligibilityCondition;
  readonly holds: boolean;
  readonly reason?: IneligibilityReason;
  readonly detail?: string;
  /** The policy condition carries `EPIC-031`'s explanation verbatim. */
  readonly explanation?: unknown;
}

export interface CandidateEvaluation {
  readonly entryKey: string;
  readonly registryEntryId?: string;
  readonly eligible: boolean;
  readonly firstFailure?: IneligibilityReason;
  readonly preference: number | null;
  readonly conditions: readonly ConditionResult[];
}

export interface ExcludedCandidate {
  readonly entryKey: string;
  readonly reason: string;
}

export type EligibilityOutcome =
  | {
      readonly outcome: 'resolved';
      readonly chosen: string;
      readonly rule: 'only-eligible' | 'configured-preference';
      readonly eligibleBecause: readonly EligibilityCondition[];
      readonly candidates: readonly CandidateEvaluation[];
      readonly excluded: readonly ExcludedCandidate[];
    }
  | {
      readonly outcome: 'refused';
      readonly code: 'no-compatible-adapter' | 'no-eligible-adapter' | 'ambiguous';
      readonly ambiguousBetween?: readonly string[];
      readonly candidates: readonly CandidateEvaluation[];
      readonly excluded: readonly ExcludedCandidate[];
    };

function evaluate(major: number, c: CandidateFacts): CandidateEvaluation {
  const healthResult = (): ConditionResult => {
    const detail = c.health.reason;
    switch (c.health.state) {
      case 'healthy':
        return { condition: 'health', holds: true };
      case 'degraded':
        return c.permitDegraded
          ? { condition: 'health', holds: true, detail: `degraded, permitted by the project${detail ? ` (${detail})` : ''}` }
          : { condition: 'health', holds: false, reason: 'health-degraded-not-permitted', ...(detail ? { detail } : {}) };
      case 'unhealthy':
        return { condition: 'health', holds: false, reason: 'health-unhealthy', ...(detail ? { detail } : {}) };
      case 'unknown':
        return { condition: 'health', holds: false, reason: 'health-unknown', ...(detail ? { detail } : {}) };
    }
  };
  const policyResult = (): ConditionResult => {
    const extra = { ...(c.policy.reason ? { detail: c.policy.reason } : {}), ...(c.policy.explanation !== undefined ? { explanation: c.policy.explanation } : {}) };
    switch (c.policy.status) {
      case 'permitted':
      case 'not-applicable':
        return { condition: 'policy', holds: true, ...extra };
      case 'pending':
        return { condition: 'policy', holds: false, reason: 'policy-pending', ...extra };
      case 'not-permitted':
        return { condition: 'policy', holds: false, reason: 'policy-not-permitted', ...extra };
    }
  };
  const conditions: ConditionResult[] = [
    c.inBuild ? { condition: 'in-build', holds: true } : { condition: 'in-build', holds: false, reason: 'not-in-build', detail: 'adapter not present in this build' },
    c.active ? { condition: 'active', holds: true } : { condition: 'active', holds: false, reason: 'retired' },
    c.majors.includes(major)
      ? { condition: 'implements-major', holds: true }
      : { condition: 'implements-major', holds: false, reason: 'incompatible-major', detail: `implements ${c.majors.length === 0 ? 'no major' : c.majors.join(', ')}; requested ${major}` },
    c.configured ? { condition: 'configured', holds: true } : { condition: 'configured', holds: false, reason: 'not-configured' },
    c.credential === 'missing' ? { condition: 'credential', holds: false, reason: 'credential-missing' } : { condition: 'credential', holds: true, ...(c.credential === 'not-required' ? { detail: 'no credential required' } : {}) },
    healthResult(),
    c.environmentPermitted ? { condition: 'environment', holds: true } : { condition: 'environment', holds: false, reason: 'environment-not-permitted' },
    policyResult(),
  ];
  const first = conditions.find((x) => !x.holds);
  return {
    entryKey: c.entryKey,
    ...(c.registryEntryId !== undefined ? { registryEntryId: c.registryEntryId } : {}),
    eligible: first === undefined,
    ...(first?.reason !== undefined ? { firstFailure: first.reason } : {}),
    preference: c.preference,
    conditions,
  };
}

/** Bind a request to exactly one eligible adapter, or refuse with every candidate explained. */
export function evaluateCandidates(request: { readonly capability: CapabilityName; readonly major: number }, all: readonly CandidateFacts[]): EligibilityOutcome {
  const excluded: ExcludedCandidate[] = all
    .filter((c) => c.direction !== 'outbound')
    .map((c) => ({ entryKey: c.entryKey, reason: 'inbound connector — never a resolution candidate (FR-HUB-022)' }));
  const candidates = all.filter((c) => c.direction === 'outbound').map((c) => evaluate(request.major, c));

  const compatible = candidates.filter((c) => c.conditions.find((x) => x.condition === 'implements-major')!.holds && c.conditions[0]!.holds);
  if (compatible.length === 0) return { outcome: 'refused', code: 'no-compatible-adapter', candidates, excluded };

  const eligible = candidates.filter((c) => c.eligible);
  if (eligible.length === 0) return { outcome: 'refused', code: 'no-eligible-adapter', candidates, excluded };
  if (eligible.length === 1) {
    return { outcome: 'resolved', chosen: eligible[0]!.entryKey, rule: 'only-eligible', eligibleBecause: [...ELIGIBILITY_CONDITIONS], candidates, excluded };
  }
  const ranked = eligible.map((c) => ({ key: c.entryKey, p: c.preference ?? Number.POSITIVE_INFINITY }));
  const best = Math.min(...ranked.map((r) => r.p));
  const top = ranked.filter((r) => r.p === best).map((r) => r.key);
  if (top.length > 1 || best === Number.POSITIVE_INFINITY) {
    return { outcome: 'refused', code: 'ambiguous', ambiguousBetween: top, candidates, excluded };
  }
  return { outcome: 'resolved', chosen: top[0]!, rule: 'configured-preference', eligibleBecause: [...ELIGIBILITY_CONDITIONS], candidates, excluded };
}
