/**
 * `T406o` (EPIC-034) — a composer that owns no graph.
 *
 * `FR-CHR-030` wants the blast radius visible before the decision.
 * `FR-CHR-031` and `R-034-1` say this Room must not compute it: the traversal
 * belongs to `ImpactService` (depth `DEFAULT_IMPACT_DEPTH`, adopted never
 * reconfigured) and `ChainTraversalService`. This composes what they return
 * into the eight-area snapshot a decision is taken against.
 *
 * ## The asymmetry, and why it is deliberate
 *
 * Four of this Room's five ports **refuse** when absent, which is
 * `FR-GEL-062`'s posture: a default that permits is invisible. `ImpactSource`
 * is the exception and **degrades to `unknown`** (`FR-CHR-032`).
 *
 * The difference is what each absence means. An absent policy provider means
 * nobody authorised the change, and proceeding would be an unauthorised
 * approval. An absent impact source means *nobody could see the blast radius* —
 * which is a fact a decision-maker can weigh, provided they are told. So the
 * area reads `unknown` with a reason, never `not-impacted`, and the decision is
 * theirs to take with that in view.
 *
 * Refusing instead would make an unreachable dependency graph block every
 * change, including the urgent ones a graph outage has nothing to do with.
 */
import {
  IMPACT_AREAS,
  type ArchitectureImpact,
  type ImpactArea,
  type ImpactAreaName,
  type ImpactView,
  type TouchedDecision,
} from './impact.types.js';

/**
 * What one area's answer can be (`T996m`).
 *
 * A union rather than an optional count, because the three cases a view must
 * keep apart are three cases: found n, found none, and **could not tell**. An
 * optional count collapses the third into the second the first time somebody
 * writes `count ?? 0`.
 *
 * `undeterminable` is a required literal `true` rather than a boolean, so a
 * finding cannot half-declare itself: `{ undeterminable: false }` does not
 * typecheck as either arm.
 */
export type ImpactFinding =
  | { readonly count: number; readonly detail: string }
  | { readonly undeterminable: true; readonly reason: string };

/** What the composer needs from `EPIC-020`, and no more. */
export interface ImpactPort {
  /** Throws or rejects when the graph cannot be reached — that is the case under test. */
  impactFor(
    workspaceId: string,
    changedArtifactId: string,
  ): Promise<ReadonlyMap<ImpactAreaName, ImpactFinding>>;
}

/** What it needs from `EPIC-011`. */
export interface TraversalPort {
  reachableFrom(workspaceId: string, startId: string): Promise<readonly string[]>;
}

/**
 * What the composer needs from `EPIC-016`'s decision register (`FR-CHR-033`).
 *
 * Optional at construction, and its absence is **stated in the view** rather
 * than defaulted to an empty list — `FR-GEL-062`: a default that permits is
 * invisible, and "no decisions are affected" is the permitting answer here.
 */
export interface ArchitectureDecisionPort {
  decisionsTouchedBy(
    workspaceId: string,
    changedArtifactId: string,
  ): Promise<readonly TouchedDecision[]>;
}

/**
 * `FR-CHR-034` — the same sentence on every view, because the check is unowned
 * on every view.
 */
const VIOLATION_CHECK_NOT_RUN = Object.freeze({
  status: 'not-run',
  because:
    'the architecture-violation check (BR-0073) is unowned (U-17), so no check has examined this ' +
    'change for likely violations. An empty list of warnings here means nobody looked, not that ' +
    'nothing is wrong.',
} as const);

export interface ComposeInput {
  readonly workspaceId: string;
  readonly changeRequestId: string;
  readonly changedArtifactId: string;
  /** `DEFAULT_IMPACT_DEPTH`, passed in. This module never names a number. */
  readonly traversalDepth: number;
  readonly now: Date;
  readonly id: string;
}

/**
 * `FR-CHR-032` requires a *stated* reason, and a blank one satisfies the
 * requirement on paper while rendering an empty cell.
 *
 * "The source would not say" is a reason, and a truthful one. Substituting it
 * is not papering over the gap — it is reporting the gap that exists, which is
 * the only thing this Room ever claims to do about an area it cannot see.
 */
