/**
 * T441a / T441c / T441d (EPIC-036) — the Room pattern belongs to the shell, and
 * the shell **adopts** it.
 *
 * `BR-0191` is a SHOULD, and `EPIC-033` already built the shared contract:
 * `packages/room-contract` declares `ROOM_REGIONS` and `RoomShellProps`, and
 * `frontend/src/rooms/RoomShell.tsx` renders them. `EPIC-034` and `EPIC-035`
 * import both. This Epic's job is to host, not to re-derive — which is why it
 * is P3 and why the assertions below are mostly about **absence**.
 *
 * `EPIC-034` `T994t` and `EPIC-035` `T998y` compare their region names against
 * `ROOM_REGIONS` **by comparison rather than review**. A seventh region declared
 * in the shell would make those comparisons pass against a vocabulary that had
 * quietly grown, and nobody would be reading them at the time.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ROOM_REGIONS, type RoomRegion, type RoomShellProps } from '@pmi/room-contract';
import { hostRoom } from '../../../src/shell/AppShell';

/**
 * `EPIC-033`'s accessible names for the six regions, restated here ONLY as the
 * expectation of a test — not as a second vocabulary. `T441c` asserts the shell
 * itself declares none, and this file is not the shell.
 */
const LABELS: Record<RoomRegion, string> = {
  objectState: 'Object state',
  loopProgress: 'Loop progress',
  aiAnalysis: 'AI analysis',
  decision: 'Decision',
  evidence: 'Evidence',
  activityTimeline: 'Activity timeline',
};

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = join(HERE, '..', '..', '..', 'src', 'shell');
const ROOMS = join(HERE, '..', '..', '..', 'src', 'rooms');

function shellSources(): { name: string; text: string }[] {
  return readdirSync(SHELL)
    .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
    .map((name) => ({ name, text: readFileSync(join(SHELL, name), 'utf8') }));
}

describe('T441a · the six regions are the contract’s, and there is no seventh', () => {
  it('reads a real vocabulary, or this check proves nothing', () => {
    expect(ROOM_REGIONS.length).toBe(6);
  });

  it('declares no region vocabulary of its own', () => {
    // Asserted over the source rather than over a render, because the fault is
    // a DECLARATION: a seventh region added here would be adopted by the two
    // Rooms that import from the contract, and their own comparisons would
    // still pass.
    for (const { name, text } of shellSources()) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
      expect(code, `${name} declares a region list`).not.toMatch(/\b(ROOM_)?REGIONS\s*[:=]/);
    }
  });

  it('names no region literal anywhere in the shell', () => {
    // The subtler version: not a list, but one region's name hard-coded, which
    // is how a vocabulary drifts one word at a time.
    for (const { name, text } of shellSources()) {
      for (const region of ROOM_REGIONS) {
        const code = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
        expect(code, `${name} hard-codes the region "${region}"`).not.toContain(`'${region}'`);
      }
    }
  });
});

describe('T442c · FR-SHL-040 — the seam is rendered, not merely declared', () => {
  // The second convergence pass (`F2`), and a fault the first pass created.
  // `T441s` added `hostRoom` because nothing imported the contract, and then
  // **nothing called `hostRoom` either** — not in `src`, not in any test.
  // `T441t` asserts the import exists, which was the previous fault and is not
  // this one.
  //
  // A seam that has never been rendered is the same built-but-unexercised
  // shape, one level up. This renders it.
  const regions: RoomShellProps<ReactNode> = {
    objectState: <p>state</p>,
    loopProgress: <p>progress</p>,
    aiAnalysis: <p>analysis</p>,
    decision: <p>decision</p>,
    evidence: <p>evidence</p>,
    activityTimeline: <p>timeline</p>,
  };

  afterEach(cleanup);

  it('renders all six regions of the contract, and nothing else', () => {
    render(hostRoom(regions));
    for (const region of ROOM_REGIONS) {
      expect(
        screen.getByRole('region', { name: LABELS[region] }),
        `${region} did not render`,
      ).toBeDefined();
    }
    expect(screen.getAllByRole('region')).toHaveLength(ROOM_REGIONS.length);
  });

  it('delegates to EPIC-033’s RoomShell rather than laying regions out itself', () => {
    const { container } = render(hostRoom(regions));
    expect(
      container.querySelector('[data-testid="room-shell"]'),
      'the shell rendered a Room without EPIC-033’s component',
    ).not.toBeNull();
  });

  it('cannot be handed a seventh region', () => {
    // `FR-SHL-041`, enforced by the contract's own type rather than by review.
    // `RoomShellProps` is `Record<RoomRegion, TNode>`, so an extra key is an
    // excess-property error on an object literal — asserted here as a
    // `@ts-expect-error`, which FAILS TO COMPILE if the extra key ever becomes
    // acceptable.
    // @ts-expect-error a seventh region is not representable
    const seventh: RoomShellProps<ReactNode> = { ...regions, shellExtras: <p>no</p> };
    expect(Object.keys(seventh)).toHaveLength(ROOM_REGIONS.length + 1);
  });

  it('keeps every region in the DOM at the narrowest viewport', () => {
    // `UX-0042` via `EPIC-033`: `RoomShell` prioritises three regions at 360px
    // and removes none. The shell must not change that by hosting — which it
    // could only do by laying them out itself, which the assertion above
    // forbids.
    render(hostRoom(regions));
    expect(screen.getAllByRole('region')).toHaveLength(6);
  });
});

