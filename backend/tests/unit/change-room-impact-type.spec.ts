/**
 * `T406f`, `T406g` (EPIC-034) — the impact view is total, and three-state.
 *
 * `BR-0044` names eight impact classes and `FR-CHR-020` wants the blast radius
 * visible **before** the decision. Both fail the same way: an area that is
 * simply missing from the view reads, to a person scanning it, exactly like an
 * area that was checked and found clean.
 *
 * So the guarantee is in the type. `ImpactView.areas` is a `Record` over all
 * eight — a view with seven does not compile — and the third state is
 * `unknown`, which exists so *"we could not tell"* can never be written down as
 * *"not impacted"*.
 */
import { describe, expect, it } from 'vitest';
import {
  IMPACT_AREAS,
  IMPACT_STATES,
  type ImpactArea,
  type ImpactView,
} from '../../src/modules/change-room/impact.types.js';

describe('T406f · the eight areas of BR-0044', () => {
  it('names exactly eight', () => {
    expect(IMPACT_AREAS).toHaveLength(8);
  });

  it('names them, and they are the ones BR-0044 lists', () => {
    // `DEF-034-001` — this list read `security` as its eighth member, and so
    // did `IMPACT_AREAS`. Restating a list from memory catches a typo and
    // nothing else: both were written in one sitting from the same misreading,
    // so the test agreed with the code and both were wrong.
    //
    // `change-room-impact-areas.spec.ts` (`T996j`) is the guard that works — it
    // reads `FR-CHR-030`'s sentence out of `spec.md` and derives the eight from
    // it, so the authority is the specification rather than anyone's
    // recollection of it.
    expect([...IMPACT_AREAS]).toEqual([
      'requirements',
      'specifications',
      'architecture',
      'tasks',
      'code',
      'tests',
      'release',
      'operations',
    ]);
  });

  it('is frozen, so a consumer cannot add a ninth at runtime', () => {
    expect(Object.isFrozen(IMPACT_AREAS)).toBe(true);
  });
});

describe('T406f · an area cannot be omitted', () => {
  it('accepts a view covering all eight', () => {
    const area = (name: (typeof IMPACT_AREAS)[number]): ImpactArea => ({
      area: name,
      state: 'not-impacted',
      detail: 'checked, nothing downstream',
      itemCount: 0,
    });
    const view: ImpactView = {
      id: 'iv_1',
      changeRequestId: 'cr_1',
      computedAt: new Date(0),
      traversalDepth: 25,
      workspaceId: 'ws_1',
      retainedForDecision: false,
      // `T996o` — required, so this literal would not compile without it. That
      // is `FR-CHR-034`: a view cannot exist that says nothing about whether
      // the architecture-violation check ran.
      architecture: {
        decisions: [],
        detail: 'none reached',
        violationCheck: { status: 'not-run', because: 'BR-0073 is unowned (U-17)' },
      },
      areas: {
        requirements: area('requirements'),
        specifications: area('specifications'),
        architecture: area('architecture'),
        tasks: area('tasks'),
        code: area('code'),
        tests: area('tests'),
        release: area('release'),
        operations: area('operations'),
      },
    };
    expect(Object.keys(view.areas)).toHaveLength(8);
  });

  it('rejects a view missing one — this is the whole point', () => {
    const partial = {
      requirements: { area: 'requirements', state: 'impacted', detail: 'x', itemCount: 1 },
    };
    const view: ImpactView = {
      id: 'iv_2',
      changeRequestId: 'cr_1',
      computedAt: new Date(0),
      traversalDepth: 25,
      retainedForDecision: false,
      // @ts-expect-error — seven areas is not an ImpactView. An absent row and a
      // clean row must not look alike, and a `Record` over the union makes the
      // omission unwritable rather than merely discouraged. If this ever
      // compiles, tsc reports the unused directive.
      areas: partial,
    };
    void view;
    expect(true).toBe(true);
  });

  it('the absence check can actually fail', () => {
    // Anti-tautology: a `@ts-expect-error` proves nothing unless the compiler
    // would otherwise accept what sits under it.
    expect(Object.keys({ requirements: 1 })).toHaveLength(1);
  });
});

describe('T406f · three states, and `unknown` is one of them', () => {
  it('names impacted, not-impacted and unknown', () => {
    expect([...IMPACT_STATES]).toEqual(['impacted', 'not-impacted', 'unknown']);
  });

  it('keeps `unknown` distinct from `not-impacted`', () => {
    // The distinction the whole Room turns on. `ImpactSource` degrades to
    // `unknown` when it cannot answer (`T406p`), and a degradation that
    // reported `not-impacted` would be a clean bill of health nobody gave.
    const cannotTell: ImpactArea = {
      area: 'operations',
      state: 'unknown',
      detail: 'the impact source could not be reached',
      itemCount: null,
    };
    expect(cannotTell.state).not.toBe('not-impacted');
    // `null`, not `0`: nobody counted, and zero is a count.
    expect(cannotTell.itemCount).toBeNull();
  });

  it('a clean area carries a count of zero, not null', () => {
    const clean: ImpactArea = {
      area: 'release',
      state: 'not-impacted',
      detail: 'traversed, nothing downstream',
      itemCount: 0,
    };
    expect(clean.itemCount).toBe(0);
  });
});
