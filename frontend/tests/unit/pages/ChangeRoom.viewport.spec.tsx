/**
 * `T994w` (EPIC-034) — the 360px floor. `FR-CHR-085`, `UX-0040`, `UX-0042`.
 *
 * State, decision and evidence remain visible at 360px, **using the imported
 * shell's breakpoints**.
 *
 * ## What this file deliberately does not do
 *
 * It does not measure pixels. jsdom has no layout engine, so a test asserting a
 * rendered width would be asserting a number jsdom made up — which is worse
 * than no test, because it reads as coverage for the one requirement most
 * likely to be broken by a stylesheet change.
 *
 * What it asserts instead is the thing that *can* be established here and that
 * actually decides the outcome: the three retained regions are marked as
 * retained **by the shell**, this page contributes no breakpoint of its own,
 * and all six regions stay in the DOM at every width.
 *
 * That last one matters more than it looks. `RETAINED_AT_360` is about
 * **priority, not removal** — dropping three regions at 360px would take them
 * from a screen reader too, on the viewport size most correlated with a phone.
 * A page that "helpfully" hid them would pass a visual check and fail the
 * people it was meant to help.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ROOM_REGIONS } from '@pmi/room-contract';
import { ChangeRoomPage, type ChangeRoomApi } from '../../../src/pages/ChangeRoom';

afterEach(cleanup);

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', '..', 'src');
const PAGE = readFileSync(join(SRC, 'pages', 'ChangeRoom.tsx'), 'utf8');
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const api = (): ChangeRoomApi => ({
  loopProgress: vi.fn().mockResolvedValue([]),
  changeRequest: vi.fn().mockResolvedValue({
    id: 'cr_1',
    projectId: 'pr_1',
    targetBaselineId: 'b_1',
    targetBaselineVersion: 2,
    requestedOutcome: 'notify within one hour',
    reason: 'the regulator shortened the window',
    requester: 'u_1',
    urgency: 'normal',
    state: 'open',
    openQuestions: [],
    rebasedFrom: null,
  }),
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

const renderRoom = () =>
  render(<ChangeRoomPage api={api()} changeRequestId="cr_1" projectId="pr_1" />);

describe('T994w · the three UX-0042 regions are marked retained', () => {
  it.each(['objectState', 'decision', 'evidence'])('%s', async (region) => {
    renderRoom();
    await screen.findByTestId('room-shell');
    expect(
      screen.getByTestId(`room-region-${region}`).getAttribute('data-narrow-viewport'),
    ).toBe('retained');
  });

  it('and the other three are not — or the marking says nothing', async () => {
    // The control. If every region were marked retained, the three assertions
    // above would pass while `UX-0042` had no content at all.
    renderRoom();
    await screen.findByTestId('room-shell');
    for (const region of ['loopProgress', 'aiAnalysis', 'activityTimeline']) {
      expect(
        screen.getByTestId(`room-region-${region}`).getAttribute('data-narrow-viewport'),
      ).toBeNull();
    }
  });
});

describe('T994w · all six stay in the DOM at every width', () => {
  it('none is removed', async () => {
    // `RETAINED_AT_360` is priority, not removal. A page that hid three regions
    // on a narrow screen would take them from a screen reader too, on the
    // viewport most correlated with a phone.
    renderRoom();
    await screen.findByTestId('room-shell');
    for (const region of ROOM_REGIONS) {
      expect(screen.queryByTestId(`room-region-${region}`), `${region} was removed`).not.toBeNull();
    }
  });

  it('and the page renders no width-conditional branch', async () => {
    // The mechanism that would break it. A `matchMedia` or an
    // `innerWidth < 360` here would put layout back in the page, which is the
    // bypass `RoomShell` refuses to offer as a prop.
    expect(/matchMedia/.test(CODE), 'ChangeRoom.tsx queries the viewport').toBe(false);
    expect(/innerWidth/.test(CODE)).toBe(false);
    expect(/360/.test(CODE), 'ChangeRoom.tsx names a breakpoint').toBe(false);
  });

  it('the width-branch check can fire', () => {
    expect(/matchMedia/.test('const narrow = window.matchMedia("(max-width: 360px)");')).toBe(true);
    expect(/360/.test('if (width < 360) return null;')).toBe(true);
  });
});

describe('T994w · the breakpoints belong to the shell', () => {
  it('the page passes it exactly the six regions and nothing else', async () => {
    // `RoomShell` takes no `className`, width or breakpoint override, and the
    // bypass that would end the guarantee is not a redesign — it is a
    // convenience prop nobody argues about.
    //
    // Read at the shell's own indentation. A substring search over the whole
    // invocation finds the `className` on every region's inner div and reports
    // a bypass that is not there — which is how a check like this gets deleted
    // for crying wolf rather than tightened.
    const invocation = CODE.slice(CODE.indexOf('<RoomShell'));
    const props = [...invocation.matchAll(/^ {6}([A-Za-z]+)=\{/gm)].map((m) => m[1]!);
    expect(props.sort()).toEqual([...ROOM_REGIONS].sort());
  });

  it('the prop-extraction can fire', () => {
    // Anti-tautology for the matcher above: it must actually find props, and
    // must notice one that does not belong.
    const sample = ['<RoomShell', '      objectState={a}', '      className={b}', '    />'].join(
      '\n',
    );
    expect([...sample.matchAll(/^ {6}([A-Za-z]+)=\{/gm)].map((m) => m[1])).toEqual([
      'objectState',
      'className',
    ]);
  });

  it('and the marking comes from the shell, not from here', async () => {
    expect(/data-narrow-viewport/.test(CODE), 'ChangeRoom.tsx sets the marking itself').toBe(
      false,
    );
    const shell = readFileSync(join(SRC, 'rooms', 'RoomShell.tsx'), 'utf8');
    expect(shell.includes('data-narrow-viewport')).toBe(true);
  });

  it('the marking-source check can fire', () => {
    expect(/data-narrow-viewport/.test('<div data-narrow-viewport="retained" />')).toBe(true);
  });

  it('state, decision and evidence carry real content at the floor', async () => {
    // Marked retained and empty would satisfy the letter of `UX-0042` and none
    // of its point.
    renderRoom();
    await waitFor(() =>
      expect(screen.getByTestId('room-region-objectState').textContent).toContain(
        'notify within one hour',
      ),
    );
    expect(screen.getByTestId('room-region-decision').textContent!.length).toBeGreaterThan(10);
    expect(screen.getByTestId('room-region-evidence').textContent).toMatch(/not closed/i);
  });
});
