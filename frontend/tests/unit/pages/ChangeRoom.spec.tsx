/**
 * `T994r`, `T994s` (EPIC-034) — the Change Room page. `FR-CHR-080`, `UX-0030`,
 * `UX-0051`.
 *
 * **The page's whole job is composition.** It fetches, and it hands six regions
 * to the *imported* `RoomShell`. So what is asserted here is that it **goes
 * through the shell** rather than laying out six divs that happen to look
 * similar — a Room that rendered its own layout would satisfy a screenshot and
 * break `UX-0042` the first time somebody changed one of them.
 *
 * `EPIC-033` wrote the same test for the Requirement Room and this one is
 * deliberately its sibling. That is the point of `UX-0035`: the second Room
 * inherits the pattern, and a test that proved it a different way would be
 * evidence the pattern had already forked.
 *
 * ## Each region fails on its own
 *
 * One failed fetch darkens one region; the other five still render. A
 * page-level error boundary would be simpler and would take five working
 * regions down with the sixth — the opposite of what a person needs when they
 * are trying to find out what is blocking.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ROOM_REGIONS } from '@pmi/room-contract';
import { ChangeRoomPage, type ChangeRoomApi } from '../../../src/pages/ChangeRoom';

afterEach(cleanup);

const REQUEST = {
  id: 'cr_1',
  projectId: 'pr_1',
  targetBaselineId: 'b_1',
  targetBaselineVersion: 2,
  requestedOutcome: 'notify within one hour',
  reason: 'the regulator shortened the window',
  requester: 'u_1',
  urgency: 'high',
  state: 'open',
  openQuestions: [],
  rebasedFrom: null,
};

const PROGRESS = [
  { stage: 'Event' as const, status: 'done' as const, omitted: false },
  { stage: 'Decide' as const, status: 'current' as const, omitted: false },
];

function api(over: Partial<ChangeRoomApi> = {}): ChangeRoomApi {
  return {
    loopProgress: vi.fn().mockResolvedValue(PROGRESS),
    changeRequest: vi.fn().mockResolvedValue(REQUEST),
    changeImpact: vi.fn().mockResolvedValue(null),
    changeOptions: vi.fn().mockResolvedValue({
      available: false,
      options: null,
      degradedReason: 'no options provider is bound (EPIC-028 AgentGateway)',
      degradedKind: 'gateway-unbound',
      rejected: [],
    }),
    changeDecision: vi.fn().mockResolvedValue(null),
    changeClosure: vi.fn().mockResolvedValue(null),
    ...over,
  };
}

const renderRoom = (over: Partial<ChangeRoomApi> = {}) =>
  render(<ChangeRoomPage api={api(over)} changeRequestId="cr_1" projectId="pr_1" />);

describe('T994r · it composes through the imported shell', () => {
  it('renders the shell rather than a layout of its own', async () => {
    renderRoom();
    expect(await screen.findByTestId('room-shell')).toBeTruthy();
  });

  it('fills all six regions', async () => {
    // `UX-0030`. `RoomShellProps` is a `Record` over the vocabulary, so five
    // would not compile — this asserts the rendered result, which is what a
    // person sees.
    renderRoom();
    await screen.findByTestId('room-shell');
    for (const region of ROOM_REGIONS) {
      expect(screen.getByTestId(`room-region-${region}`), `${region} is missing`).toBeTruthy();
    }
  });

  it('and the three UX-0042 regions carry the shell’s narrow-viewport marking', async () => {
    // Read from the shell rather than set here: a Room deciding for itself
    // which of its regions is expendable is what `RETAINED_AT_360` exists to
    // prevent.
    renderRoom();
    await screen.findByTestId('room-shell');
    for (const region of ['objectState', 'decision', 'evidence']) {
      expect(
        screen.getByTestId(`room-region-${region}`).getAttribute('data-narrow-viewport'),
      ).toBe('retained');
    }
  });
});

describe('T994r · the four states UX-0051 asks for', () => {
  it('loading — the regions exist before the data arrives', async () => {
    // A page that renders nothing until every fetch settles is a blank screen
    // for as long as the slowest one takes.
    const slow = new Promise(() => undefined) as Promise<never>;
    render(
      <ChangeRoomPage
        api={api({ changeRequest: vi.fn().mockReturnValue(slow) })}
        changeRequestId="cr_1"
        projectId="pr_1"
      />,
    );
    expect(screen.getByTestId('room-shell')).toBeTruthy();
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0);
  });

  it('populated — the change request is shown in object state', async () => {
    renderRoom();
    expect(await screen.findByText(/notify within one hour/)).toBeTruthy();
    expect(screen.getByText(/b_1/)).toBeTruthy();
  });

  it('empty — a change with no impact view says so, rather than showing nothing', async () => {
    // An empty region and a region reporting "nothing computed" look the same
    // to a reader unless one of them says which it is.
    renderRoom();
    await screen.findByTestId('room-shell');
    await waitFor(() =>
      expect(screen.getByText(/no impact view has been computed/i)).toBeTruthy(),
    );
  });

  it('error — one failed fetch darkens one region and no others', async () => {
    renderRoom({ loopProgress: vi.fn().mockRejectedValue(new Error('loop unreachable')) });

    await waitFor(() => expect(screen.getByText(/loop unreachable/)).toBeTruthy());
    // The other five still have their content.
    expect(await screen.findByText(/notify within one hour/)).toBeTruthy();
  });

  it('and an error in one region does not blank the shell', async () => {
    renderRoom({ changeRequest: vi.fn().mockRejectedValue(new Error('request unreachable')) });
    // Two regions read the change request — object state and the timeline — so
    // both report the failure. That is each failing on its own, not a leak: a
    // timeline rendered blank beside a darkened object-state panel would look
    // like a change with no history.
    await waitFor(() => expect(screen.getAllByText(/request unreachable/).length).toBe(2));
    expect(screen.getByTestId('room-shell')).toBeTruthy();
    for (const region of ROOM_REGIONS) {
      expect(screen.getByTestId(`room-region-${region}`)).toBeTruthy();
    }
  });
});

describe('T994r · what it shows in each region', () => {
  it('AI analysis carries the options, marked as recommendations', async () => {
    renderRoom({
      changeOptions: vi.fn().mockResolvedValue({
        available: true,
        options: [
          {
            optionId: 'a',
            summary: 'Shorten the window',
            reasoning: 'Least disruptive.',
            tradeOffs: Object.fromEntries(
              ['schedule', 'cost', 'quality', 'security', 'compatibility', 'delivery'].map((d) => [
                d,
                { stated: true, detail: `${d} noted` },
              ]),
            ),
            epistemic: 'recommendation',
          },
          {
            optionId: 'b',
            summary: 'Rewrite the pipeline',
            reasoning: 'More thorough.',
            tradeOffs: Object.fromEntries(
              ['schedule', 'cost', 'quality', 'security', 'compatibility', 'delivery'].map((d) => [
                d,
                { stated: true, detail: `${d} noted` },
              ]),
            ),
            epistemic: 'recommendation',
          },
        ],
        degradedReason: null,
        degradedKind: null,
        rejected: [],
      }),
    });

    const analysis = await screen.findByTestId('room-region-aiAnalysis');
    // Not on mount. Generating options invokes an analysis provider, and a page
    // that did so every time somebody looked at a change would spend a
    // provider's time on nobody's behalf — and produce a fresh set beside the
    // one a decision was actually taken against.
    expect(analysis.textContent).not.toContain('Shorten the window');

    screen.getByTestId('generate-options').click();
    await waitFor(() => expect(analysis.textContent).toContain('Shorten the window'));
    // Through the shared `EpistemicMark`, so the treatment matches the other Room.
    expect(screen.getAllByTestId('epistemic-mark').length).toBeGreaterThanOrEqual(2);
  });

  it('and asks for none until somebody does', async () => {
    // The restraint, asserted directly rather than inferred from what rendered.
    const changeOptions = vi.fn().mockResolvedValue({
      available: false,
      options: null,
      degradedReason: 'unbound',
      degradedKind: 'gateway-unbound',
      rejected: [],
    });
    renderRoom({ changeOptions });
    await screen.findByTestId('room-shell');
    expect(changeOptions).not.toHaveBeenCalled();

    screen.getByTestId('generate-options').click();
    await waitFor(() => expect(changeOptions).toHaveBeenCalledTimes(1));
  });

  it('says none have been generated, rather than showing an empty list', async () => {
    renderRoom();
    const analysis = await screen.findByTestId('room-region-aiAnalysis');
    expect(analysis.textContent).toMatch(/no options have been generated/i);
  });

  it('evidence says what has not been proved yet, rather than nothing', async () => {
    renderRoom();
    const evidence = await screen.findByTestId('room-region-evidence');
    await waitFor(() => expect(evidence.textContent).toMatch(/not (yet )?closed|no closure/i));
  });

  it('activity timeline shows the change’s own history', async () => {
    renderRoom();
    const timeline = await screen.findByTestId('room-region-activityTimeline');
    await waitFor(() => expect(timeline.textContent).toContain('open'));
  });
});
