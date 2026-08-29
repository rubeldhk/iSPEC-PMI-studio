/**
 * `T403m` — the Requirement Room page. `UX-0030`, `UX-0035`, `FR-RQR-070`.
 *
 * The page's whole job is composition: it fetches, and it hands six regions to
 * `RoomShell`. So what is asserted here is that it **goes through the shell**
 * rather than laying out six divs that happen to look similar — a Room that
 * rendered its own layout would satisfy a screenshot and break `UX-0042` the
 * first time someone changed one of them.
 *
 * `Requirements.tsx` is untouched. `T403n` says *a new page beside it*, because
 * the register list and the governed Room are different surfaces onto the same
 * data, and replacing the first with the second would remove a working screen.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ROOM_REGIONS } from '@pmi/room-contract';
import { RequirementRoomPage } from '../../../src/pages/RequirementRoom';
import type { RequirementRoomApi } from '../../../src/pages/RequirementRoom';

afterEach(cleanup);

const PROGRESS = [
  { stage: 'Event' as const, status: 'done' as const, omitted: false },
  { stage: 'Context' as const, status: 'current' as const, omitted: false },
  { stage: 'Analyze' as const, status: 'pending' as const, omitted: false },
];

const READINESS = {
  ready: false,
  blockers: [
    { kind: 'open-clarification' as const, subject: 'Q-14', detail: 'Which currencies?' },
  ],
};

function api(over: Partial<RequirementRoomApi> = {}): RequirementRoomApi {
  return {
    loopProgress: vi.fn().mockResolvedValue(PROGRESS),
    roomReadiness: vi.fn().mockResolvedValue(READINESS),
  // `T1188` — the journey's four. Resolved empty here: these suites are about
  // the Room's shell, access posture and accessibility, not its content.
  roomCandidates: vi.fn().mockResolvedValue([]),
  setCandidateCriteria: vi.fn().mockResolvedValue({}),
  roomClarifications: vi.fn().mockResolvedValue([]),
  answerClarification: vi.fn().mockResolvedValue({}),
    ...over,
  };
}

const render_ = (over: Partial<RequirementRoomApi> = {}) =>
  render(<RequirementRoomPage api={api(over)} roomObjectId="ro_1" projectId="pr_1" />);

describe('T403m · the Room composes through the shared shell', () => {
  it('renders the shell, not a hand-rolled layout', async () => {
    render_();
    expect(await screen.findByTestId('room-shell')).toBeDefined();
  });

  it('renders all six regions the contract names', async () => {
    render_();
    await screen.findByTestId('room-shell');
    for (const region of ROOM_REGIONS) {
      expect(screen.getByTestId(`room-region-${region}`)).toBeDefined();
    }
  });

  it('puts loop progress in the loopProgress region, not wherever it fits', async () => {
    // Composition through named props is what stops the regions drifting apart
    // across three Rooms — worth asserting, not assuming.
    render_();
    const region = await screen.findByTestId('room-region-loopProgress');
    await waitFor(() => expect(region.querySelector('[data-stage="Context"]')).not.toBeNull());
  });

  it('puts the blockers in the evidence region', async () => {
    render_();
    const region = await screen.findByTestId('room-region-evidence');
    await waitFor(() => expect(region.textContent).toContain('Q-14'));
  });
});

describe('T403m · loading, empty and error are distinguishable', () => {
  it('shows a loading state before anything arrives', () => {
    // Never resolves: the state under test is the one before the first answer.
    render_({ loopProgress: vi.fn().mockReturnValue(new Promise(() => {})) });
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0);
  });

  it('reports a failed progress read as an error, not as an empty loop', async () => {
    render_({ loopProgress: vi.fn().mockRejectedValue(new Error('gateway said no')) });
    const region = await screen.findByTestId('room-region-loopProgress');
    await waitFor(() => expect(region.textContent).toMatch(/could not|unavailable|error/i));
  });

  it('reports a failed readiness read without claiming the object is ready', async () => {
    // The conflation that matters: "we could not tell" must never render as
    // "nothing is blocking".
    render_({ roomReadiness: vi.fn().mockRejectedValue(new Error('nope')) });
    const region = await screen.findByTestId('room-region-evidence');
    await waitFor(() => expect(region.textContent).toMatch(/could not|unavailable/i));
    expect(region.textContent).not.toMatch(/nothing is blocking/i);
  });

  it('one region failing does not take the others down', async () => {
    render_({ roomReadiness: vi.fn().mockRejectedValue(new Error('nope')) });
    const progress = await screen.findByTestId('room-region-loopProgress');
    await waitFor(() => expect(progress.querySelector('[data-stage="Event"]')).not.toBeNull());
  });
});

describe('T403m · the page announces itself', () => {
  it('has one first-level heading naming the Room', async () => {
    render_();
    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toMatch(/requirement room/i);
  });

  it('names the object it is showing, in the header', async () => {
    // Scoped to the header: the object id legitimately appears there AND in the
    // object-state region, so an unscoped query matches twice.
    const { container } = render_();
    await screen.findByTestId('room-shell');
    const header = container.querySelector('.requirement-room__header');
    expect(header?.textContent).toContain('ro_1');
  });
});
