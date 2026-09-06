/**
 * `T1584` (EPIC-044, `FR-EPB-040`, `FR-EPB-042`–`FR-EPB-049`) — the Spec Journey
 * Board: the columns in order, one card per Epic with last, next, readiness and
 * its state markers, the unbound group, filters, the four states, the footer
 * naming the derivation package, and a moved card re-rendered on reload with
 * no manual refresh control (`FR-EPB-048`, analysis `U1`). Written to FAIL
 * before `T1585`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { JourneyBoardPage } from '../../../src/pages/JourneyBoard';
import { ApiError, type ApiClient, type BoardRead, type EpicStage } from '../../../src/services/api';

const COLUMNS = ['Not started', 'Specified', 'Clarified', 'Checklisted', 'Planned', 'Tasked', 'Analyzed', 'Ready', 'Implementing', 'Converged'];

function stage(over: Partial<EpicStage>): EpicStage {
  return { epicId: 'e1', number: 1, slug: 'intake', title: 'Intake', status: 'active', stage: 'Specified', missing: [], unrecognised: [], last: { executionId: 'exec_1', command: 'specify', outcome: 'completed', at: '2026-09-05T10:00:00Z' }, next: '/speckit-clarify', readiness: { verdict: 'n/a', failing: [] }, running: null, derivedFrom: 'executions', ...over };
}

const BOARD: BoardRead = {
  columns: COLUMNS,
  epics: [
    stage({}),
    stage({ epicId: 'e2', number: 2, slug: 'review', title: 'Review', stage: 'Not started', last: null, next: '/speckit-specify' }),
    stage({ epicId: 'e3', number: 3, slug: 'reports', title: 'Reports', stage: 'Ready', next: '/speckit-implement', readiness: { verdict: 'Ready', note: 'no readiness conditions configured', failing: [] } }),
    stage({ epicId: 'e4', number: 4, slug: 'deep', title: 'Deep', stage: 'Implementing', next: '/speckit-converge', running: { executionId: 'exec_9', since: '2026-09-05T11:00:00Z' }, last: { executionId: 'exec_9', command: 'implement', outcome: 'started', at: '2026-09-05T11:00:00Z' } }),
    stage({ epicId: 'e5', number: 5, slug: 'old', title: 'Old', stage: 'Specified', status: 'closed', next: null }),
    stage({ epicId: 'e6', number: 6, slug: 'parent', title: 'Parent', stage: 'Not started', status: 'split', next: null, last: null }),
    stage({ epicId: 'e8', number: 8, slug: 'parent-a', title: 'Parent (a)', stage: 'Not started', last: null, next: '/speckit-specify' }),
    stage({ epicId: 'e9', number: 9, slug: 'parent-b', title: 'Parent (b)', stage: 'Not started', last: null, next: '/speckit-specify' }),
  ],
  unbound: [{ executionId: 'exec_77', command: 'plan', targetId: '99', registeredAt: '2026-09-05T09:00:00Z' }],
  packageVersion: '0.1.0',
  profile: 'product',
};

const EPICS = { epics: BOARD.epics.map((s) => ({ id: s.epicId, projectId: 'p1', number: s.number, slug: s.slug, title: s.title, description: '', status: s.status as 'active', parentEpicId: null, splitSuffix: null, createdAt: '', updatedAt: '', closedAt: null, requirementCount: 2, specificationCount: 0 })).map((e) => (e.id === 'e6' ? { ...e, status: 'split' as const } : e.id === 'e8' ? { ...e, parentEpicId: 'e6', splitSuffix: 'a' } : e.id === 'e9' ? { ...e, parentEpicId: 'e6', splitSuffix: 'b' } : e)), unassigned: [] };

function api(over: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    getBoard: vi.fn(async () => BOARD),
    listEpics: vi.fn(async () => EPICS),
    // EPIC-045 T1683: the unbound group reads this. Empty by default; the
    // tests that care about its content supply their own answer.
    getUnboundArtifacts: vi.fn(async () => ({ projectId: 'p1', syncs: [] })),
    ...over,
  } as unknown as ApiClient;
}

afterEach(cleanup);

async function page(client: ApiClient) {
  const onOpenEpic = vi.fn();
  const onOpenTimeline = vi.fn();
  const view = render(<JourneyBoardPage api={client} projectId="p1" onOpenEpic={onOpenEpic} onOpenTimeline={onOpenTimeline} />);
  await screen.findByRole('heading', { name: 'Spec Journey Board' });
  await waitFor(() => expect(screen.queryByText('Loading the board')).toBeNull());
  return { onOpenEpic, onOpenTimeline, view };
}

describe('T1584 · the Spec Journey Board', () => {
  it('renders the columns in order and every card in the column of its stage', async () => {
    await page(api());
    const columns = screen.getAllByRole('region', { name: /^Stage: / });
    expect(columns.map((c) => c.getAttribute('aria-label'))).toEqual(COLUMNS.map((c) => `Stage: ${c}`));
    expect(within(screen.getByRole('region', { name: 'Stage: Specified' })).getAllByRole('article').map((a) => a.textContent)).toEqual([expect.stringContaining('Epic 1 · Intake'), expect.stringContaining('Epic 5 · Old')]);
    expect(within(screen.getByRole('region', { name: 'Stage: Implementing' })).getByRole('article').textContent).toContain('Epic 4 · Deep');
  });

  it('a card shows the last command with outcome and time as a timeline link, the next command or why there is none, and its state markers', async () => {
    const { onOpenTimeline, onOpenEpic } = await page(api());
    const intake = screen.getByRole('article', { name: 'Epic 1 · Intake' });
    expect(intake.textContent).toContain('specify · completed');
    expect(intake.textContent).toContain('Next: /speckit-clarify');
    fireEvent.click(within(intake).getByRole('button', { name: /specify · completed/ }));
    expect(onOpenTimeline).toHaveBeenCalledWith('p1');
    fireEvent.click(within(intake).getByRole('button', { name: 'Open Epic 1' }));
    expect(onOpenEpic).toHaveBeenCalledWith('e1');
    expect(screen.getByRole('article', { name: 'Epic 5 · Old' }).textContent).toContain('closed — no next command');
    expect(screen.getByRole('article', { name: 'Epic 6 · Parent' }).textContent).toContain('split');
    expect(screen.getByRole('article', { name: 'Epic 4 · Deep' }).textContent).toContain('running since');
    expect(screen.getByRole('article', { name: 'Epic 2 · Review' }).textContent).toContain('no execution yet');
  });

  it('a split parent card says which children it became and a child card names its parent and suffix (T1595, FR-EPB-063)', async () => {
    await page(api());
    expect(screen.getByRole('article', { name: 'Epic 6 · Parent' }).textContent).toContain('split into 8, 9');
    expect(screen.getByRole('article', { name: 'Epic 8 · Parent (a)' }).textContent).toContain('child a of Epic 6');
    expect(screen.getByRole('article', { name: 'Epic 1 · Intake' }).textContent).not.toContain('child');
  });

  it('shows the readiness verdict as a separate claim, with the note when no conditions are configured (FR-EPB-045)', async () => {
    await page(api());
    const reports = screen.getByRole('article', { name: 'Epic 3 · Reports' });
    expect(reports.textContent).toContain('Readiness: Ready');
    expect(reports.textContent).toContain('no readiness conditions configured');
    expect(screen.getByRole('article', { name: 'Epic 1 · Intake' }).textContent).not.toContain('Readiness: Ready');
  });

  it('lists unbound executions as their own group', async () => {
    await page(api());
    const group = screen.getByRole('region', { name: 'Unbound executions' });
    expect(group.textContent).toContain('99');
    expect(group.textContent).toContain('plan');
  });

  it('filters by title and by stage', async () => {
    await page(api());
    fireEvent.change(screen.getByLabelText('Filter by title'), { target: { value: 'deep' } });
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Epic 4 · Deep']);
    fireEvent.change(screen.getByLabelText('Filter by title'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter by stage'), { target: { value: 'Specified' } });
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Epic 1 · Intake', 'Epic 5 · Old']);
  });

  it('states that stages are derived from executions, names the package version, and says where readiness conditions are configured (FR-EPB-049, FR-EPB-046, T1616)', async () => {
    await page(api());
    expect(screen.getByText(/Stages are derived from executions · epic-stage v0\.1\.0/)).toBeDefined();
    expect(screen.getByText(/Readiness conditions for this project will be configured under Governance → Constraints; none are configured today\./)).toBeDefined();
  });

  it('re-renders a moved card on reload and offers no manual refresh control (FR-EPB-048)', async () => {
    const client = api({ getBoard: vi.fn().mockResolvedValueOnce(BOARD).mockResolvedValue({ ...BOARD, epics: BOARD.epics.map((e) => (e.epicId === 'e1' ? { ...e, stage: 'Clarified', next: '/speckit-checklist' } : e)) }) });
    const { view } = await page(client);
    expect(within(screen.getByRole('region', { name: 'Stage: Specified' })).getByRole('article', { name: 'Epic 1 · Intake' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /refresh/i })).toBeNull();
    view.unmount();
    await page(client);
    expect(within(screen.getByRole('region', { name: 'Stage: Clarified' })).getByRole('article', { name: 'Epic 1 · Intake' })).toBeDefined();
  });

  it('four states: loading, error, empty, partial', async () => {
    render(<JourneyBoardPage api={api()} projectId="p1" onOpenEpic={vi.fn()} onOpenTimeline={vi.fn()} />);
    expect(screen.getByText('Loading the board')).toBeDefined();
    cleanup();
    await page(api({ getBoard: vi.fn(async () => { throw new ApiError('internal_error', 'Down.', 500); }), listEpics: vi.fn(async () => { throw new ApiError('internal_error', 'Down.', 500); }) }));
    expect(screen.getByRole('alert').textContent).toContain('Down.');
    cleanup();
    await page(api({ getBoard: vi.fn(async () => ({ ...BOARD, epics: [], unbound: [] })), listEpics: vi.fn(async () => ({ epics: [], unassigned: [] })) }));
    expect(screen.getByText(/No Epics yet./)).toBeDefined();
    cleanup();
    await page(api({ listEpics: vi.fn(async () => { throw new ApiError('internal_error', 'Counts down.', 500); }) }));
    expect(screen.getByRole('alert').textContent).toContain('Some of this screen did not load');
    expect(screen.getByRole('article', { name: 'Epic 1 · Intake' })).toBeDefined();
  });
});

describe('T1588 · nothing on the board marks an Epic ready by hand (FR-EPB-001, FR-EPB-045)', () => {
  it('offers no control whose name mentions readiness or a stage', async () => {
    await page(api());
    const names = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(names.some((n) => /ready|stage|move/i.test(n))).toBe(false);
    expect(screen.queryByRole('combobox', { name: /stage/i })?.getAttribute('id')).toBe('board-stage-filter');
  });
});

describe('T1617 · an unrecognised command on a card (EPIC-044, spec §Edge Cases)', () => {
  it('reads "unrecognised command: …" and keeps the stage the known commands derive', async () => {
    const board: BoardRead = { ...BOARD, epics: [...BOARD.epics, stage({ epicId: 'e7', number: 7, slug: 'ops', title: 'Ops', stage: 'Specified', unrecognised: ['deploy'] })] };
    await page(api({ getBoard: vi.fn(async () => board) }));
    const card = screen.getByRole('article', { name: 'Epic 7 · Ops' });
    expect(card.textContent).toContain('unrecognised command: deploy');
    expect(within(screen.getByRole('region', { name: 'Stage: Specified' })).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toContain('Epic 7 · Ops');
    expect(screen.getByRole('article', { name: 'Epic 1 · Intake' }).textContent).not.toContain('unrecognised');
  });
});

/**
 * `T1682` (EPIC-045, `FR-ART-007`, analysis `C1`) — the unbound group names how
 * many files each execution's sync stored, and links to them.
 *
 * This group is the ONLY place an unbound sync is reachable: no Epic's tree
 * lists it, by construction. A board that named the execution but not its
 * files would leave a governed command's output with nowhere to be seen, which
 * is what `C1` found.
 */
