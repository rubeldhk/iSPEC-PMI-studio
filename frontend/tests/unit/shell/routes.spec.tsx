/**
 * T436j (EPIC-036) — the route tree is derived, never hand-written.
 *
 * A route added by hand would be reachable and **invisible to `FR-SHL-016`**,
 * which is the defect this contract exists to prevent: a page you can get to
 * that the reachability check does not know to look for. So the assertion is
 * not *"these routes exist"* but *"the routes are exactly the registry's, plus
 * the declared sub-views, plus `*`"*.
 */
import { describe, expect, it } from 'vitest';
import { AREAS, isReachable, reachableAreas } from '../../../src/shell/areas';
import { SUB_VIEWS } from '../../../src/shell/routes';
import { ADDRESS_SCOPED_PATTERNS, isAddressScoped } from '../../../src/shell/shell-context';

describe('T436j · routes come from the registry', () => {
  it('declares a sub-view set, or the assertions below prove nothing', () => {
    expect(SUB_VIEWS.length).toBeGreaterThan(0);
    expect(reachableAreas().length).toBeGreaterThan(0);
  });

  it('gives every sub-view a path inside an area it belongs to', () => {
    // A sub-view whose prefix matches no area is an orphan route: reachable,
    // and outside every area's identity. `/traceability` is the deliberate
    // exception — PMI-DOC-006 §4.1 names no Traceability area and the contract
    // records it as "within Projects".
    const areaPaths = AREAS.map((area) => area.path).filter((path) => path !== '/');
    for (const { path } of SUB_VIEWS) {
      const owned =
        path === '/traceability' || areaPaths.some((areaPath) => path.startsWith(`${areaPath}/`));
      expect(owned, `sub-view ${path} belongs to no area`).toBe(true);
    }
  });

  it('gives every sub-view a unique path that is not an area path', () => {
    const paths = SUB_VIEWS.map((view) => view.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(
        AREAS.some((area) => area.path === path),
        `${path} is both a sub-view and an area path`,
      ).toBe(false);
    }
  });

  it('routes no area that is not delivered', () => {
    // The other twelve have paths so an address naming one can be answered,
    // and no route so the answer is not-found.
    for (const area of AREAS) {
      if (isReachable(area.status)) continue;
      expect(
        SUB_VIEWS.some((view) => view.path === area.path),
        `${area.label} is not delivered but has a route`,
      ).toBe(false);
    }
  });

  it('scopes every sub-view either by project or by its own address (T442d)', () => {
    // The list in `shell-context.tsx` is explicit rather than a prefix rule,
    // so it can drift from the route table. This is the assertion that stops
    // it: every address-scoped pattern must match a real sub-view, and every
    // sub-view must be one or the other on purpose.
    const examples = SUB_VIEWS.map(({ path }) =>
      path.replace(/:projectId/, 'p1').replace(/:specificationId/, 's1').replace(/:runId/, 'r1'),
    );
    for (const pattern of ADDRESS_SCOPED_PATTERNS) {
      expect(
        examples.some((example) => pattern.test(example)),
        `${pattern} matches no route in the table`,
      ).toBe(true);
    }
    // The two that scope themselves, and only those.
    expect(examples.filter((example) => isAddressScoped(example)).sort()).toEqual([
      '/runs/r1',
      '/specifications/s1',
    ]);
  });

  it('never treats an area path itself as address-scoped', () => {
    // An area is scoped by the selector; only a sub-view carrying its own
    // identifier is not. A pattern that swallowed `/runs` would silence the
    // "No project selected" state the whole of `FR-SHL-024` rests on.
    for (const area of AREAS) {
      expect(isAddressScoped(area.path), `${area.path} is an area, not a sub-view`).toBe(false);
    }
  });

  it('has an element for every delivered area', () => {
    for (const area of reachableAreas()) {
      expect(area.element, `${area.label} would route to nothing`).toBeTypeOf('function');
    }
  });
});
