/**
 * `T403u` — the Room **states** that external review is unavailable.
 * `FR-RQR-004`, `UX-0002`.
 *
 * The distinction this file exists for is between three ways of not having a
 * feature, only one of which is honest here:
 *
 * 1. **A control that fails on click.** The worst — it promises, then refuses.
 * 2. **A disabled control.** Implies the feature exists and *this user* lacks
 *    it. Untrue: `BR-0004` is `U-02` and unowned, so there is nothing to enable.
 * 3. **A statement.** What `UX-0002` asks for, and what is asserted below.
 *
 * A test that only checked "no external review button exists" would pass on a
 * Room that said nothing at all — which is silence, not a statement. So the
 * presence of the sentence is asserted alongside the absence of the control.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RequirementRoomPage } from '../../../src/pages/RequirementRoom';
import type { RequirementRoomApi } from '../../../src/pages/RequirementRoom';

afterEach(cleanup);

const api: RequirementRoomApi = {
  loopProgress: vi.fn().mockResolvedValue([]),
  roomReadiness: vi.fn().mockResolvedValue({ ready: true, blockers: [] }),
  // `T1188` — the journey's four. Resolved empty here: these suites are about
  // the Room's shell, access posture and accessibility, not its content.
  roomCandidates: vi.fn().mockResolvedValue([]),
  setCandidateCriteria: vi.fn().mockResolvedValue({}),
  roomClarifications: vi.fn().mockResolvedValue([]),
  answerClarification: vi.fn().mockResolvedValue({}),
  // `T1193` — the decision and baseline half.
  roomDecisions: vi.fn().mockResolvedValue([]),
  roomBaselines: vi.fn().mockResolvedValue([]),
  roomMembers: vi.fn().mockResolvedValue([]),
  decideRoom: vi.fn().mockResolvedValue({}),
  approveBaseline: vi.fn().mockResolvedValue({}),
  promoteCandidate: vi.fn().mockResolvedValue({
    requirementId: 'r_1',
    requirementVersionId: 'rv_1',
    contentHash: 'h',
  }),
};

const open = () => render(<RequirementRoomPage api={api} roomObjectId="ro_1" projectId="pr_1" />);

describe('T403u · FR-RQR-004 — external review is stated as unavailable', () => {
  it('says so, in words a person reads', async () => {
    open();
    const stated = await screen.findByTestId('external-review-unavailable');
    expect(stated.textContent).toMatch(/external stakeholder review is not available/i);
  });

  it('says what the Room DOES serve, so the statement is actionable', async () => {
    // "Not available" alone leaves a reader wondering whether they are holding
    // it wrong. Naming the audience answers the next question.
    open();
    const stated = await screen.findByTestId('external-review-unavailable');
    expect(stated.textContent).toMatch(/workspace-internal/i);
  });

  it('offers no control to attempt it — not even a disabled one', async () => {
    open();
    await screen.findByTestId('room-shell');
    expect(screen.queryByRole('button', { name: /external/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /external/i })).toBeNull();
  });

  it('has no disabled control anywhere implying a withheld feature', async () => {
    // Option 2 above. A greyed-out button would say "you cannot", when the
    // truth is "nobody can, and it is not built".
    const { container } = open();
    await screen.findByTestId('room-shell');
    expect(container.querySelectorAll('[disabled], [aria-disabled="true"]')).toHaveLength(0);
  });

  it('the absence check can fail — a control WOULD be detected', () => {
    // Anti-tautology. Without this, the two absence assertions above would pass
    // over a page that rendered nothing at all.
    render(<button type="button">Request external review</button>);
    expect(screen.queryByRole('button', { name: /external/i })).not.toBeNull();
  });
});