describe('T1682 · the unbound group names the files each sync stored', () => {
  const UNBOUND_SYNCS = {
    projectId: 'p1',
    syncs: [
      {
        syncId: 'sync_1',
        executionId: 'exec_77',
        command: 'specify',
        outcome: 'completed',
        at: '2026-09-05T10:00:00Z',
        created: 2,
        reused: 0,
        refused: 1,
        files: [
          { path: 'specs/099-ghost/spec.md', digest: 'a'.repeat(64), outcome: 'created', versionId: 'v1', refusalCode: null },
          { path: 'specs/099-ghost/plan.md', digest: 'b'.repeat(64), outcome: 'created', versionId: 'v2', refusalCode: null },
          { path: 'specs/099-ghost/notes.txt', digest: 'c'.repeat(64), outcome: 'refused', versionId: null, refusalCode: 'path_not_in_artifact_set' },
        ],
      },
    ],
  };

  it('names the count and opens the list of paths', async () => {
    await page(api({ getUnboundArtifacts: vi.fn(async () => UNBOUND_SYNCS) }));
    const group = await screen.findByRole('region', { name: 'Unbound executions' });
    const link = await within(group).findByRole('button', { name: '3 files synced' });
    fireEvent.click(link);
    expect(within(group).getByText('specs/099-ghost/spec.md')).toBeDefined();
    expect(within(group).getByText('specs/099-ghost/notes.txt')).toBeDefined();
    expect(group.textContent).toContain('path_not_in_artifact_set');
  });

  it('says *no files synced* for an unbound execution whose sync stored nothing', async () => {
    await page(api({ getUnboundArtifacts: vi.fn(async () => ({ projectId: 'p1', syncs: [] })) }));
    const group = await screen.findByRole('region', { name: 'Unbound executions' });
    await waitFor(() => expect(group.textContent).toContain('no files synced'));
  });

  it('a failure of the unbound-artifacts read leaves the board standing and the group states it', async () => {
    await page(api({ getUnboundArtifacts: vi.fn(async () => { throw new ApiError('not_found', 'Artifacts are unavailable.', 404); }) }));
    const group = await screen.findByRole('region', { name: 'Unbound executions' });
    await waitFor(() => expect(group.textContent).toContain('Artifacts are unavailable.'));
    // The board itself is untouched.
    expect(screen.getByRole('region', { name: 'Unbound executions' })).toBeDefined();
    // The execution row itself is untouched — it names the command and the
            // target Epic, as EPIC-044 wrote it.
    expect(group.textContent).toContain('plan for Epic 99');
    expect(group.textContent).not.toContain('no files synced');
  });
});
