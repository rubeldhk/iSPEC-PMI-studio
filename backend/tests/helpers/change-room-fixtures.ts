/**
 * `T1218` — a store holding an impact view, for tests that record a decision.
 *
 * `BR-0044`: *a change decided without its impact view is decided on the part
 * somebody thought of.* `DecisionService.record` now refuses an
 * `impactViewId` it cannot read, which is what that sentence asks for.
 *
 * Before `T1218` these fixtures named `iv_1` and nothing had written it, so
 * every decision in them was taken against a view nobody could read — and the
 * suite agreed. Shared here rather than copied into five files, because five
 * copies of a fixture is how one of them quietly stops saving the view.
 */
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';
import { IMPACT_AREAS, type ImpactArea, type ImpactAreaName } from '../../src/modules/change-room/impact.types.js';

export interface ImpactViewFixture {
  readonly workspaceId?: string;
  readonly changeRequestId?: string;
  readonly id?: string;
}

/** All eight areas `not-impacted`. The Room's shape, with nothing interesting in it. */
export function impactViewFixture(over: ImpactViewFixture = {}) {
  const areas = {} as Record<ImpactAreaName, ImpactArea>;
  for (const area of IMPACT_AREAS) {
    areas[area] = {
      area,
      state: 'not-impacted',
      detail: 'traversed; nothing downstream in this area',
      itemCount: 0,
    };
  }
  return {
    id: over.id ?? 'iv_1',
    workspaceId: over.workspaceId ?? 'ws_1',
    changeRequestId: over.changeRequestId ?? 'cr_1',
    computedAt: new Date('2026-08-30T10:00:00Z'),
    traversalDepth: 25,
    retainedForDecision: false,
    areas,
    architecture: {
      decisions: [],
      detail: 'the decision register was read and none of its decisions are reached by this change',
      violationCheck: {
        status: 'not-run' as const,
        because: 'the architecture-violation check (BR-0073) is unowned (U-17)',
      },
    },
  };
}

/** A store with one impact view already saved, ready for a decision to cite. */
export async function storeWithImpactView(
  over: ImpactViewFixture = {},
): Promise<InMemoryChangeRoomStore> {
  const store = new InMemoryChangeRoomStore();
  await store.saveImpactView(impactViewFixture(over));
  return store;
}
