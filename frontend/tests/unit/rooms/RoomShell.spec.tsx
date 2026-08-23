/**
 * T337m — the shared Room shell. `FR-RQR-070`, `FR-RQR-071`, `UX-0030`,
 * `UX-0040`, `UX-0041`, `UX-0042`.
 *
 * Written to FAIL before `T337n` exists (Constitution V).
 *
 * **Path note.** `tasks.md` names this file `frontend/src/rooms/RoomShell.test.tsx`.
 * It is here instead, because the `frontend` vitest project collects
 * `tests/unit/**\/*.spec.{ts,tsx}` and nothing else — a test at the path the
 * task named would never have been collected, and a test that never runs is
 * worse than no test, because it reads as coverage. The SOURCE path in the task
 * is correct and unchanged; only the test's location moved, to where the runner
 * actually looks. Recorded rather than silently corrected.
 *
 * What this file is really asserting: that **one component owns the layout**, so
 * three Rooms cannot drift. `UX-0042` requires state, decision and evidence to
 * stay visible at 360px, and one component honouring that is better than three
 * agreeing to.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ROOM_REGIONS } from '@pmi/room-contract';
import { RoomShell } from '../../../src/rooms/RoomShell';

afterEach(cleanup);

/** Six distinguishable regions, so a missing one is visible rather than inferred. */
const REGIONS = {
  objectState: <p>object state content</p>,
  loopProgress: <p>loop progress content</p>,
  aiAnalysis: <p>ai analysis content</p>,
  decision: <p>decision content</p>,
  evidence: <p>evidence content</p>,
  activityTimeline: <p>activity timeline content</p>,
};

describe('UX-0030 · all six regions render', () => {
  it('renders every region the contract names', () => {
    render(<RoomShell {...REGIONS} />);
    for (const region of ROOM_REGIONS) {
      expect(screen.getByTestId(`room-region-${region}`)).toBeDefined();
    }
  });

  it('renders each region\'s own content, not a shared slot', () => {
    render(<RoomShell {...REGIONS} />);
    expect(within(screen.getByTestId('room-region-decision')).getByText('decision content')).toBeDefined();
    expect(within(screen.getByTestId('room-region-evidence')).getByText('evidence content')).toBeDefined();
  });

  it('renders exactly six regions and no seventh', () => {
    const { container } = render(<RoomShell {...REGIONS} />);
    expect(container.querySelectorAll('[data-testid^="room-region-"]')).toHaveLength(6);
  });

  it('names the regions with the contract\'s vocabulary, not its own', () => {
    // FR-RQR-071 / UX-0035. This is the assertion EPIC-034 T994t and EPIC-035
    // T998y run against their own Rooms; it holds here first, or theirs compares
    // against something already wrong.
    const { container } = render(<RoomShell {...REGIONS} />);
    const rendered = [...container.querySelectorAll('[data-testid^="room-region-"]')]
      .map((el) => el.getAttribute('data-testid')?.replace('room-region-', ''))
      .sort();
    expect(rendered).toEqual([...ROOM_REGIONS].sort());
  });

  it('gives every region a landmark with an accessible name', () => {
    // SC-RQR-008 inherits EPIC-029's accessibility obligation. Six unlabelled
    // <div>s render identically to a screen reader, which is the failure mode a
    // visual check cannot see.
    render(<RoomShell {...REGIONS} />);
    for (const region of ROOM_REGIONS) {
      const el = screen.getByTestId(`room-region-${region}`);
      expect(el.getAttribute('aria-label')).toBeTruthy();
    }
  });
});

describe('UX-0040, UX-0042 · the 360px floor', () => {
  it('marks state, decision and evidence as the regions that survive the narrowest viewport', () => {
    // UX-0042 names these three specifically. The shell carries the marker so a
    // Room cannot decide for itself which of its regions is expendable — and so
    // EPIC-034 and EPIC-035 inherit the same three without re-deciding.
    render(<RoomShell {...REGIONS} />);
    for (const region of ['objectState', 'decision', 'evidence'] as const) {
      expect(screen.getByTestId(`room-region-${region}`).dataset['narrowViewport']).toBe('retained');
    }
  });

  it('does not mark the other three, or the distinction says nothing', () => {
    render(<RoomShell {...REGIONS} />);
    for (const region of ['loopProgress', 'aiAnalysis', 'activityTimeline'] as const) {
      expect(screen.getByTestId(`room-region-${region}`).dataset['narrowViewport']).toBeUndefined();
    }
  });

  it('still RENDERS all six at any width — retained is about priority, not removal', () => {
    // The misreading this guards against: dropping three regions from the DOM at
    // 360px. UX-0042 asks that three remain VISIBLE, not that the others cease
    // to exist — and removing them from the markup would take them from a
    // screen reader too, on a viewport size that correlates with mobile.
    const { container } = render(<RoomShell {...REGIONS} />);
    expect(container.querySelectorAll('[data-testid^="room-region-"]')).toHaveLength(6);
  });
});

describe('UX-0041 · the shell owns the breakpoints, so no Room sets its own', () => {
  it('applies its own layout class rather than expecting one', () => {
    render(<RoomShell {...REGIONS} />);
    expect(screen.getByTestId('room-shell').className).toContain('room-shell');
  });

  it('takes no className, width or breakpoint prop', () => {
    // The bypass that would end the guarantee: a Room passing its own layout.
    // Three Rooms with three breakpoint sets is exactly the divergence UX-0035
    // forbids, and it would arrive as a convenience prop nobody argued about.
    // @ts-expect-error — RoomShellProps is the six regions and nothing else.
    const withClass = <RoomShell {...REGIONS} className="my-own-layout" />;
    void withClass;
    expect(true).toBe(true);
  });
});
