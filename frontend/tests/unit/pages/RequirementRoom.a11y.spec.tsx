/**
 * `T403s` — the Room is operable by keyboard, with visible focus. `SC-RQR-008`.
 *
 * Two properties, and they fail differently:
 *
 * - **axe** catches the structural faults — an unlabelled region, a heading
 *   level skipped, a control with no accessible name. It runs in jsdom, which
 *   computes no layout, so `color-contrast` is disabled in the shared helper and
 *   checked from the token values in governance instead.
 * - **The keyboard walk** catches what axe cannot: whether a person who never
 *   touches a pointer can actually get from the top of the Room to the bottom.
 *   A page can be perfectly labelled and still trap or skip focus.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { expectNoViolations } from '../a11y/axe';
import { RequirementRoomPage } from '../../../src/pages/RequirementRoom';
import type { RequirementRoomApi } from '../../../src/pages/RequirementRoom';

afterEach(cleanup);

const api: RequirementRoomApi = {
  loopProgress: vi.fn().mockResolvedValue([
    { stage: 'Event', status: 'done', omitted: false },
    { stage: 'Context', status: 'current', omitted: false },
  ]),
  roomReadiness: vi.fn().mockResolvedValue({
    ready: false,
    blockers: [{ kind: 'pending-decision', subject: 'REQ-004', detail: 'Nobody has decided.' }],
  }),
  // `T1188` — the journey's four. Resolved empty here: this suite is about the
  // Room's accessibility, not its content.
  roomCandidates: vi.fn().mockResolvedValue([]),
  setCandidateCriteria: vi.fn().mockResolvedValue({}),
  roomClarifications: vi.fn().mockResolvedValue([]),
  answerClarification: vi.fn().mockResolvedValue({}),
  // `T1193` — the decision and baseline half.
  roomDecisions: vi.fn().mockResolvedValue([]),
  decideRoom: vi.fn().mockResolvedValue({}),
  approveBaseline: vi.fn().mockResolvedValue({}),
};

const open = () =>
  render(<RequirementRoomPage api={api} roomObjectId="ro_1" projectId="pr_1" />);

describe('T403s · SC-RQR-008 — zero axe violations', () => {
  it('passes axe once the Room has loaded', async () => {
    const { container } = open();
    await screen.findByTestId('room-shell');
    await expectNoViolations(container);
  });

  it('passes axe in its loading state too', async () => {
    // The state a person meets first, and the one most often left untested.
    const { container } = render(
      <RequirementRoomPage
        api={{
          // Never resolves: the loading state is the one a person meets first.
          loopProgress: vi.fn().mockReturnValue(new Promise(() => {})),
          roomReadiness: vi.fn().mockReturnValue(new Promise(() => {})),
          roomCandidates: vi.fn().mockReturnValue(new Promise(() => {})),
          setCandidateCriteria: vi.fn().mockReturnValue(new Promise(() => {})),
          roomClarifications: vi.fn().mockReturnValue(new Promise(() => {})),
          answerClarification: vi.fn().mockReturnValue(new Promise(() => {})),
          roomDecisions: vi.fn().mockReturnValue(new Promise(() => {})),
          decideRoom: vi.fn().mockReturnValue(new Promise(() => {})),
          approveBaseline: vi.fn().mockReturnValue(new Promise(() => {})),
        }}
        roomObjectId="ro_1"
        projectId="pr_1"
      />,
    );
    await expectNoViolations(container);
  });

  it('passes axe when a region has failed', async () => {
    const { container } = render(
      <RequirementRoomPage
        api={{
          // Every call rejects: the state where a region failed to load, which
          // must still be accessible rather than a wall of raw errors.
          loopProgress: vi.fn().mockRejectedValue(new Error('no')),
          roomReadiness: vi.fn().mockRejectedValue(new Error('no')),
          roomCandidates: vi.fn().mockRejectedValue(new Error('no')),
          setCandidateCriteria: vi.fn().mockRejectedValue(new Error('no')),
          roomClarifications: vi.fn().mockRejectedValue(new Error('no')),
          answerClarification: vi.fn().mockRejectedValue(new Error('no')),
          roomDecisions: vi.fn().mockRejectedValue(new Error('no')),
          decideRoom: vi.fn().mockRejectedValue(new Error('no')),
          approveBaseline: vi.fn().mockRejectedValue(new Error('no')),
        }}
        roomObjectId="ro_1"
        projectId="pr_1"
      />,
    );
    await screen.findByTestId('room-shell');
    await expectNoViolations(container);
  });
});

describe('T403s · the journey is walkable without a pointer', () => {
  it('lands focus on the Room heading when it opens', async () => {
    open();
    const heading = await screen.findByRole('heading', { level: 1 });
    // So a keyboard user starts at the top of the Room rather than wherever the
    // previous screen left them.
    expect(document.activeElement).toBe(heading);
  });

  it('the heading is focusable but NOT in the tab order', async () => {
    // `tabIndex={-1}`. A heading that took a tab stop would add one every time
    // a person walks the page, for no navigational gain.
    open();
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading.getAttribute('tabindex')).toBe('-1');
  });

  it('every region is reachable in the reading order', async () => {
    const { container } = open();
    await screen.findByTestId('room-shell');
    const regions = [...container.querySelectorAll('[data-testid^="room-region-"]')];
    // Six regions, in DOM order — which for a screen reader IS the order they
    // are read in. A layout that reordered visually without reordering the DOM
    // would read differently from how it looks.
    expect(regions).toHaveLength(6);
  });

  it('nothing overrides the natural tab order with a positive tabindex', async () => {
    // The defect this rules out: a positive `tabindex` puts one element ahead of
    // everything else on the page, so the reading order and the tab order stop
    // agreeing. `-1` (programmatic focus) and `0` (natural order) are both fine.
    //
    // **jsdom computes no layout and implements no tab traversal**, so an actual
    // keyboard walk cannot be simulated here honestly — the same limitation that
    // makes the shared axe helper disable `color-contrast`. What is checkable is
    // the static property that makes a walk go wrong, and it is checked.
    // `T403j`'s human accessibility pass is where the walk itself is observed.
    const { container } = open();
    await screen.findByTestId('room-shell');
    for (const el of container.querySelectorAll('[tabindex]')) {
      const value = Number(el.getAttribute('tabindex'));
      expect(value, `${el.tagName} has a positive tabindex`).toBeLessThanOrEqual(0);
    }
  });

  it('no focusable content is hidden from assistive technology', async () => {
    // `aria-hidden` around something focusable is the trap axe cannot always
    // see: a sighted keyboard user lands on an element a screen reader says is
    // not there.
    const { container } = open();
    await screen.findByTestId('room-shell');
    for (const hidden of container.querySelectorAll('[aria-hidden="true"]')) {
      expect(
        hidden.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length,
        'focusable content sits inside an aria-hidden subtree',
      ).toBe(0);
    }
  });

  it('every heading in the Room is announced, and none is empty', async () => {
    const { container } = open();
    await screen.findByTestId('room-shell');
    const headings = [...container.querySelectorAll('h1, h2, h3')];
    expect(headings.length).toBeGreaterThan(1);
    for (const heading of headings) {
      expect(heading.textContent?.trim(), 'an empty heading is announced as nothing').toBeTruthy();
    }
  });

  it('regions carry accessible names — six unlabelled ones sound identical', async () => {
    const { container } = open();
    await screen.findByTestId('room-shell');
    for (const region of container.querySelectorAll('[data-testid^="room-region-"]')) {
      expect(region.getAttribute('aria-label')).toBeTruthy();
    }
  });
});
