/**
 * `T994u`, `T994v` (EPIC-034) — what is blocking, and who refused.
 *
 * `FR-CHR-083`, `UX-0032`: what is blocking progress is visible **without
 * opening another screen**. `FR-CHR-084`, `UX-0033`: a policy-refused action
 * shows the **refusing policy**.
 *
 * ## Why "without opening another screen" is the load-bearing half
 *
 * A Room that says *"this change cannot proceed"* and leaves the reason one
 * click away has technically told the truth. What it has actually done is make
 * the person guess, and guessing is how a change sits for a week because
 * everyone assumed the blocker was the one they already knew about.
 *
 * ## And why a refusal must name the policy
 *
 * "Not authorised" leaves a person unable to tell whether they lack a role,
 * lack a delegation, or are the wrong person entirely. `EPIC-031`'s decision id
 * is the thing they can take to whoever can fix it — which is the only action a
 * refusal leaves them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  ChangeRoomPage,
  type ChangeRoomApi,
  type PolicyRefusalView,
} from '../../../src/pages/ChangeRoom';

afterEach(cleanup);

const REQUEST = {
  id: 'cr_1',
  projectId: 'pr_1',
  targetBaselineId: 'b_1',
  targetBaselineVersion: 2,
  requestedOutcome: 'notify within one hour',
  reason: 'the regulator shortened the window',
  requester: 'u_1',
  urgency: 'normal',
  state: 'open',
  openQuestions: [] as { id: string; question: string; answer: string | null }[],
  rebasedFrom: null,
};

function api(over: Partial<ChangeRoomApi> = {}): ChangeRoomApi {
  return {
    loopProgress: vi.fn().mockResolvedValue([]),
    changeRequest: vi.fn().mockResolvedValue(REQUEST),
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
    ...over,
  };
}

const REFUSAL: PolicyRefusalView = {
  remedy: 'decision-authority',
  decisionId: 'dec_031_44',
  reason: 'no delegation covers the high band for this actor',
};

const renderRoom = (over: Partial<ChangeRoomApi> = {}, refusal?: PolicyRefusalView) =>
  render(
    <ChangeRoomPage
      api={api(over)}
      changeRequestId="cr_1"
      projectId="pr_1"
      {...(refusal === undefined ? {} : { refusal })}
    />,
  );

describe('T994u · what is blocking is on the screen', () => {
  it('an undecided change says so', async () => {
    renderRoom();
    await waitFor(() => expect(screen.getByTestId('change-blockers')).toBeTruthy());
    expect(screen.getByText(/no decision has been recorded/i)).toBeTruthy();
  });

  it('unanswered questions are counted, not merely implied', async () => {
    renderRoom({
      changeRequest: vi.fn().mockResolvedValue({
        ...REQUEST,
        openQuestions: [
          { id: 'q1', question: 'which currencies?', answer: null },
          { id: 'q2', question: 'who signs off?', answer: 'Priya' },
          { id: 'q3', question: 'mobile too?', answer: null },
        ],
      }),
    });
    await waitFor(() => expect(screen.getByText(/2 unanswered question/i)).toBeTruthy());
  });

  it('and it is in the decision region, not behind a link', async () => {
    // `UX-0032`. The point is the absence of a second screen.
    renderRoom();
    const decision = await screen.findByTestId('room-region-decision');
    await waitFor(() => expect(decision.textContent).toMatch(/no decision has been recorded/i));
  });

  it('a decided change with everything answered shows no blockers', async () => {
    // The control. Without it, a panel that always claimed something was
    // blocking would satisfy every assertion above.
    renderRoom({
      changeDecision: vi.fn().mockResolvedValue({
        decidedBy: 'u_2',
        authorityBasis: 'DA-0007',
        rationale: 'B keeps the migration reversible.',
        chosenOption: { optionId: 'b', summary: 'Shorten the window' },
        declinedOptions: [{ optionId: 'a', summary: 'Rewrite the pipeline' }],
      }),
    });
    await waitFor(() => expect(screen.getByText(/B keeps the migration reversible/)).toBeTruthy());
    expect(screen.queryByTestId('change-blockers')).toBeNull();
  });
});

describe('T994u · a policy refusal names the policy', () => {
  it('shows the EPIC-031 decision id', async () => {
    // `UX-0033`. The thing a person can take to whoever can fix it.
    renderRoom({}, REFUSAL);
    await waitFor(() => expect(screen.getByTestId('policy-refusal')).toBeTruthy());
    expect(screen.getByText(/dec_031_44/)).toBeTruthy();
  });

  it('and the reason it gave', async () => {
    renderRoom({}, REFUSAL);
    await waitFor(() =>
      expect(screen.getByText(/no delegation covers the high band/)).toBeTruthy(),
    );
  });

  it('marked as a recorded fact, not a recommendation', async () => {
    // A policy said this. Rendering it in the same treatment as an AI
    // suggestion would invite someone to weigh it, and it is not a suggestion.
    renderRoom({}, REFUSAL);
    await waitFor(() => expect(screen.getByTestId('policy-refusal')).toBeTruthy());
    const mark = screen.getByTestId('epistemic-mark');
    expect(mark.getAttribute('data-epistemic')).toBe('fact');
    expect(mark.getAttribute('data-ai-output')).toBeNull();
  });

  it('and nothing is shown when nothing was refused', async () => {
    // The control for the refusal half.
    renderRoom({
      changeDecision: vi.fn().mockResolvedValue({
        decidedBy: 'u_2',
        authorityBasis: 'DA-0007',
        rationale: 'agreed',
        chosenOption: { optionId: 'b', summary: 'Shorten the window' },
        declinedOptions: [],
      }),
    });
    await waitFor(() => expect(screen.getByText(/agreed/)).toBeTruthy());
    expect(screen.queryByTestId('policy-refusal')).toBeNull();
  });
});

describe('T994u · urgency is displayed and never acted on', () => {
  it('shows what was claimed', async () => {
    renderRoom({
      changeRequest: vi.fn().mockResolvedValue({ ...REQUEST, urgency: 'critical' }),
    });
    await waitFor(() => expect(screen.getByText(/Urgency claimed: critical/)).toBeTruthy());
  });

  it('and a critical change shows exactly the same blockers as a normal one', async () => {
    // `FR-CHR-021` on screen. A blocker list that shortened under urgency would
    // be the gate bypass arriving through the UI.
    renderRoom({ changeRequest: vi.fn().mockResolvedValue({ ...REQUEST, urgency: 'critical' }) });
    await waitFor(() => expect(screen.getByTestId('change-blockers')).toBeTruthy());
    const critical = screen.getAllByTestId('change-blocker').map((n) => n.textContent);

    cleanup();
    renderRoom({ changeRequest: vi.fn().mockResolvedValue({ ...REQUEST, urgency: 'normal' }) });
    await waitFor(() => expect(screen.getByTestId('change-blockers')).toBeTruthy());
    const normal = screen.getAllByTestId('change-blocker').map((n) => n.textContent);

    expect(critical).toEqual(normal);
  });
});
