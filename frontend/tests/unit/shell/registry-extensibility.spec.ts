/**
 * T437q (EPIC-036) — `SC-SHL-004`: adding an area costs **zero** shell code
 * changes.
 *
 * This is the criterion that makes eighteen areas arriving over four releases
 * bearable. If it fails, each future area is a shell edit and the shell becomes
 * the bottleneck the registry exists to remove.
 *
 * Asserted **by construction over a synthetic registry**, not by editing
 * `areas.ts` and reading a diff. A diff-reading test proves the change was
 * small; this proves the derivation is total — navigation and the route tree
 * are functions of the list, so a new entry cannot fail to reach them.
 *
 * It is also the claim `EPIC-012`, `EPIC-014`, `EPIC-016` and `EPIC-019` each
 * rely on: their area moves to `delivered` with one edit here and nothing else
 * (`T441p`).
 */
import { describe, expect, it } from 'vitest';
import { AREAS, AREA_GROUPS, isReachable, type Area } from '../../../src/shell/areas';
import { navigableAreas, navigationModel } from '../../../src/shell/navigation-model';

function synthetic(id: string, group: Area['group'], status: Area['status']): Area {
  return {
    id,
    group,
    label: `Area ${id}`,
    path: `/${id}`,
    epic: 'EPIC-999',
    status,
    ...(isReachable(status) ? { element: (): null => null } : {}),
  } as Area;
}

describe('T437q · SC-SHL-004 — a delivered area reaches navigation from the registry alone', () => {
  it('puts a newly delivered area in navigation, in its group', () => {
    const added = synthetic('new-area', 'delivery', 'delivered');
    const model = navigationModel([...AREAS, added]);
    const delivery = model.find((group) => group.group === 'delivery');
    expect(delivery?.areas.map((area) => area.id)).toContain('new-area');
  });

  it('changes nothing else about navigation', () => {
    // The whole claim: adding one area adds exactly one destination. A
    // derivation that reordered or dropped something under a new entry would
    // be a shell change in everything but name.
    const before = navigableAreas().map((area) => area.id);
    const after = navigableAreas([...AREAS, synthetic('new-area', 'platform', 'delivered')]).map(
      (area) => area.id,
    );
    expect(after.filter((id) => id !== 'new-area')).toEqual(before);
    expect(after).toHaveLength(before.length + 1);
  });

  it('moves an owed area into navigation on a status change alone', () => {
    // What `EPIC-016` will do: one field, no other edit. Governance is the
    // live case — the `declared-not-delivered` row exists precisely so this
    // is the whole of its future change.
    const owed = AREAS.find((area) => area.id === 'governance')!;
    expect(navigableAreas().map((area) => area.id)).not.toContain('governance');

    const promoted: Area[] = AREAS.map((area) =>
      area.id === 'governance' ? ({ ...owed, status: 'delivered', element: (): null => null } as Area) : area,
    );
    expect(navigableAreas(promoted).map((area) => area.id)).toContain('governance');
  });

  it('brings back a whole group that had nothing delivered in it', () => {
    // `FR-SHL-015` omits an empty group; the inverse must also hold, or a
    // group could be permanently lost after its last area was withdrawn.
    const onlyOverview = AREAS.filter((area) => area.group === 'overview');
    expect(navigationModel(onlyOverview).map((group) => group.group)).toEqual(['overview']);

    const plusPlatform = [...onlyOverview, synthetic('admin', 'platform', 'delivered')];
    expect(navigationModel(plusPlatform).map((group) => group.group)).toEqual([
      'overview',
      'platform',
    ]);
  });

  it('reaches every group without a code change', () => {
    for (const group of AREA_GROUPS) {
      const model = navigationModel([synthetic(`x-${group}`, group, 'delivered')]);
      expect(model.map((entry) => entry.group)).toEqual([group]);
    }
  });

  it('adds nothing for an area that is not delivered', () => {
    const before = navigableAreas().length;
    for (const status of ['declared-not-delivered', 'undeclared'] as const) {
      const after = navigableAreas([...AREAS, synthetic(`s-${status}`, 'delivery', status)]);
      expect(after).toHaveLength(before);
    }
  });
});
