/**
 * `T2180` (EPIC-039, `FR-HUB-034`, `BR-0124` enforced here) — least privilege at
 * resolution.
 *
 * The resolver grants the adapter only the provider permissions its scope
 * mapping gives for the resources the **contract** requires. How far the
 * credential itself can be narrowed depends on its kind:
 *
 * | Credential kind narrowing | Recorded as |
 * |---|---|
 * | `per-request` (a GitHub App token minted for this call) | `exact` |
 * | `at-issue` (a Resend key) | what the last health probe established — `narrowed-at-issue`, or `not-narrowable` for a full-access key |
 * | `none` (a classic token) | `not-narrowable` |
 * | no credential at all | `exact` — there is nothing wider to hold |
 *
 * `not-narrowable` follows the configuration's `onNotNarrowable`, which defaults
 * to `refuse` for a state-changing capability and `proceed-and-record`
 * otherwise.
 */
import type { AdapterDescriptor, CapabilityContractDocument, ScopeGrant } from '@pmi/capability-contract';

export type Narrowing = ScopeGrant['narrowing'];

export function defaultOnNotNarrowable(contract: Pick<CapabilityContractDocument, 'changesState'>): 'refuse' | 'proceed-and-record' {
  return contract.changesState ? 'refuse' : 'proceed-and-record';
}

export interface ScopeDecision {
  readonly grant: ScopeGrant;
  readonly proceed: boolean;
  readonly reason?: string;
}

export function grantScope(
  contract: Pick<CapabilityContractDocument, 'requiredScope' | 'changesState'>,
  descriptor: AdapterDescriptor,
  credentialKind: string | null,
  observedNarrowing: Narrowing | null,
  onNotNarrowable: 'refuse' | 'proceed-and-record' | null,
): ScopeDecision {
  const granted = contract.requiredScope.resources.flatMap((r) => descriptor.scopeMapping[r] ?? []);
  let narrowing: Narrowing;
  if (credentialKind === null) narrowing = 'exact';
  else {
    const kind = descriptor.credentialKinds.find((k) => k.kind === credentialKind);
    if (kind === undefined || kind.narrowing === 'none') narrowing = 'not-narrowable';
    else if (kind.narrowing === 'per-request') narrowing = 'exact';
    else narrowing = observedNarrowing === 'narrowed-at-issue' || observedNarrowing === 'exact' ? 'narrowed-at-issue' : 'not-narrowable';
  }
  const grant: ScopeGrant = { requested: { access: contract.requiredScope.access, resources: [...contract.requiredScope.resources] }, granted, narrowing };
  if (narrowing !== 'not-narrowable') return { grant, proceed: true };
  const policy = onNotNarrowable ?? defaultOnNotNarrowable(contract);
  return policy === 'refuse'
    ? { grant, proceed: false, reason: `the ${credentialKind ?? 'credential'} cannot be narrowed to ${contract.requiredScope.resources.join(', ')}, and the configuration refuses a credential wider than the capability needs (FR-HUB-034)` }
    : { grant, proceed: true, reason: 'not narrowable — proceeding and recording, as configured' };
}
