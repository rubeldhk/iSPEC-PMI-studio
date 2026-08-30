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
import { IMPACT_AREAS, type ImpactArea, type ImpactAreaName, type ImpactView } from './impact.types.js';

/** What the composer needs from `EPIC-020`, and no more. */
export interface ImpactPort {
  /** Throws or rejects when the graph cannot be reached — that is the case under test. */
  impactFor(
    workspaceId: string,
    changedArtifactId: string,
  ): Promise<ReadonlyMap<ImpactAreaName, { count: number; detail: string }>>;
}

/** What it needs from `EPIC-011`. */
export interface TraversalPort {
  reachableFrom(workspaceId: string, startId: string): Promise<readonly string[]>;
}

export interface ComposeInput {
  readonly workspaceId: string;
  readonly changeRequestId: string;
  readonly changedArtifactId: string;
  /** `DEFAULT_IMPACT_DEPTH`, passed in. This module never names a number. */
  readonly traversalDepth: number;
  readonly now: Date;
  readonly id: string;
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
  ) {}

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
      changeRequestId: input.changeRequestId,
      computedAt: input.now,
      traversalDepth: input.traversalDepth,
      // `FR-CHR-035` — set when a decision references it, not when it is made.
      retainedForDecision: false,
      areas,
    };
  }
}
