/**
 * T948 — who may move an object, and the record of why they could.
 * `FR-GEL-011`, `FR-GEL-014`, `FR-GEL-062`.
 *
 * PC-1: framework-free, a pure function.
 *
 * **Three refusals, in this order**, and the order is load-bearing:
 *
 *   1. the transition is not declared by the workflow type's configuration;
 *   2. no authority is configured for it;
 *   3. the actor holds none of the configured authorities.
 *
 * Asking *"may this actor do it?"* before *"does this transition exist?"* would
 * let a permissive authority map answer yes about a transition the loop does not
 * have — an object jumping `Analyze` entirely, with a perfectly valid-looking
 * record behind it.
 *
 * And an unconfigured transition **refuses**. "No rule configured" reading as
 * "anyone may" is the `ADR-0025` failure mode at the foundation, and it is
 * indistinguishable at every call site from a rule that permitted.
 */

import type { LoopStage } from '@pmi/loop-contract';
import type { ResolvedLoopConfig } from './loop-config.loader.js';

/** `"<from>-><to>"` → the authorities that may perform it. The tenant half. */
export type AuthorityMap = Readonly<Record<string, readonly string[]>>;

export type AuthorityVerdict =
  | { readonly permitted: true; readonly basis: string }
  | { readonly permitted: false; readonly reason: string };

export interface AuthorityInput {
  readonly config: ResolvedLoopConfig;
  readonly authorities: AuthorityMap;
  readonly from: LoopStage;
  readonly to: LoopStage;
  readonly actorAuthorities: readonly string[];
}

export function transitionKey(from: LoopStage, to: LoopStage): string {
  return `${from}->${to}`;
}

export function evaluateAuthority(input: AuthorityInput): AuthorityVerdict {
  const key = transitionKey(input.from, input.to);

  if (!input.config.transitionFor(input.from, input.to)) {
    return {
      permitted: false,
      reason: `transition ${key} is not declared by workflow type "${input.config.workflowType}"`,
    };
  }

  const required = input.authorities[key];
  if (required === undefined || required.length === 0) {
    return {
      permitted: false,
      reason: `no authority is configured for ${key} — an unconfigured transition is one nobody authorised (FR-GEL-062)`,
    };
  }

  // The FIRST match, recorded. An actor holding three roles leaves a record
  // saying which one was used, because "who could have done this?" is a
  // different question from "who did".
  const basis = required.find((authority) => input.actorAuthorities.includes(authority));
  if (basis === undefined) {
    return {
      permitted: false,
      reason:
        `${key} requires one of [${required.join(', ')}]; ` +
        `the actor holds [${input.actorAuthorities.join(', ') || 'none'}]`,
    };
  }

  return { permitted: true, basis };
}
