/**
 * T337f — six regions, required, and no `children`. `FR-RQR-071`, `UX-0035`.
 *
 * This is the file `EPIC-034` and `EPIC-035` depend on and neither can write.
 * `UX-0035` says *"if one Room needs a seventh region, the pattern changes for
 * all three"* — a rule that decays the moment a Room can add one quietly.
 *
 * Two structural decisions carry it, and both are about what is **not**
 * expressible:
 *
 *   - **six required named props**, so a Room omitting a region does not
 *     compile. `UX-0030` stops being a convention nobody re-reads;
 *   - **no `children`**, so a seventh region has nowhere to go. A Room needing
 *     one must change this file, which is exactly what `UX-0035` asks for.
 *
 * The `@ts-expect-error` blocks are the real test. They fail the build in the
 * direction that matters: if the type ever stops rejecting a Room with five
 * regions, `tsc` reports the directive as unused and `pnpm typecheck` goes red.
 * A runtime test cannot see any of it.
 */
import { describe, expect, it } from 'vitest';
import { ROOM_REGIONS, isRoomRegion, type RoomRegion, type RoomShellProps } from '../src/regions.js';

/** A stand-in for JSX — the contract package is framework-free by design. */
const node = (name: string): unknown => ({ region: name });

const complete: RoomShellProps<unknown> = {
  objectState: node('objectState'),
  loopProgress: node('loopProgress'),
  aiAnalysis: node('aiAnalysis'),
  decision: node('decision'),
  evidence: node('evidence'),
  activityTimeline: node('activityTimeline'),
};

describe('UX-0030 · the six regions, named once for three Epics', () => {
  it('names exactly six', () => {
    expect(ROOM_REGIONS).toEqual([
      'objectState',
      'loopProgress',
      'aiAnalysis',
      'decision',
      'evidence',
      'activityTimeline',
    ]);
    expect(ROOM_REGIONS).toHaveLength(6);
  });

  it('is frozen, so a consumer cannot add a seventh at runtime', () => {
    // `as const` is erased after compilation. Without this, a Room could push a
    // region name into the shared vocabulary for every Room in the process.
    expect(Object.isFrozen(ROOM_REGIONS)).toBe(true);
    expect(() => {
      (ROOM_REGIONS as unknown as string[]).push('sidebar');
    }).toThrow();
    expect(ROOM_REGIONS).toHaveLength(6);
  });

  it('declares no duplicate region', () => {
    expect(new Set(ROOM_REGIONS).size).toBe(ROOM_REGIONS.length);
  });

  it('narrows an untrusted string, for a renderer iterating the vocabulary', () => {
    for (const region of ROOM_REGIONS) expect(isRoomRegion(region)).toBe(true);
    expect(isRoomRegion('sidebar')).toBe(false);
    expect(isRoomRegion('ObjectState')).toBe(false);
  });
});

describe('UX-0035 · a Room that omits a region does not compile', () => {
  it('accepts a Room supplying all six', () => {
    expect(Object.keys(complete).sort()).toEqual([...ROOM_REGIONS].sort());
  });

  it('rejects a Room missing one', () => {
    // @ts-expect-error — UX-0030: six required named props. A Room that forgot
    // its Evidence region is the failure this type exists to make impossible,
    // and it is exactly the one a code review would miss.
    const missing: RoomShellProps<unknown> = {
      objectState: node('objectState'),
      loopProgress: node('loopProgress'),
      aiAnalysis: node('aiAnalysis'),
      decision: node('decision'),
      activityTimeline: node('activityTimeline'),
    };
    void missing;
    expect(true).toBe(true);
  });

  it('rejects a Room inventing a seventh region', () => {
    // @ts-expect-error — UX-0035: the pattern changes for all three Rooms or it
    // does not change. A seventh region must be added HERE, which is what makes
    // that rule enforceable rather than aspirational.
    const extra: RoomShellProps<unknown> = { ...complete, sidebar: node('sidebar') };
    void extra;
    expect(true).toBe(true);
  });

  it('rejects `children`, so there is no hole to put a region in', () => {
    // The bypass a `children` prop would open: a Room renders its seventh region
    // as a child and every assertion above still passes.
    // @ts-expect-error — deliberately not part of the contract (R-033-3).
    const withChildren: RoomShellProps<unknown> = { ...complete, children: node('anything') };
    void withChildren;
    expect(true).toBe(true);
  });
});

describe('the region vocabulary IS the prop names', () => {
  it('keeps the tuple and the type in step', () => {
    // If ROOM_REGIONS and RoomShellProps could drift, a Room could satisfy the
    // type while rendering a region the vocabulary does not have — and the
    // comparison EPIC-034 T994t and EPIC-035 T998y run against this tuple would
    // pass over it.
    const keys: readonly RoomRegion[] = Object.keys(complete) as RoomRegion[];
    expect([...keys].sort()).toEqual([...ROOM_REGIONS].sort());
  });
});
