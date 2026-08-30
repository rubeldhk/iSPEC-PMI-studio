/**
 * `T996l`, `T996m` (EPIC-034) — an undeterminable area is `unknown`, with a
 * stated reason.
 *
 * `FR-CHR-032`, `SC-CHR-002`, acceptance scenario 2: *"an absent row and a clean
 * row must not look alike."*
 *
 * `T406p` already handles the whole view degrading — the impact source is
 * unreachable, every area becomes `unknown`. This file is about the case in
 * between, which is the common one: the source answers, and cannot determine
 * **one** area. Before `T996m` the composer had no way to hear that. An area
 * missing from the source's reply meant "checked, found nothing" — so a source
 * that could not see operational effects reported them clean.
 *
 * The three facts kept apart here:
 *
 * | state | count | means |
 * | --- | --- | --- |
 * | `impacted` | n | somebody looked and found n |
 * | `not-impacted` | `0` | somebody looked and found none |
 * | `unknown` | `null` | nobody could look, and here is why |
 *
 * Collapsing row three into row two is a clean bill of health nobody gave.
 */
import { describe, expect, it } from 'vitest';
import {
  ImpactComposer,
  type ImpactPort,
  type TraversalPort,
} from '../../src/modules/change-room/impact.composer.js';
import { IMPACT_AREAS, type ImpactAreaName } from '../../src/modules/change-room/impact.types.js';

type Finding = Awaited<ReturnType<ImpactPort['impactFor']>> extends ReadonlyMap<
  ImpactAreaName,
  infer V
>
  ? V
  : never;

const port = (entries: [ImpactAreaName, Finding][]): ImpactPort => ({
  async impactFor() {
    return new Map(entries);
  },
});

const traversal: TraversalPort = {
  async reachableFrom() {
    return ['a_1', 'a_2'];
  },
};

const input = {
  workspaceId: 'ws_1',
  changeRequestId: 'cr_1',
  changedArtifactId: 'art_1',
  traversalDepth: 25,
  now: new Date('2026-08-30T10:00:00Z'),
  id: 'iv_1',
};

describe('T996l · one area undeterminable, the rest answered', () => {
  it('marks that area unknown and says why', async () => {
    const view = await new ImpactComposer(
      port([
        ['tests', { count: 12, detail: '12 suites reference this' }],
        ['operations', { undeterminable: true, reason: 'the runbook index is offline' }],
      ]),
      traversal,
    ).compose(input);

    expect(view.areas.operations.state).toBe('unknown');
    expect(view.areas.operations.detail).toBe('the runbook index is offline');
    expect(view.areas.operations.itemCount).toBeNull();
  });

  it('without disturbing the areas that were answered', async () => {
    // The degradation is local. One blind area must not turn the other seven
    // into guesses, or a partial outage would erase a view that was mostly
    // good.
    const view = await new ImpactComposer(
      port([
        ['tests', { count: 12, detail: '12 suites reference this' }],
        ['operations', { undeterminable: true, reason: 'the runbook index is offline' }],
      ]),
      traversal,
    ).compose(input);

    expect(view.areas.tests.state).toBe('impacted');
    expect(view.areas.tests.itemCount).toBe(12);
    expect(view.areas.code.state).toBe('not-impacted');
    expect(view.areas.code.itemCount).toBe(0);
  });

  it('and still carries all eight', async () => {
    // `FR-CHR-032` — never omitted. The failure mode this forbids is dropping
    // the row the source could not answer.
    const view = await new ImpactComposer(
      port([['operations', { undeterminable: true, reason: 'the runbook index is offline' }]]),
      traversal,
    ).compose(input);
    expect(Object.keys(view.areas).sort()).toEqual([...IMPACT_AREAS].sort());
  });
});

describe('T996l · unknown never degrades to clean', () => {
  it.each([...IMPACT_AREAS])('for %s', async (area) => {
    // Every area, not a sampled one: the whole point is that no class is
    // quietly exempt.
    const view = await new ImpactComposer(
      port([[area, { undeterminable: true, reason: `no source for ${area}` }]]),
      traversal,
    ).compose(input);
    expect(view.areas[area].state).toBe('unknown');
    expect(view.areas[area].state).not.toBe('not-impacted');
    expect(view.areas[area].itemCount).not.toBe(0);
  });
});

describe('T996l · a reason is always stated', () => {
  it('substitutes one when the source gives none', async () => {
    // `FR-CHR-032` requires a reason, and a blank one is how the requirement
    // gets satisfied on paper. "The source would not say" IS a reason, and a
    // truthful one — silently rendering an empty cell is not.
    const view = await new ImpactComposer(
      port([['code', { undeterminable: true, reason: '   ' }]]),
      traversal,
    ).compose(input);

    expect(view.areas.code.state).toBe('unknown');
    expect(view.areas.code.detail.trim().length).toBeGreaterThan(0);
    expect(view.areas.code.detail).toMatch(/no reason/i);
  });

  it('no unknown area anywhere has an empty reason', async () => {
    // Including the whole-view degradation `T406p` covers, so the two paths
    // cannot drift apart.
    const broken: ImpactPort = {
      async impactFor() {
        throw new Error('graph unreachable');
      },
    };
    const view = await new ImpactComposer(broken, traversal).compose(input);
    for (const area of IMPACT_AREAS) {
      expect(view.areas[area].state).toBe('unknown');
      expect(view.areas[area].detail.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('T996l · the distinction is visible to a caller', () => {
  it('a view can be asked which areas nobody could determine', async () => {
    // `SC-CHR-002` is measured over views, and a screen has to render the
    // difference. Both need this answerable without re-deriving it from
    // `state` at four call sites.
    const view = await new ImpactComposer(
      port([
        ['tests', { count: 1, detail: 'one' }],
        ['operations', { undeterminable: true, reason: 'the runbook index is offline' }],
        ['release', { undeterminable: true, reason: 'no release calendar configured' }],
      ]),
      traversal,
    ).compose(input);

    const undetermined = Object.values(view.areas)
      .filter((a) => a.state === 'unknown')
      .map((a) => a.area)
      .sort();
    expect(undetermined).toEqual(['operations', 'release']);
  });
});
