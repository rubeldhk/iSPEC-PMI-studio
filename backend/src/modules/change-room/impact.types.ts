/**
 * `T406g` (EPIC-034) — the impact view.
 *
 * `BR-0044` names eight impact classes, and `FR-CHR-020` wants the blast radius
 * visible **before** a change is decided. Both fail the same way: an area
 * missing from the view reads, to a person scanning it, exactly like an area
 * that was checked and found clean.
 *
 * So the guarantee lives in the type rather than in a reviewer's attention.
 * `areas` is a `Record` over the whole union — a view with seven does not
 * compile — and the state has a third value, `unknown`, so *"we could not
 * tell"* cannot be written down as *"not impacted"*.
 *
 * ## What this file is not
 *
 * It is not a graph. `ImpactService` (depth 25, `DEFAULT_IMPACT_DEPTH`,
 * `R-034-1`) and `ChainTraversalService` own the traversal; this holds what they
 * returned, at a time, for a decision. `R-034-1` adopts that depth rather than
 * configuring a second one, because two traversals that disagree is worse than
 * either being wrong.
 */

/** The eight classes `BR-0044` names, in its order. */
export const IMPACT_AREAS = Object.freeze([
  'requirements',
  'specifications',
  'architecture',
  'tasks',
  'code',
  'tests',
  'release',
  'security',
] as const);

export type ImpactAreaName = (typeof IMPACT_AREAS)[number];

/**
 * Three states, and the third is the reason this is not a boolean.
 *
 * `unknown` is what an unreachable or degraded `ImpactSource` produces
 * (`T406p`). A source that degraded to `not-impacted` would be issuing a clean
 * bill of health nobody gave.
 */
export const IMPACT_STATES = Object.freeze(['impacted', 'not-impacted', 'unknown'] as const);

export type ImpactState = (typeof IMPACT_STATES)[number];

export interface ImpactArea {
  readonly area: ImpactAreaName;
  readonly state: ImpactState;
  /** Why the state is what it is — for `unknown`, why nobody could tell. */
  readonly detail: string;
  /**
   * How many items are affected, or `null` when nobody counted.
   *
   * `null` and `0` are different facts: zero is a count, and `null` is the
   * absence of one. Collapsing them would let an unreachable source report a
   * clean area.
   */
  readonly itemCount: number | null;
}

export interface ImpactView {
  readonly id: string;
  readonly changeRequestId: string;
  readonly computedAt: Date;
  /** `25`, adopted from `DEFAULT_IMPACT_DEPTH` and never reconfigured here. */
  readonly traversalDepth: number;
  /**
   * `FR-CHR-035` — true once a decision referenced it.
   *
   * What makes `R-034-5`'s re-decision test answerable: *has the impact changed
   * since the decision?* is a comparison against a stored snapshot rather than
   * a recollection.
   */
  readonly retainedForDecision: boolean;
  /** All eight. A `Record`, so seven is a compile error. */
  readonly areas: Readonly<Record<ImpactAreaName, ImpactArea>>;
}
