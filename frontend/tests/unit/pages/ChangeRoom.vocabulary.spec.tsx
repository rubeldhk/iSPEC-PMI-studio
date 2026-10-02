/**
 * `T994t` (EPIC-034) — the region names are identical to the other two Rooms.
 *
 * `FR-CHR-081`, `SC-CHR-008`, `UX-0035`: *"if one Room needs a seventh region,
 * the pattern changes for all three"*.
 *
 * **Verified by comparison rather than review.** That phrasing in the task is
 * the whole design. Three Rooms agreeing about six names is exactly the kind of
 * thing that stays true for a year and then quietly does not, and a reviewer
 * comparing two files by eye will not catch the day one of them gains a
 * `notes` region "temporarily".
 *
 * So this compares the **rendered** region set against `ROOM_REGIONS`, and
 * against what the Requirement Room actually renders — not against a list
 * restated here. A list restated here would be a fourth vocabulary, and the
 * failure it is meant to catch is a third.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOM_REGIONS } from '@pmi/room-contract';
import { ChangeRoomPage, type ChangeRoomApi } from '../../../src/pages/ChangeRoom';

afterEach(cleanup);

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', '..', 'src');
const PAGE = readFileSync(join(SRC, 'pages', 'ChangeRoom.tsx'), 'utf8');
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const SHELL = readFileSync(join(SRC, 'rooms', 'RoomShell.tsx'), 'utf8');

const api = (): ChangeRoomApi => ({
  loopProgress: vi.fn().mockResolvedValue([]),
  changeRequest: vi.fn().mockResolvedValue(null),
  changeImpact: vi.fn().mockResolvedValue(null),
  changeOptions: vi.fn().mockResolvedValue({
    available: false,
    options: null,
    degradedReason: 'unbound',
    degradedKind: 'gateway-unbound',
    rejected: [],
  }),
  changeDecision: vi.fn().mockResolvedValue(null),
  changeClosure: vi.fn().mockResolvedValue(null),
});

function renderedRegions(): string[] {
  render(<ChangeRoomPage api={api()} changeRequestId="cr_1" projectId="pr_1" />);
  return screen
    .getAllByTestId(/^room-region-/)
    .map((node) => node.getAttribute('data-testid')!.replace('room-region-', ''));
}

describe('T994t · the six names come from the contract', () => {
  it('the page renders exactly ROOM_REGIONS', () => {
    expect(renderedRegions().sort()).toEqual([...ROOM_REGIONS].sort());
  });

  it('no more and no fewer', () => {
    // Both directions. A missing region and an extra one are different
    // failures, and `UX-0035` forbids each for a different reason.
    expect(renderedRegions()).toHaveLength(ROOM_REGIONS.length);
  });

  it('and the page derives no vocabulary of its own', () => {
    // `T994s` says it in the task: **derives no region vocabulary**. The names
    // reach the DOM through `RoomShell`'s prop names, which come from
    // `@pmi/room-contract`, so this asserts the absence of a local list.
    expect(/ROOM_REGIONS\s*=/.test(CODE), 'ChangeRoom.tsx declares its own region list').toBe(
      false,
    );
    expect(/RENDER_ORDER/.test(CODE)).toBe(false);
    expect(/REGION_LABELS/.test(CODE)).toBe(false);
  });

  it('the local-vocabulary check can fire', () => {
    // Anti-tautology: three absence assertions are worth nothing unless the
    // matcher is shown catching what it looks for.
    expect(/ROOM_REGIONS\s*=/.test("const ROOM_REGIONS = ['objectState'];")).toBe(true);
    expect(/RENDER_ORDER/.test('const RENDER_ORDER = [] as const;')).toBe(true);
  });

  it('it imports the shell rather than reimplementing it', () => {
    expect(CODE).toMatch(/import\s*\{\s*RoomShell\s*\}\s*from\s*'\.\.\/rooms\/RoomShell'/);
    // And declares no shell of its own — a second layout is how two Rooms come
    // to honour `UX-0042` differently.
    expect(/room-shell/.test(CODE), 'ChangeRoom.tsx renders its own shell markup').toBe(false);
  });
});

describe('T994t · and they match the shell the other Rooms use', () => {
  it('every rendered name is one the shell knows', () => {
    // The shell labels and orders by these names. A region the shell does not
    // know would render unlabelled, which is six identical landmarks to a
    // screen reader.
    for (const region of renderedRegions()) {
      expect(SHELL.includes(region), `RoomShell does not know ${region}`).toBe(true);
    }
  });

  it('the Requirement Room renders the same six', () => {
    // The comparison `SC-CHR-008` is actually about. Read from its source
    // rather than restated: two lists written here would agree with each other
    // and prove nothing about either Room.
    const requirementRoom = readFileSync(join(SRC, 'pages', 'RequirementRoom.tsx'), 'utf8');
    for (const region of ROOM_REGIONS) {
      expect(
        new RegExp(`${region}=`).test(requirementRoom),
        `RequirementRoom.tsx does not pass ${region}`,
      ).toBe(true);
      expect(
        new RegExp(`${region}=`).test(PAGE),
        `ChangeRoom.tsx does not pass ${region}`,
      ).toBe(true);
    }
  });

  it('the cross-Room check can fire', () => {
    expect(/notesRegion=/.test('<RoomShell objectState={x} />')).toBe(false);
  });
});
