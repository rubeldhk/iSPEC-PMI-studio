/**
 * `T856h` — Contract status and the completion gate's result.
 *
 * ## Four states, three of them not met
 *
 * `unresolvable` (`FR-EVS-014`) and `integrity-failed` (`FR-EVS-034`) are kept
 * apart from plain `unmet` because a reader must be able to tell *nobody
 * produced it* from *it was produced and cannot be trusted*. The gate treats all
 * three identically. Presence is not validity.
 *
 * ## A result, not an exception
 *
 * `packages/storage-contract`'s rule — *"adapters RETURN failures; they never
 * throw"* — applied to the gate (`R-032-2`). A refusal that arrives as an
 * exception can be swallowed by a caller's `catch`; one that arrives as a value
 * has to be read.
 *
 * ## No verdict
 *
 * Nothing here judges whether the work *complies with its specification*. That
 * is `BR-0143`, `U-09`, and unowned (`FR-EVS-051`). This file says only whether
 * the evidence a Contract requires exists and can be trusted.
 */

export const ITEM_STATES = Object.freeze(['met', 'unmet', 'unresolvable', 'integrity-failed'] as const);

export type ItemState = (typeof ITEM_STATES)[number];

export function isMet(state: ItemState): boolean {
  return state === 'met';
}

export interface ItemStatus {
  readonly itemId: string;
  readonly description: string;
  readonly state: ItemState;
  /** `FR-EVS-025` — when not met, why: absent, wrong type, wrong version, untrusted. */
  readonly reason?: string;
  /** The evidence that met it, when met. */
  readonly evidenceId?: string;
}

/** `FR-EVS-022`, `FR-EVS-027` — computed on read, never stored. */
export interface ContractStatus {
  readonly workClass: string;
  readonly contractVersion: number;
  readonly items: readonly ItemStatus[];
  /** The itemIds not `met` — what a Room's Evidence region renders. */
  readonly unmet: readonly string[];
  readonly satisfied: boolean;
  /** `FR-EVS-026` — present when the Contract is empty on purpose, so it is visible. */
  readonly zeroItemPolicyRef?: string;
}

export type CompletionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly unmet: readonly [string, ...string[]] };

/**
 * Builds a refusal. Throws only on a programming error — an empty list is the
 * "not ready" message `FR-EVS-032` exists to forbid, and the type already
 * refuses it for literals; this is the same rule for lists built from data.
 */
export function refuse(unmet: readonly string[]): CompletionResult {
  if (unmet.length === 0) {
    throw new Error('a refused completion carries a non-empty unmet list (FR-EVS-032)');
  }
  return { ok: false, unmet: unmet as [string, ...string[]] };
}
