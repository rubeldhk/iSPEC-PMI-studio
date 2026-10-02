/**
 * `T406n`, `T406o` (EPIC-034) — the impact composer.
 *
 * The assertion that matters is the asymmetry: an unreachable impact source
 * **degrades to `unknown`** rather than refusing (`FR-CHR-032`), while the
 * Room's other four ports refuse when absent.
 *
 * The difference is what each absence means. No policy provider means nobody
 * authorised the change. No impact source means nobody could see the blast
 * radius — a fact a decision-maker can weigh, provided they are told. What must
 * never happen is the degradation reading as `not-impacted`, which is a clean
 * bill of health nobody gave.
 */
import { describe, expect, it } from 'vitest';
import {
  ImpactComposer,
  type ImpactPort,
  type TraversalPort,
} from '../../src/modules/change-room/impact.composer.js';
import { IMPACT_AREAS, type ImpactAreaName } from '../../src/modules/change-room/impact.types.js';

const traversal: TraversalPort = {
  reachableFrom: async () => ['spec_1', 'task_2'],
};

const impactWith = (
  entries: [ImpactAreaName, { count: number; detail: string }][],
): ImpactPort => ({
  impactFor: async () => new Map(entries),
});

const unreachable: ImpactPort = {
  impactFor: async () => {
    throw new Error('the dependency graph is unreachable');
  },
};

const input = {
  workspaceId: 'ws_1',
  changeRequestId: 'cr_1',
  changedArtifactId: 'spec_1',
  traversalDepth: 25,
  now: new Date('2026-08-30T00:00:00Z'),
  id: 'iv_1',
};

describe('T406n · it composes, and owns no graph', () => {
  it('returns all eight areas whatever the source said', async () => {
    const composer = new ImpactComposer(
      impactWith([['requirements', { count: 3, detail: 'three requirements downstream' }]]),
      traversal,
    );
    const view = await composer.compose(input);
    expect(Object.keys(view.areas).sort()).toEqual([...IMPACT_AREAS].sort());
  });

  it('records the depth it was given, and names no number of its own', async () => {
    // `R-034-1` — `DEFAULT_IMPACT_DEPTH` is adopted, passed in, never chosen
    // here. The independence test asserts the constant is absent from the
    // module; this asserts the value travels.
    const composer = new ImpactComposer(impactWith([]), traversal);
    const view = await composer.compose({ ...input, traversalDepth: 25 });
    expect(view.traversalDepth).toBe(25);
  });

  it('marks an area the source reported as impacted, with its count', async () => {
    const composer = new ImpactComposer(
      impactWith([['tests', { count: 12, detail: 'twelve tests reference it' }]]),
      traversal,
    );
    const view = await composer.compose(input);
    expect(view.areas.tests.state).toBe('impacted');
    expect(view.areas.tests.itemCount).toBe(12);
  });

  it('marks an area the source did not report as not-impacted, counted zero', async () => {
    // Somebody looked, and found nothing. That is a different fact from nobody
    // looking, which is why the count is `0` and not `null`.
    const composer = new ImpactComposer(impactWith([]), traversal);
    const view = await composer.compose(input);
    expect(view.areas.operations.state).toBe('not-impacted');
    expect(view.areas.operations.itemCount).toBe(0);
  });

  it('is not retained until a decision references it', async () => {
    // `FR-CHR-035`.
    const composer = new ImpactComposer(impactWith([]), traversal);
    expect((await composer.compose(input)).retainedForDecision).toBe(false);
  });
});

describe('T406n · an unreachable source DEGRADES', () => {
  it('returns unknown for every area rather than refusing', async () => {
    // `FR-CHR-032`. Refusing would make a graph outage block every change,
    // including the urgent ones the outage has nothing to do with.
    const composer = new ImpactComposer(unreachable, traversal);
    const view = await composer.compose(input);
    for (const area of IMPACT_AREAS) {
      expect(view.areas[area].state, `${area} did not degrade`).toBe('unknown');
    }
  });

  it('never reports not-impacted when it could not tell', async () => {
    // The assertion this whole component exists for.
    const composer = new ImpactComposer(unreachable, traversal);
    const view = await composer.compose(input);
    const states = IMPACT_AREAS.map((a) => view.areas[a].state);
    expect(states).not.toContain('not-impacted');
  });

  it('counts nothing, and says why', async () => {
    const composer = new ImpactComposer(unreachable, traversal);
    const view = await composer.compose(input);
    expect(view.areas.code.itemCount).toBeNull();
    expect(view.areas.code.detail).toMatch(/could not be reached/i);
    expect(view.areas.code.detail).toMatch(/unreachable/i);
  });

  it('still produces a usable view — degrade means proceed, informed', async () => {
    const composer = new ImpactComposer(unreachable, traversal);
    const view = await composer.compose(input);
    expect(view.id).toBe('iv_1');
    expect(view.traversalDepth).toBe(25);
  });
});

describe('T406n · a failing traversal is not fatal either', () => {
  it('still composes when reachability cannot be read', async () => {
    const failing: TraversalPort = {
      reachableFrom: async () => {
        throw new Error('no chain source');
      },
    };
    const composer = new ImpactComposer(impactWith([]), failing);
    const view = await composer.compose(input);
    // The impact source answered, so the areas are known; only the detail is
    // thinner. A traversal failure must not turn a known area unknown.
    expect(view.areas.tasks.state).toBe('not-impacted');
    expect(view.areas.tasks.detail).toMatch(/nothing downstream/i);
  });

  it('widens the detail when reachability IS available', async () => {
    // The control: without it, the assertion above would pass against a
    // composer that ignored the traversal entirely.
    const composer = new ImpactComposer(impactWith([]), traversal);
    const view = await composer.compose(input);
    expect(view.areas.tasks.detail).toMatch(/2 reachable/);
  });
});
