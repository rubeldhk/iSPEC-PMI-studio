/**
 * `T856f` — the Evidence Contract. `BR-0142`, ours entirely: in-toto describes
 * what **was** attested and has no notion of what **must** be (`R-032-1`).
 *
 * > Two senses of "contract": this *package* is an interface contract; an
 * > **Evidence Contract** is the domain entity below. `BR-0142` names it, and
 * > under Constitution II the SRS wins (analysis finding `I1`).
 *
 * ## What the types forbid
 *
 * - **`ContractItem` has no `met` field** (`FR-EVS-030`). State is derived
 *   from evidence, so satisfying an item by assignment is not expressible.
 * - **`acceptingPredicateTypes` is non-empty** (`FR-EVS-025`). An item that
 *   accepts nothing can never be met, and would look like an item nobody
 *   finished writing.
 * - **An empty `items` requires `zeroItemPolicyRef`** (`FR-EVS-026`). A Contract
 *   with no items is a gate that always passes, and without the reference it is
 *   indistinguishable from one nobody wrote yet.
 */

export interface ContractItem {
  /** Stable within the Contract. */
  readonly itemId: string;
  readonly description: string;
  /** `FR-EVS-025` — one or more in-toto `predicateType` URIs. */
  readonly acceptingPredicateTypes: readonly [string, ...string[]];
}

interface ContractBase {
  readonly workClass: string;
  /** Monotonic per work class; never reused. `FR-EVS-023` judges work against it. */
  readonly contractVersion: number;
}

export type EvidenceContract =
  | (ContractBase & {
      readonly items: readonly [ContractItem, ...ContractItem[]];
      readonly zeroItemPolicyRef?: string;
    })
  | (ContractBase & {
      readonly items: readonly [];
      /** `FR-EVS-026` — the explicit declaration that this work class needs none. */
      readonly zeroItemPolicyRef: string;
    });

export type ContractRefusal =
  | 'malformed'
  | 'item-accepts-nothing'
  | 'zero-items-without-policy'
  | 'duplicate-item'
  | 'item-declares-state';

export type ContractValidation =
  | { readonly ok: true; readonly value: EvidenceContract }
  | { readonly ok: false; readonly reason: ContractRefusal; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function refuse(reason: ContractRefusal, message: string): ContractValidation {
  return { ok: false, reason, message };
}

/**
 * The runtime fence for Contract definitions read from disk or from a body.
 * Returns a result; never throws (`R-032-2`).
 */
export function validateContract(candidate: unknown): ContractValidation {
  if (!isRecord(candidate)) return refuse('malformed', 'an Evidence Contract is a JSON object');
  const { workClass, contractVersion, items, zeroItemPolicyRef } = candidate;

  if (typeof workClass !== 'string' || workClass.length === 0) {
    return refuse('malformed', 'an Evidence Contract names its work class');
  }
  if (typeof contractVersion !== 'number' || !Number.isInteger(contractVersion) || contractVersion < 1) {
    return refuse('malformed', 'contractVersion is a positive integer');
  }
  if (!Array.isArray(items)) return refuse('malformed', 'items is a list');
  if (zeroItemPolicyRef !== undefined && (typeof zeroItemPolicyRef !== 'string' || zeroItemPolicyRef === '')) {
    return refuse('malformed', 'zeroItemPolicyRef, when present, names a policy');
  }

  if (items.length === 0 && zeroItemPolicyRef === undefined) {
    return refuse(
      'zero-items-without-policy',
      `Contract ${workClass} v${contractVersion} declares no items and no policy declaring that ` +
        'this work class needs none (FR-EVS-026)',
    );
  }

  const seen = new Set<string>();
  const parsed: ContractItem[] = [];
  for (const raw of items) {
    if (!isRecord(raw)) return refuse('malformed', 'each item is a JSON object');
    if ('met' in raw || 'state' in raw) {
      return refuse(
        'item-declares-state',
        'an item does not declare whether it is met; that is derived from evidence (FR-EVS-030)',
      );
    }
    const { itemId, description, acceptingPredicateTypes } = raw;
    if (typeof itemId !== 'string' || itemId === '' || typeof description !== 'string') {
      return refuse('malformed', 'each item has an itemId and a description');
    }
    if (seen.has(itemId)) return refuse('duplicate-item', `itemId ${itemId} appears twice`);
    seen.add(itemId);
    if (
      !Array.isArray(acceptingPredicateTypes) ||
      acceptingPredicateTypes.length === 0 ||
      !acceptingPredicateTypes.every((t) => typeof t === 'string' && t !== '')
    ) {
      return refuse(
        'item-accepts-nothing',
        `item ${itemId} names no evidence type that satisfies it (FR-EVS-025)`,
      );
    }
    parsed.push({
      itemId,
      description,
      acceptingPredicateTypes: acceptingPredicateTypes as [string, ...string[]],
    });
  }

  return {
    ok: true,
    value: {
      workClass,
      contractVersion,
      items: parsed,
      ...(zeroItemPolicyRef !== undefined ? { zeroItemPolicyRef } : {}),
    } as unknown as EvidenceContract,
  };
}
