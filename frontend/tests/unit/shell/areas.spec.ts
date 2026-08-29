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
import {
  AREAS,
  AREA_GROUPS,
  deliveredAreas,
  isReachable,
  reachableAreas,
  type Area,
} from '../../../src/shell/areas';

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
    // Widened to REACHABILITY by `T1012` (2026-08-25): a partly-delivered area
    // renders too, and keying this to `delivered` alone would have stripped
    // Home and Projects of their routes the moment they were reclassified.
    for (const area of AREAS) {
      if (isReachable(area.status)) {
        expect(area.element, `${area.id} is reachable with nothing to render`).toBeTypeOf(
          'function',
        );
      } else {
        expect(area.element, `${area.id} is unreachable but carries an element`).toBeUndefined();
      }
    }
  });

  it('names the owing Epic for every area that is declared but not delivered', () => {
    // The debt keeps its debtor. Without this, `declared-not-delivered` is
    // indistinguishable from `undeclared` in practice, which is the erasure
    // the third state exists to prevent.
    const owed = AREAS.filter((area) => area.status === 'declared-not-delivered');
    // Four before Step B; thirteen after `T1013` assigned owners to the five
    // Rooms, Engineering Experts, Context, Integrations and Reports; **twelve**
    // since `T1172`, when the Requirement Room's landing began rendering and
    // the area was promoted to `delivered`.
    //
    // The debt shrinks only when something is actually delivered. This number
    // moving is the signal it is for — a count edited to match a promoted
    // status, rather than a status promoted because a screen renders, would
    // make the whole matrix decorative.
    expect(owed.length, 'no areas are awaiting their owners').toBe(12);
    for (const area of owed) {
      expect(area.epic, `${area.id} is owed by nobody`).toMatch(/^EPIC-\d{3}(\s*·\s*EPIC-\d{3})*$/);
    }
  });

  // The 5 / 4 / 9 count that stood here is SUPERSEDED by `T1014`, which states
  // the matrix over both denominators — all eighteen areas, and the seventeen
  // prototype screens. It was not wrong when written: it read the `delivered`
  // flag, which answered "does a screen render". It is replaced because the
  // delivery report asks a different question, and one count answering both is
  // how two published figures came to disagree.


  it('leaves no group without a delivered area', () => {
    // `FR-SHL-015` says a group with no delivered area must not render as an
    // empty heading. Two groups are one area away from that today — Intent &
    // Control holds only Specifications, Platform only Workspace &
    // Administration — so this is a live case, not a hypothetical.
    for (const group of AREA_GROUPS) {
      expect(
        reachableAreas().filter((area) => area.group === group).length,
        `group "${group}" has no reachable area`,
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

/**
 * T1014 (EPIC-036 Phase 19) — the registry expresses the approved matrix.
 *
 * `Constitution XII` Step B, authorised 2026-08-25. The three-state vocabulary
 * could not distinguish a screen that renders but is missing a prototype panel
 * from one that was never built, and the gap analysis of 2026-08-25 found that
 * ambiguity was itself the reason two published screen counts disagreed.
 *
 * The counting test above (`T436f`) asserted **5 / 4 / 9**. That count was not
 * wrong when written — it read the `delivered` flag, which means "a screen
 * renders". It is superseded because the flag was answering a different
 * question from the one the delivery report asks.
 */
describe('T1014 · the registry expresses the approved delivery matrix', () => {
  const by = (status: Area['status']): readonly Area[] =>
    AREAS.filter((area) => area.status === status);

  /**
   * The registry holds **eighteen** areas: the V2 prototype's seventeen pages
   * plus Workspace & Administration, which PMI-DOC-006 §4.1 declares and the
   * prototype does not draw. The approved delivery matrix is stated over the
   * **prototype seventeen**, so the two denominators differ by exactly that
   * one area — and a count that does not say which it means is how the
   * earlier figures came to disagree. Both are asserted.
   */
  const PROTOTYPE_17 = AREAS.filter((area) => area.id !== 'workspace-administration');

  /**
   * **Updated 2026-08-28 (`T1172`)**: 3 / 2 / 13 → **4 / 2 / 12** over eighteen,
   * and 2 / 2 / 13 → **3 / 2 / 12** over the prototype seventeen.
   *
   * The Requirement Room area was delivered — `/requirement-room` renders the
   * shared `RoomIndex`, which lists the workspace's Rooms and offers the way
   * into a new one. It had stood `declared-not-delivered` since `T403n` because
   * the Room screen existed per object while nothing listed the objects.
   *
   * The order matters and is the reason this number is allowed to move: the
   * index was built (`T1170`/`T1171`), `areas.ts` gained an `element`, and the
   * count followed. `areas.ts` carries the note forbidding the reverse — a
   * landing invented to justify a status is the status driving the product.
   */
  it('counts 4 delivered, 2 partly delivered, 12 owed, 0 undeclared across all eighteen', () => {
    expect({
      delivered: by('delivered').length,
      partly: by('partly-delivered').length,
      owed: by('declared-not-delivered').length,
      undeclared: by('undeclared').length,
    }).toEqual({ delivered: 4, partly: 2, owed: 12, undeclared: 0 });
  });

  it('counts 3 / 2 / 12 / 0 across the seventeen prototype screens — the approved matrix', () => {
    const n = (status: Area['status']): number =>
      PROTOTYPE_17.filter((area) => area.status === status).length;
    expect(PROTOTYPE_17).toHaveLength(17);
    expect({
      delivered: n('delivered'),
      partly: n('partly-delivered'),
      owed: n('declared-not-delivered'),
      undeclared: n('undeclared'),
    }).toEqual({ delivered: 3, partly: 2, owed: 12, undeclared: 0 });
  });

  it('T1173 · the Requirement Room area is delivered AND renders', () => {
    // Two facts, asserted together because the pair is the rule `areas.ts`
    // records: a status without an element is a claim, and an element added to
    // justify a status is the status driving the product. Phase 9 did them in
    // the order that makes the claim true — index first (`T1170`/`T1171`),
    // `element` second, status third.
    const room = AREAS.find((area) => area.id === 'requirement-room');
    expect(room, 'the Requirement Room area left the registry').toBeDefined();
    expect(room?.status).toBe('delivered');
    expect(room?.element, 'delivered with nothing to render').toBeTypeOf('function');
    expect(room?.path).toBe('/requirement-room');
  });

  it('names an owning Epic for every area, because none is unowned any more', () => {
    // `undeclared` keeps zero members by design. The state is retained so a
    // future area added before its Epic exists can still be recorded honestly
    // — but an area WITHOUT an Epic and WITHOUT that status is a gap nobody
    // owns, which is the condition this assertion exists to forbid.
    const unowned = AREAS.filter((area) => area.status !== 'undeclared' && area.epic === null);
    expect(unowned.map((a) => a.id), 'an area names no owning Epic').toEqual([]);
  });

  it('gives every reachable area an element, and every unreachable one none', () => {
    // The invariant T1012 must not break: a partly-delivered area RENDERS.
    // Scoping the element to `delivered` alone would strip Home and Projects
    // of their routes the moment they were reclassified.
    for (const area of AREAS) {
      const reachable = area.status === 'delivered' || area.status === 'partly-delivered';
      if (reachable) {
        expect(area.element, `${area.id} is reachable with nothing to render`).toBeTypeOf(
          'function',
        );
      } else {
        expect(area.element, `${area.id} is unreachable but carries an element`).toBeUndefined();
      }
    }
  });

  it('routes a partly-delivered area — the regression this phase exists to prevent', () => {
    const partly = by('partly-delivered');
    expect(partly.length, 'no partly-delivered area to check').toBeGreaterThan(0);
    for (const area of partly) {
      expect(
        reachableAreas().map((a) => a.id),
        `${area.id} is partly delivered and therefore reachable, but routing drops it`,
      ).toContain(area.id);
    }
  });

  it('keeps deliveredAreas() meaning STRICTLY delivered, so the report stays honest', () => {
    // Reachability and completeness are different questions, and collapsing
    // them is what made the count read 4 before this phase corrected it.
    //
    // **It reads 4 again since `T1172`, and for the opposite reason.** The old 4
    // was three delivered areas plus one counted because it was reachable. This
    // 4 is four areas whose landings render — the Requirement Room's index
    // arrived (`T1170`/`T1171`). The assertion below is what keeps the two
    // apart: every member must actually hold `delivered`, so a reachable-but-
    // incomplete area cannot rejoin the count by being routed.
    expect(deliveredAreas().every((area) => area.status === 'delivered')).toBe(true);
    // Four in the registry; three of them are prototype screens.
    expect(deliveredAreas().length).toBe(4);
    expect(
      deliveredAreas().filter((a) => a.id !== 'workspace-administration').length,
    ).toBe(3);
  });

  it('maps the seventeen V2 prototype pages plus Workspace & Administration', () => {
    expect(AREAS).toHaveLength(18);
    const ids = AREAS.map((a) => a.id);
    for (const room of ['decision-inbox', 'requirement-room', 'change-room', 'defect-room']) {
      expect(ids, `${room} missing from the registry`).toContain(room);
    }
  });
});