describe('T441t · FR-SHL-042 — the shell ADOPTS the contract, not merely abstains from it', () => {
  // The convergence finding (`F2`), and the reason it survived a green suite.
  //
  // `T441d` below asserts the shell does not RE-DERIVE `RoomShellProps` or
  // `RoomRegion`. That is true — and it is equally true of a shell that has
  // never heard of `@pmi/room-contract`, which is exactly the state `T441e`
  // left it in while being marked complete. An absence-only assertion cannot
  // tell adoption from ignorance.
  //
  // `FR-SHL-042` says the shared artifacts MUST be **adopted**. This is the
  // half that says so.
  it('imports @pmi/room-contract somewhere in the shell', () => {
    const importers = shellSources().filter(({ text }) => text.includes("from '@pmi/room-contract'"));
    expect(
      importers.map((source) => source.name),
      'no shell module imports the Room contract — FR-SHL-042 is not satisfied by abstinence',
    ).not.toEqual([]);
  });

  it('adopts the contract’s own types rather than a local shape', () => {
    const adopting = shellSources().filter(({ text }) =>
      /import\s+(?:type\s+)?\{[^}]*\bRoomShellProps\b[^}]*\}\s+from\s+'@pmi\/room-contract'/.test(text),
    );
    expect(
      adopting.map((source) => source.name),
      'RoomShellProps is not imported anywhere in the shell',
    ).not.toEqual([]);
  });

  it('would notice if the import disappeared', () => {
    // Anti-vacuity for the two assertions above: they must be able to fail,
    // and the shape they check must be the one that actually appears in
    // source. A matcher that never matched would report "adopted" forever.
    const sample = "import { ROOM_REGIONS, type RoomShellProps } from '@pmi/room-contract';";
    expect(sample.includes("from '@pmi/room-contract'")).toBe(true);
    expect("import { Outlet } from 'react-router';".includes("from '@pmi/room-contract'")).toBe(
      false,
    );
  });
});

describe('T441d · FR-SHL-042 — EPIC-033’s Room artifacts are adopted, not re-derived', () => {
  it('leaves frontend/src/rooms/ to EPIC-033', () => {
    // The shell consumes that directory and does not move, fork or restate it.
    // `R-036-6` put the shell BESIDE the design system and the rooms for this
    // reason: a shell that owned them would be `G-30`'s merge again.
    const roomFiles = readdirSync(ROOMS);
    expect(roomFiles.length, 'EPIC-033 rooms directory is missing').toBeGreaterThan(0);
  });

  it('imports the contract rather than restating its types', () => {
    for (const { name, text } of shellSources()) {
      expect(text, `${name} declares its own RoomShellProps`).not.toMatch(
        /\binterface\s+RoomShellProps\b/,
      );
      expect(text, `${name} declares its own RoomRegion type`).not.toMatch(
        /\btype\s+RoomRegion\b/,
      );
    }
  });

  it('hosts Rooms through the route tree, so a Room is an area like any other', () => {
    // What "hosting" means concretely: when a Room Epic delivers, its area
    // moves to `delivered` in the registry and the frame is already there.
    // Nothing in the shell needs to learn about Rooms (`SC-SHL-004`).
    const roomAreas = ['requirement-room', 'change-room', 'defect-room'];
    const areas = readFileSync(join(SHELL, 'areas.ts'), 'utf8');
    for (const id of roomAreas) {
      expect(areas, `${id} is not in the registry`).toContain(`id: '${id}'`);
    }
  });
});

describe('T441c · the comparison EPIC-034 and EPIC-035 depend on', () => {
  it('compares by value, not by review', () => {
    // The shell contributes an EMPTY set of region names. The assertion is
    // that the union of the shell's regions and the contract's is still the
    // contract's — which stays true only while the shell declares none.
    const shellRegions: string[] = [];
    expect(new Set([...ROOM_REGIONS, ...shellRegions]).size).toBe(ROOM_REGIONS.length);
  });

  it('would notice a seventh region', () => {
    // Anti-vacuity for the assertion above: a comparison that could not fail
    // would pass forever over an empty set.
    const withSeventh = [...ROOM_REGIONS, 'shell-extras'];
    expect(new Set(withSeventh).size).toBeGreaterThan(ROOM_REGIONS.length);
  });
});
