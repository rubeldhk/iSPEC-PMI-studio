/**
 * T436h (EPIC-036) — navigation is derived, and a group with nothing in it does
 * not render.
 *
 * The second half is `FR-SHL-015`, and it is not hypothetical: two of the four
 * groups carry exactly one delivered area today, so a single area moving state
 * would produce an empty heading.
 */
import { describe, expect, it } from 'vitest';
import { AREAS, AREA_GROUPS, type Area } from '../../../src/shell/areas';
import { navigableAreas, navigationModel } from '../../../src/shell/navigation-model';

function area(overrides: Partial<Area> & Pick<Area, 'id' | 'group' | 'status'>): Area {
  return {
    label: overrides.id,
    path: `/${overrides.id}`,
    epic: 'EPIC-000',
    ...overrides,
    ...(overrides.status === 'delivered' ? { element: (): null => null } : {}),
  } as Area;
}

describe('T436h · navigation is derived from the registry', () => {
  it('carries only delivered areas', () => {
    const shown = navigableAreas();
    expect(shown.length, 'no areas reached navigation at all').toBeGreaterThan(0);
    expect(shown.every((entry) => entry.status === 'delivered')).toBe(true);
    expect(shown).toHaveLength(AREAS.filter((entry) => entry.status === 'delivered').length);
  });

  it('presents groups in PMI-DOC-006 §4.1 order', () => {
    const order = navigationModel().map((entry) => entry.group);
    expect(order).toEqual(AREA_GROUPS.filter((group) => order.includes(group)));
  });

  it('keeps areas in registry order within a group', () => {
    for (const entry of navigationModel()) {
      const expected = AREAS.filter(
        (candidate) => candidate.group === entry.group && candidate.status === 'delivered',
      ).map((candidate) => candidate.id);
      expect(entry.areas.map((candidate) => candidate.id)).toEqual(expected);
    }
  });

  it('omits a group with no delivered area rather than rendering an empty heading', () => {
    // `FR-SHL-015`, over a synthetic registry so the assertion does not depend
    // on which areas happen to be delivered today.
    const synthetic: Area[] = [
      area({ id: 'a', group: 'overview', status: 'delivered' }),
      area({ id: 'b', group: 'delivery', status: 'declared-not-delivered' }),
      area({ id: 'c', group: 'platform', status: 'undeclared' }),
    ];
    const model = navigationModel(synthetic);
    expect(model.map((entry) => entry.group)).toEqual(['overview']);
    expect(model.every((entry) => entry.areas.length > 0)).toBe(true);
  });

  it('never renders a group that is present but empty', () => {
    // The weaker version of the assertion above, over the real registry — a
    // regression here is a heading users would see.
    expect(navigationModel().every((entry) => entry.areas.length > 0)).toBe(true);
  });

  it('is a pure function of its argument', () => {
    // No cache, no invalidation path (`data-model.md` §5). Two calls with the
    // same input agree, and a different input gives a different answer without
    // any refresh step.
    expect(navigationModel()).toEqual(navigationModel());
    expect(navigationModel([])).toEqual([]);
  });
});
