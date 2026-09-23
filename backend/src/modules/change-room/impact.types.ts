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

/**
 * The eight classes `BR-0044` names, in its order.
 *
 * `release` is "release scope" and `operations` is "known operational
 * effects", shortened the same way. **`security` is not one of them**
 * (`DEF-034-001`): it belongs to `TRADEOFF_DIMENSIONS` (`FR-CHR-041`), and
 * appearing here cost the view an entire class for one commit.
 *
 * `change-room-impact-areas.spec.ts` restates these from `FR-CHR-030`'s
 * wording rather than importing them, because a constant compared to itself
 * proves nothing — which is exactly how the wrong eighth member survived.
 */
export const IMPACT_AREAS = Object.freeze([
  'requirements',
  'specifications',
  'architecture',
  'tasks',
  'code',
  'tests',
  'release',
  'operations',
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

/** One governed architecture decision a change reaches (`FR-CHR-033`). */
export interface TouchedDecision {
  readonly id: string;
  readonly reference: string;
  readonly title: string;
  readonly status: string;
}

/**
 * `FR-CHR-033` and `FR-CHR-034` — the architecture panel.
 *
 * **`violationCheck.status` has exactly one inhabitant, and that is the
 * requirement.** `BR-0073` — flagging likely architecture violations — is
 * `U-17` and unowned, so there is no check to report the result of. A `boolean`
 * or a `'passed' | 'failed'` here would let a screen render a clean panel on
 * the authority of a check nobody wrote, which is Constitution IX's rule
 * broken in the one place a reader is least equipped to notice: an empty
 * warnings list reads as "no warnings" everywhere else they have ever looked.
 *
 * Whoever implements `BR-0073` widens this type deliberately. Nobody widens it
 * by accident at a call site.
 */
export interface ArchitectureImpact {
  /**
   * The decisions this change reaches, or `null` when nobody could tell.
   *
   * `[]` and `null` are different facts, exactly as `itemCount` `0` and `null`
   * are: an empty list says somebody looked and found none.
   */
  readonly decisions: readonly TouchedDecision[] | null;
  readonly detail: string;
  readonly violationCheck: {
    readonly status: 'not-run';
    readonly because: string;
  };
}

export interface ImpactView {
  readonly id: string;
  /**
   * Carried on the view, not inferred from the change it belongs to.
   *
   * `T996p` first scoped these through the change request and fell back to
   * *permitting* when no request row was loaded — a default that permits is
   * invisible (`FR-GEL-062`), and this one made a view from another workspace
   * readable. `change_impact_views` has had this column since the Foundational
   * migration; the type simply had not caught up.
   */
  readonly workspaceId: string;
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
  /**
   * `FR-CHR-033`, `FR-CHR-034` — required, not optional.
   *
   * An optional panel is one a view can be built without, and a view built
   * without it states nothing about `BR-0073` at all.
   */
  readonly architecture: ArchitectureImpact;
}
