/**
 * T436f (EPIC-036) — the area registry's invariants.
 *
 * `AREAS` is the one list navigation, the route tree and `FR-SHL-016`'s check
 * all read (`R-036-2`). Three consumers of one declaration is the whole design,
 * and it only holds if the declaration itself cannot be malformed — three
 * hand-maintained lists that must agree is precisely the shape `DEF-010-001`
 * took: nine pages, four imported, every check green.
 *
 * The invariant that matters most is the last one. `status: 'delivered'` MUST
 * imply an `element`, because an area in navigation with nothing to render is
 * `DEF-010-001` through the front door — and the analysis of 2026-08-24 (`C1`)
 * found four areas in exactly that position.
 */
import { describe, expect, it } from 'vitest';
import { AREAS, AREA_GROUPS, deliveredAreas, type Area } from '../../../src/shell/areas';

const isPath = /^\/[a-z0-9/-]*$/;

describe('T436f · the area registry is well-formed', () => {
  it('declares all eighteen areas of PMI-DOC-006 §4.1', () => {
    // Anti-vacuity, and the count PMI-DOC-006 §4.1 states. An empty or
    // truncated registry would make every assertion below pass over nothing.
    expect(AREAS).toHaveLength(18);
  });

  it('gives every area a unique id', () => {
    const ids = AREAS.map((area) => area.id);
    expect(new Set(ids).size, `duplicate ids in ${ids.join(', ')}`).toBe(ids.length);
  });

  it('gives every area a unique, well-formed path', () => {
    const paths = AREAS.map((area) => area.path);
    expect(new Set(paths).size, `duplicate paths in ${paths.join(', ')}`).toBe(paths.length);
    for (const area of AREAS) {
      expect(area.path, `${area.id} has a malformed path`).toMatch(isPath);
    }
  });

  it('puts every area in exactly one of the four groups, in §4.1 order', () => {
    // `FR-SHL-011`. The registry is a flat ordered list and `group` is a single
    // field, so a second membership is unrepresentable rather than forbidden by
    // review — this asserts the field is one of the four and nothing else.
    expect(AREA_GROUPS).toEqual(['overview', 'intent-and-control', 'delivery', 'platform']);
    for (const area of AREAS) {
      expect(AREA_GROUPS, `${area.id} is in an unknown group`).toContain(area.group);
    }
  });

  it('renders something for every delivered area, and nothing for the rest', () => {
    // `FR-SHL-003` and the `C1` finding, as an assertion. A delivered area with
    // no element is an entry in navigation that leads nowhere; a non-delivered
    // area with an element is the shell implementing content it does not own.
    for (const area of AREAS) {
      if (area.status === 'delivered') {
        expect(area.element, `${area.id} is delivered with nothing to render`).toBeTypeOf(
          'function',
        );
      } else {
        expect(area.element, `${area.id} is not delivered but carries an element`).toBeUndefined();
      }
    }
  });

  it('names the owing Epic for every area that is declared but not delivered', () => {
    // The debt keeps its debtor. Without this, `declared-not-delivered` is
    // indistinguishable from `undeclared` in practice, which is the erasure
    // the third state exists to prevent.
    const owed = AREAS.filter((area) => area.status === 'declared-not-delivered');
    expect(owed.length, 'no areas are awaiting their owners — expected four').toBe(4);
    for (const area of owed) {
      expect(area.epic, `${area.id} is owed by nobody`).toMatch(/^EPIC-\d{3}(\s*·\s*EPIC-\d{3})*$/);
    }
  });

  it('counts five delivered, four owed and nine undeclared', () => {
    const by = (status: Area['status']): number =>
      AREAS.filter((area) => area.status === status).length;
    expect({
      delivered: by('delivered'),
      owed: by('declared-not-delivered'),
      undeclared: by('undeclared'),
    }).toEqual({ delivered: 5, owed: 4, undeclared: 9 });
  });

  it('leaves no group without a delivered area', () => {
    // `FR-SHL-015` says a group with no delivered area must not render as an
    // empty heading. Two groups are one area away from that today — Intent &
    // Control holds only Specifications, Platform only Workspace &
    // Administration — so this is a live case, not a hypothetical.
    for (const group of AREA_GROUPS) {
      expect(
        deliveredAreas().filter((area) => area.group === group).length,
        `group "${group}" has no delivered area`,
      ).toBeGreaterThan(0);
    }
  });

  it('exposes delivered areas in registry order, and only those', () => {
    const delivered = deliveredAreas();
    expect(delivered.map((area) => area.id)).toEqual(
      AREAS.filter((area) => area.status === 'delivered').map((area) => area.id),
    );
    expect(delivered.every((area) => area.element !== undefined)).toBe(true);
  });
});
