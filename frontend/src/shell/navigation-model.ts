/**
 * T436i (EPIC-036) — navigation, derived from the registry and nothing else.
 *
 * `FR-SHL-002` requires a delivered area to reach navigation with no change to
 * the shell's own code, and `SC-SHL-004` measures that at zero. A hand-written
 * list here would make every future area a shell change — eighteen areas over
 * four releases becoming eighteen shell edits, which is what the registry
 * exists to prevent.
 *
 * A pure function of the registry: no state, no cache, no invalidation path.
 *
 * Unit tests: `frontend/tests/unit/shell/navigation-model.spec.ts` (T436h).
 */
import {
  AREAS,
  AREA_GROUPS,
  GROUP_LABELS,
  isReachable,
  type Area,
  type AreaGroup,
} from './areas';

export interface NavigationGroup {
  readonly group: AreaGroup;
  readonly label: string;
  /** Delivered areas only, in registry order. Never empty — see below. */
  readonly areas: readonly Area[];
}

/**
 * The four groups of PMI-DOC-006 §4.1, in its order, carrying their delivered
 * areas.
 *
 * **A group with no delivered area is omitted entirely** (`FR-SHL-015`). Not
 * rendered empty, not rendered disabled: a heading with nothing under it is a
 * promise the product does not keep, and two groups are one area away from that
 * today — Intent & Control holds only Specifications, Platform only Workspace &
 * Administration.
 *
 * Takes the registry as an argument so `SC-SHL-004` can be asserted over a
 * synthetic one (`T437q`) rather than by editing the real file and reading a
 * diff.
 */
export function navigationModel(areas: readonly Area[] = AREAS): readonly NavigationGroup[] {
  return AREA_GROUPS.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    areas: areas.filter((area) => area.group === group && isReachable(area.status)),
  })).filter((entry) => entry.areas.length > 0);
}

/** Every delivered area, flattened in navigation order. `FR-SHL-013`. */
export function navigableAreas(areas: readonly Area[] = AREAS): readonly Area[] {
  return navigationModel(areas).flatMap((entry) => entry.areas);
}
