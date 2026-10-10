/**
 * `T2144` (EPIC-039, `FR-HUB-036`, `BR-0174`) — the explanation of one
 * resolution, in the two shapes it is read: the stored `reasons` (every
 * candidate, every condition) and the API's `refusal` view (each candidate and
 * the first condition it failed, with a sentence a reviewer can read).
 */
import type { CandidateEvaluation, EligibilityOutcome, IneligibilityReason } from '@pmi/capability-contract';

export interface CandidateView {
  readonly entryKey: string;
  readonly ineligibleBecause: IneligibilityReason | null;
  readonly detail: string | null;
}

export interface RefusalView {
  readonly code: string;
  readonly message: string;
  readonly candidates: readonly CandidateView[];
}

const SENTENCE: Readonly<Record<IneligibilityReason, string>> = {
  'not-in-build': 'the adapter is not present in this build',
  retired: 'the adapter is retired',
  'incompatible-major': 'it does not implement the requested major version',
  'not-configured': 'the project has not configured it for this capability',
  'credential-missing': 'its credential is not set',
  'health-unknown': 'its health is unknown (never checked, or stale)',
  'health-unhealthy': 'it is unhealthy',
  'health-degraded-not-permitted': 'it is degraded and the project does not permit degraded adapters',
  'environment-not-permitted': 'it is not permitted in this environment',
  'policy-pending': 'the policy decision for this configuration is still pending',
  'policy-not-permitted': 'policy does not permit it for this project and capability',
};

export function candidateViews(candidates: readonly CandidateEvaluation[]): CandidateView[] {
  return candidates.map((c) => {
    const failed = c.conditions.find((x) => !x.holds);
    return { entryKey: c.entryKey, ineligibleBecause: c.firstFailure ?? null, detail: failed?.detail ?? null };
  });
}

export function refusalMessage(outcome: Extract<EligibilityOutcome, { outcome: 'refused' }>, capability: string, major: number): string {
  if (outcome.code === 'ambiguous') {
    return `${capability} ${major}.x is ambiguous: ${outcome.ambiguousBetween!.join(' and ')} are both eligible at the same preference, and the project has expressed no order between them (FR-HUB-032).`;
  }
  if (outcome.code === 'no-compatible-adapter') {
    return outcome.candidates.length === 0
      ? `No adapter implementing ${capability} is listed for this workspace.`
      : `No listed adapter implements ${capability} at major ${major} (FR-HUB-033).`;
  }
  const parts = outcome.candidates.map((c) => `${c.entryKey}: ${c.firstFailure ? SENTENCE[c.firstFailure] : 'eligible'}`);
  return `No adapter is eligible for ${capability} ${major}.x — ${parts.join('; ')}. Refused at once: nothing is queued, retried or sent elsewhere (FR-HUB-035).`;
}

export function storedReasons(outcome: EligibilityOutcome, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...(outcome.outcome === 'resolved' ? { rule: outcome.rule, chosen: outcome.chosen, eligibleBecause: outcome.eligibleBecause } : { rule: outcome.code, ...(outcome.ambiguousBetween ? { ambiguousBetween: outcome.ambiguousBetween } : {}) }),
    candidates: outcome.candidates,
    excluded: outcome.excluded,
    ...extra,
  };
}
