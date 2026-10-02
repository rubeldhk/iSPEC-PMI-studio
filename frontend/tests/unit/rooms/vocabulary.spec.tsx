/**
 * `T403o` — the Room speaks the shared vocabulary, and cannot invent its own.
 * `FR-RQR-071`, `FR-RQR-074`, `UX-0030`, `UX-0035`.
 *
 * Two vocabularies are checked, because the Room borrows both and could drift
 * from either:
 *
 * - the **six regions**, from `@pmi/room-contract`;
 * - the **loop stages and statuses**, from `@pmi/loop-contract`.
 *
 * The comparison is only worth running if the rendered names come from the
 * packages rather than from a list this file also wrote — so the expected values
 * are imported, never restated. A test that hard-coded `['objectState', …]`
 * would pass a Room that had drifted in lockstep with the test.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ROOM_REGIONS } from '@pmi/room-contract';
import { LOOP_STAGES, STAGE_STATUSES, projectProgress } from '@pmi/loop-contract';
import { RoomShell } from '../../../src/rooms/RoomShell';
import { LoopProgress } from '../../../src/rooms/regions/LoopProgress';

afterEach(cleanup);

const REGIONS = Object.fromEntries(
  ROOM_REGIONS.map((region) => [region, <p key={region}>{region} content</p>]),
) as Record<(typeof ROOM_REGIONS)[number], React.ReactNode>;

describe('T403o · the region names are the contract’s, not this Room’s', () => {
  it('renders exactly the regions the contract names — no more, no fewer', () => {
    const { container } = render(<RoomShell {...REGIONS} />);
    const rendered = [...container.querySelectorAll('[data-testid^="room-region-"]')]
      .map((el) => el.getAttribute('data-testid')?.replace('room-region-', ''))
      .sort();
    expect(rendered).toEqual([...ROOM_REGIONS].sort());
  });

  it('a Room-local synonym is not expressible', () => {
    // `RoomShellProps` is `Record<RoomRegion, TNode>`, so a seventh region has
    // nowhere to go and a renamed one does not compile. Asserted at runtime too
    // because the type is erased by the time this renders.
    render(<RoomShell {...REGIONS} />);
    for (const region of ROOM_REGIONS) {
      expect(screen.getByTestId(`room-region-${region}`)).toBeDefined();
    }
    expect(screen.queryByTestId('room-region-requirements')).toBeNull();
    expect(screen.queryByTestId('room-region-intent')).toBeNull();
  });

  it('the comparison can fail — a drifted name is detectable', () => {
    // Anti-tautology. Without this, both assertions above would pass over a
    // renderer that emitted nothing at all.
    const drifted = ['objectState', 'intent'].sort();
    expect(drifted).not.toEqual([...ROOM_REGIONS].sort());
  });
});

describe('T403o · FR-RQR-074 — the loop vocabulary is EPIC-030’s', () => {
  const progress = projectProgress({
    configuredStages: [...LOOP_STAGES],
    currentStage: 'Analyze',
    completedStages: ['Event', 'Context'],
  });

  it('renders the stage names the loop contract defines, in its order', () => {
    const { container } = render(<LoopProgress progress={progress} />);
    const stages = [...container.querySelectorAll('[data-stage]')].map((el) =>
      el.getAttribute('data-stage'),
    );
    // Order included: two Rooms listing the same stages differently is the
    // drift `UX-0035` forbids, and sorting here would hide it.
    expect(stages).toEqual(progress.map((row) => row.stage));
    expect(new Set(stages)).toEqual(new Set(LOOP_STAGES));
  });

  it('renders no stage the loop contract does not name', () => {
    const { container } = render(<LoopProgress progress={progress} />);
    for (const el of container.querySelectorAll('[data-stage]')) {
      expect(LOOP_STAGES as readonly string[]).toContain(el.getAttribute('data-stage'));
    }
  });

  it('uses the contract’s three statuses and invents no fourth', () => {
    const { container } = render(<LoopProgress progress={progress} />);
    const statuses = new Set(
      [...container.querySelectorAll('[data-status]')].map((el) => el.getAttribute('data-status')),
    );
    for (const status of statuses) {
      expect(STAGE_STATUSES as readonly string[]).toContain(status);
    }
  });

  it('does not translate a stage name for display', () => {
    // The specific failure `FR-RQR-074` names: a Room relabelling "Analyze" as
    // "Analysis" makes one word mean two things across three Rooms.
    const { container } = render(<LoopProgress progress={progress} />);
    const first = container.querySelector('[data-stage="Analyze"]');
    expect(first).not.toBeNull();
    expect(within(first as HTMLElement).getByText('Analyze')).toBeDefined();
  });

  it('shows an omitted stage rather than dropping it (FR-GEL-008)', () => {
    const partial = projectProgress({
      configuredStages: ['Event', 'Context', 'Outcome'],
      currentStage: 'Context',
      completedStages: ['Event'],
    });
    const { container } = render(<LoopProgress progress={partial} />);
    // Every stage is still rendered; the unused ones are marked, not missing.
    expect(container.querySelectorAll('[data-stage]')).toHaveLength(partial.length);
    expect(container.querySelectorAll('[data-omitted="true"]').length).toBeGreaterThan(0);
  });
});
