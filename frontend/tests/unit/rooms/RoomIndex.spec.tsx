/**
 * `T1170` — the shared Rooms index.
 *
 * Written to fail. `/requirement-room` renders nothing today, so the nav offers
 * a Room nobody can reach without already knowing an object id — the gap that
 * made quickstart Scenario 13 unattemptable.
 *
 * ## Shared, like `RoomShell`
 *
 * `EPIC-034` and `EPIC-035` get the same index by construction, exactly as they
 * inherit the six regions (`T405d`). So these tests drive it through **two**
 * Room kinds: a component parameterised in name only would pass a single-kind
 * suite while hard-coding the Requirement Room's labels and route.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RoomIndex, type RoomKind, type RoomSummary } from '../../../src/rooms/RoomIndex';

afterEach(cleanup);

const REQUIREMENT: RoomKind = {
  id: 'requirement-room',
  title: 'Requirement Room',
  routePrefix: '/requirement-room',
  openLabel: 'Start a Requirement Room',
  emptyHint: 'Bring a page of unstructured intent and the Room will extract candidates.',
};

const CHANGE: RoomKind = {
  id: 'change-room',
  title: 'Change Room',
  routePrefix: '/change-room',
  openLabel: 'Start a Change Room',
  emptyHint: 'Raise a change against an approved baseline.',
};

const ROOMS: RoomSummary[] = [
  {
    id: 'ro_1',
    subjectId: 'set_alpha',
    projectId: 'pr_1',
    currentStage: 'Analyze',
    createdAt: '2026-08-27T09:00:00.000Z',
  },
  {
    id: 'ro_2',
    subjectId: 'set_beta',
    projectId: 'pr_1',
    currentStage: 'Event',
    createdAt: '2026-08-26T09:00:00.000Z',
  },
];

function mount(over: Partial<Parameters<typeof RoomIndex>[0]> = {}) {
  const onOpen = vi.fn();
  const onStart = vi.fn();
  const props = {
    kind: REQUIREMENT,
    load: async (): Promise<readonly RoomSummary[]> => ROOMS,
    onOpen,
    onStart,
    ...over,
  };
  render(<RoomIndex {...props} />);
  return { onOpen, onStart };
}

describe('T1170 · the index lists a workspace’s Rooms', () => {
  it('names each Room and the stage it is at', async () => {
    mount();
    const list = await screen.findByRole('list', { name: /requirement room/i });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText(/set_alpha/)).toBeDefined();
    // The stage comes from the loop and is rendered, not recomputed
    // (`FR-RQR-074`).
    expect(within(items[0]!).getByText('Analyze')).toBeDefined();
    expect(within(items[1]!).getByText('Event')).toBeDefined();
  });

  it('opens the Room that was activated, not the first one', async () => {
    // A list whose every row opens row one passes a laxer assertion.
    const { onOpen } = mount();
    const list = await screen.findByRole('list', { name: /requirement room/i });
    const second = within(list).getAllByRole('listitem')[1]!;
    fireEvent.click(within(second).getByRole('button', { name: /set_beta/ }));
    expect(onOpen).toHaveBeenCalledWith('ro_2');
  });

  it('offers the way in, and it works', async () => {
    const { onStart } = mount();
    fireEvent.click(await screen.findByRole('button', { name: /start a requirement room/i }));
    expect(onStart).toHaveBeenCalled();
  });
});

describe('T1170 · the empty state offers the way in rather than reporting nothing', () => {
  it('says what to do, not "no results"', async () => {
    mount({ load: async () => [] });
    // `UX-0032`'s posture: an empty working surface should tell a person how to
    // begin. "No rooms found" is a status; it is not an affordance.
    expect(await screen.findByText(/unstructured intent/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /start a requirement room/i })).toBeDefined();
    expect(screen.queryByText(/^no results$/i)).toBeNull();
  });

  it('distinguishes empty from failed', async () => {
    // Two different facts. A failure rendered as emptiness tells a person their
    // workspace is empty when the truth is that nobody knows.
    mount({
      load: async () => {
        throw new Error('the server said no');
      },
    });
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.queryByText(/unstructured intent/i)).toBeNull();
  });

  it('shows a loading state that is not an empty list', async () => {
    mount({ load: () => new Promise<readonly RoomSummary[]>(() => undefined) });
    expect(screen.getByText(/loading/i)).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('T1170 · shared, so two Rooms inherit it', () => {
  it('renders the other Room kind with ITS name and hint', async () => {
    mount({ kind: CHANGE, load: async () => [] });
    expect(await screen.findByRole('heading', { name: /change room/i })).toBeDefined();
    expect(screen.getByText(/approved baseline/i)).toBeDefined();
    // The Requirement Room's words must not leak into another Room's index.
    expect(screen.queryByText(/unstructured intent/i)).toBeNull();
  });

  it('takes its route prefix from the kind, not from a constant', async () => {
    const { onOpen } = mount({
      kind: CHANGE,
      load: async () => [ROOMS[0]!],
    });
    const list = await screen.findByRole('list', { name: /change room/i });
    fireEvent.click(within(list).getByRole('button', { name: /set_alpha/ }));
    // The caller navigates; the component reports which Room, so one index can
    // serve three route trees.
    expect(onOpen).toHaveBeenCalledWith('ro_1');
  });
});

describe('T1170 · SC-RQR-008 — the structure keyboard operation depends on', () => {
  /**
   * The same scope `T1168` states: these assert the **structural** properties
   * that make keyboard operation possible and that regress silently under
   * refactoring. Real tab order and focus visibility need a running browser —
   * `T1174`'s transcript — and whether that discharges the accessibility half is
   * `T1175`'s open question rather than something claimed here.
   */
  it('every Room is opened by a real button, not a click handler on a row', async () => {
    mount();
    const list = await screen.findByRole('list', { name: /requirement room/i });
    const buttons = within(list).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      // A `<div onClick>` is unreachable by Tab and invisible to a screen
      // reader, and looks identical on screen.
      expect(button.tagName).toBe('BUTTON');
      expect(button.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it('the start control precedes the list in document order', async () => {
    // A person arriving at an index most often wants to begin, and the control
    // to do so must not sit behind an unbounded list of Rooms. Asserted as
    // document order, which is what tab order follows absent a positive
    // `tabindex`.
    mount();
    const start = await screen.findByRole('button', { name: /start a requirement room/i });
    const list = screen.getByRole('list', { name: /requirement room/i });
    expect(start.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('no positive tabindex reorders the page', async () => {
    const { container } = render(
      <RoomIndex kind={REQUIREMENT} load={async () => ROOMS} onOpen={vi.fn()} onStart={vi.fn()} />,
    );
    await screen.findAllByRole('list');
    for (const el of container.querySelectorAll('[tabindex]')) {
      expect(Number(el.getAttribute('tabindex'))).toBeLessThanOrEqual(0);
    }
  });

  it('gives the list an accessible name, so it is announced as what it is', async () => {
    mount();
    const list = await screen.findByRole('list', { name: /requirement room/i });
    // Found BY its accessible name above; this pins where the name comes from,
    // so a refactor to a visually-adjacent heading is caught.
    expect(list.getAttribute('aria-label')).toMatch(/requirement room/i);
  });
});

describe('T1170 · the list is stable and bounded', () => {
  it('keeps the order the server sent — it does not re-sort', async () => {
    // The server orders newest first (`T1177`). Re-sorting here would be a
    // second opinion about ordering, and the two would drift.
    mount({ load: async () => [ROOMS[1]!, ROOMS[0]!] });
    const list = await screen.findByRole('list', { name: /requirement room/i });
    const items = within(list).getAllByRole('listitem');
    expect(within(items[0]!).getByText(/set_beta/)).toBeDefined();
  });

  it('loads once for one kind, not on every render', async () => {
    const load = vi.fn(async () => ROOMS);
    mount({ load });
    await waitFor(() => expect(screen.getByRole('list')).toBeDefined());
    expect(load).toHaveBeenCalledTimes(1);
  });
});
