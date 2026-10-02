/**
 * `T406i` (EPIC-034) — change options.
 *
 * Two guarantees that decay quietly if they live in a validator, so both are in
 * the type instead:
 *
 * **`FR-CHR-040` — two or more.** `ChangeOptions` is a minimum-length tuple, so
 * a one-option decision does not compile. `BR-0023`'s objection is the reason: a
 * single path presented for approval is a conclusion wearing a decision's
 * clothes.
 *
 * **`FR-CHR-041` — all six dimensions.** `tradeOffs` is a `Record` over the
 * whole set, each *stated or explicitly not-applicable*. The six are fixed for
 * the same reason the eight impact areas are: presenting a change on schedule
 * alone is how security and compatibility become discoveries rather than
 * inputs.
 *
 * `not-applicable` is expressed as `stated: false` **with a detail**, because it
 * is a position somebody took. An absent key is not a position.
 */
import type { Epistemic } from '@pmi/room-contract';

/** `FR-CHR-041`'s six, in the order the data model lists them. */
export const TRADEOFF_DIMENSIONS = Object.freeze([
  'schedule',
  'cost',
  'quality',
  'security',
  'compatibility',
  'delivery',
] as const);

export type TradeOffDimension = (typeof TRADEOFF_DIMENSIONS)[number];

export interface TradeOff {
  /** `false` means *explicitly not applicable*, which still requires a detail. */
  readonly stated: boolean;
  readonly detail: string;
}

export interface ChangeOption {
  readonly optionId: string;
  readonly summary: string;
  readonly reasoning: string;
  /** All six. A `Record`, so omitting one is a compile error. */
  readonly tradeOffs: Readonly<Record<TradeOffDimension, TradeOff>>;
  /**
   * `recommendation`, and only that.
   *
   * Narrowed from `packages/room-contract`'s `Epistemic` rather than redeclared
   * — `R-034-3` has this Epic import the vocabulary and derive none of it. An
   * option labelled `fact` would be a decision presenting itself as a finding.
   */
  readonly epistemic: Extract<Epistemic, 'recommendation'>;
}

/**
 * Two or more.
 *
 * A minimum-length tuple rather than `ChangeOption[]`: the array type would
 * accept one and leave `FR-CHR-040` to a runtime check that a caller can forget
 * to run.
 */
export type ChangeOptions = readonly [ChangeOption, ChangeOption, ...ChangeOption[]];
