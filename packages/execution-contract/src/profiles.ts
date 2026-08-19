/**
 * T549, T585 — the named egress profiles.
 *
 * `generation` is FROZEN. `SC-AGT-005` asserts it is byte-for-byte what
 * `ADR-0002` specifies, and `generation-egress-frozen.spec.ts` asserts the
 * sandbox manifest and its existing test are unchanged from `main`. An epic
 * that widens a security boundary has to prove which half it did **not** touch.
 */
import type { EgressProfile } from './index.js';

/**
 * The only destination a specification-generating agent needs.
 *
 * Sourced from `engine-adapters/speckit/docker/sandbox.json`, which
 * `sandbox-config.spec.ts` has asserted since EPIC-003. Do not widen this: an
 * implementation agent's needs belong to the profile below.
 */
export const GENERATION_EGRESS_PROFILE: EgressProfile = Object.freeze({
  name: 'generation',
  allowedDestinations: Object.freeze(['api.anthropic.com']) as readonly string[],
  enforcement: 'network-policy',
});

/**
 * Deliberately minimal — one destination, identical to `generation`.
 *
 * `R-028-6`, confirmed 2026-08-14: registry hostnames vary by ecosystem, mirror
 * and tenant. A plausible npm/PyPI/GitHub list would be **untested**, would read
 * as authoritative, and the first real implementation agent would inherit it as
 * settled. A one-destination profile still proves the abstraction and still
 * fails loudly rather than permitting silently.
 *
 * `enforcement: 'proxy'` records `D-28`'s intent. The proxy is NOT built by this
 * epic; the Docker provider implements the network-policy half.
 */
export const IMPLEMENTATION_EGRESS_PROFILE: EgressProfile = Object.freeze({
  name: 'implementation',
  allowedDestinations: Object.freeze(['api.anthropic.com']) as readonly string[],
  enforcement: 'proxy',
});

export const EGRESS_PROFILES = Object.freeze({
  generation: GENERATION_EGRESS_PROFILE,
  implementation: IMPLEMENTATION_EGRESS_PROFILE,
});