function stated(reason: string, area: ImpactAreaName): string {
  return reason.trim() === ''
    ? `the impact source reported ${area} undeterminable and gave no reason`
    : reason.trim();
}

/** Every area `unknown`, with one reason. Used when the source cannot answer. */
function allUnknown(reason: string): Record<ImpactAreaName, ImpactArea> {
  const areas = {} as Record<ImpactAreaName, ImpactArea>;
  for (const area of IMPACT_AREAS) {
    areas[area] = {
      area,
      state: 'unknown',
      detail: reason,
      // `null`, never `0`: nobody counted.
      itemCount: null,
    };
  }
  return areas;
}

export class ImpactComposer {
  constructor(
    private readonly impact: ImpactPort,
    private readonly traversal: TraversalPort,
    private readonly decisions?: ArchitectureDecisionPort,
  ) {}

  /**
   * `FR-CHR-033` — which governed decisions this change reaches.
   *
   * Three outcomes, kept apart: a list, an empty list, and `null`. The last two
   * look identical on a screen unless the detail says which happened.
   */
  private async architectureOf(input: ComposeInput): Promise<ArchitectureImpact> {
    if (!this.decisions) {
      return {
        decisions: null,
        detail:
          'no architecture decision source is bound in this deployment, so no decision was ' +
          'checked against this change',
        violationCheck: VIOLATION_CHECK_NOT_RUN,
      };
    }
    try {
      const touched = await this.decisions.decisionsTouchedBy(
        input.workspaceId,
        input.changedArtifactId,
      );
      return {
        decisions: touched,
        detail:
          touched.length === 0
            ? 'the decision register was read and none of its decisions are reached by this change'
            : `${touched.length} governed decision(s) are reached by this change`,
        violationCheck: VIOLATION_CHECK_NOT_RUN,
      };
    } catch (error) {
      // Degrade, never refuse — and never to `[]`, which would report a clean
      // register on the authority of one that failed to answer.
      return {
        decisions: null,
        detail: `the decision register could not be read: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
        violationCheck: VIOLATION_CHECK_NOT_RUN,
      };
    }
  }

  async compose(input: ComposeInput): Promise<ImpactView> {
    let areas: Record<ImpactAreaName, ImpactArea>;
    try {
      const found = await this.impact.impactFor(input.workspaceId, input.changedArtifactId);
      // Reachability is asked for, and its failure is not fatal either: it
      // widens the detail rather than deciding the state.
      const reachable = await this.traversal
        .reachableFrom(input.workspaceId, input.changedArtifactId)
        .catch(() => null);

      areas = {} as Record<ImpactAreaName, ImpactArea>;
      for (const area of IMPACT_AREAS) {
        const hit = found.get(area);
        if (hit === undefined) {
          areas[area] = {
            area,
            state: 'not-impacted',
            detail:
              reachable === null
                ? 'traversed; nothing downstream in this area'
                : `traversed ${reachable.length} reachable artifacts; nothing in this area`,
            // Zero IS a count — somebody looked.
            itemCount: 0,
          };
          continue;
        }
        if ('undeterminable' in hit) {
          // `FR-CHR-032`. The source answered, and answered "I cannot tell" —
          // which is different from both silence and zero, and is the case a
          // partial outage produces. Before `T996m` this arm did not exist and
          // such an area rendered `impacted` with no count at all.
          areas[area] = {
            area,
            state: 'unknown',
            detail: stated(hit.reason, area),
            itemCount: null,
          };
          continue;
        }
        areas[area] = { area, state: 'impacted', detail: hit.detail, itemCount: hit.count };
      }
    } catch (error) {
      // `FR-CHR-032` — degrade, never refuse, and say why.
      areas = allUnknown(
        `the impact source could not be reached: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    return {
      id: input.id,
      workspaceId: input.workspaceId,
      architecture: await this.architectureOf(input),
      changeRequestId: input.changeRequestId,
      computedAt: input.now,
      traversalDepth: input.traversalDepth,
      // `FR-CHR-035` — set when a decision references it, not when it is made.
      retainedForDecision: false,
      areas,
    };
  }
}
