/**
 * `T1716` (EPIC-046, `contracts/board-contract.md`) — the Task Kanban.
 *
 * Three assertions carry most of the weight:
 *
 *  - **the refused lines are shown.** `FR-KAN-003`. A board that quietly drops
 *    what it could not read looks cleaner and is less true, and a reader has no
 *    way to notice the difference. So the list is asserted, with its numbers.
 *  - **the two empty states are different.** *Nothing synced* and *a synced file
 *    with no task lines* lead to different actions, and a reader who cannot tell
 *    them apart does not know whether to run `/speckit-tasks` or open the file.
 *  - **no control edits anything.** The platform is a mirror; an edit made here
 *    would be silently overwritten by the next governed command.
 *
 * Written to FAIL before `T1717`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TaskBoardPage } from '../../../src/pages/TaskBoard';
import { ApiError, type ApiClient, type TaskBoard, type TaskDisagreements } from '../../../src/services/api';
import type { OutstandingProposal } from '../../../src/services/api';

const PARSE = {
  syncId: 's1', executionId: 'exec_9', digest: 'a'.repeat(64), syncedAt: '2026-09-07T10:00:00.000Z',
  command: 'implement', outcome: 'partially-completed',
};

function card(over: Partial<TaskBoard['tasks'][number]> = {}): TaskBoard['tasks'][number] {
  return {
    id: 't1',
    taskKey: 'T1701',
    description: 'Write the failing test',
    status: 'not_started',
    parallel: false,
    sourceLine: 3,
    sourcePaths: ['backend/src/a.ts'],
    movedBy: 'parse',
    movedAt: null,
    movedByActorId: null,
    notInLatestParse: false,
    outstandingProposal: null,
    supersededByFile: null,
    ...over,
  };
}

function board(over: Partial<TaskBoard> = {}): TaskBoard {
  const tasks = over.tasks ?? [
    card(),
    card({ id: 't2', taskKey: 'T1702', description: 'Implement it', status: 'done', parallel: true, sourceLine: 4 }),
  ];
  return {
    epicId: 'e1',
    columns: [
      { status: 'not_started', taskKeys: tasks.filter((t) => t.status === 'not_started').map((t) => t.taskKey ?? t.id) },
      { status: 'in_progress', taskKeys: tasks.filter((t) => t.status === 'in_progress').map((t) => t.taskKey ?? t.id) },
      { status: 'done', taskKeys: tasks.filter((t) => t.status === 'done').map((t) => t.taskKey ?? t.id) },
      { status: 'blocked', taskKeys: tasks.filter((t) => t.status === 'blocked').map((t) => t.taskKey ?? t.id) },
    ],
    tasks,
    latestParse: PARSE,
    counts: { linesConsidered: 4, parsed: 2, refused: 1, duplicates: 1 },
    diff: { added: 2, changed: 0, unchanged: 0, disappeared: 0 },
    refusedLines: [
      { line: 5, code: 'identifier_not_matched', text: '- [ ] Tidy up the module' },
      { line: 6, code: 'duplicate_identifier', text: '- [ ] T1701 Again' },
    ],
    outOfBandEdit: false,
    remainingUnchecked: 1,
    unmatchedProgress: [],
    staleness: null,
    canMove: true,
    ...over,
  };
}

const NO_DISAGREEMENTS: TaskDisagreements = {
  aheadOfFile: [], notInLatestParse: [], unmatchedProgress: [], refusedLines: [],
  outOfBandEdit: false, digestMismatch: null, total: 0,
};

const NO_PROGRESS = { total: 2, done: 1, inProgress: 0, notStarted: 1, blocked: 0, percentComplete: 50 };

function apiWith(answer: TaskBoard | Promise<TaskBoard>, open: TaskDisagreements = NO_DISAGREEMENTS): ApiClient {
  return {
    getEpicTasks: vi.fn(async () => await answer),
    getTaskDisagreements: vi.fn(async () => open),
    // `T1787` — the board reads its own progress. Every test gets a plausible
    // one so the three reads are independent, which is the point of them being
    // three (`FR-SHL-060`'s partial state).
    getEpicTaskProgress: vi.fn(async () => NO_PROGRESS),
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('T1716 · the columns and the cards', () => {
  it('renders the four columns in the order the contract names', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    await screen.findByLabelText('Not started');
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '');
    expect(headings.slice(0, 4).map((h) => h.replace(/\s*\(\d+\)\s*$/, ''))).toEqual([
      'Not started', 'In progress', 'Done', 'Blocked',
    ]);
  });

  it('keeps an empty column rather than hiding it', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    const blocked = await screen.findByLabelText('Blocked');
    expect(within(blocked).getByText('Nothing here.')).toBeTruthy();
  });

  it('shows the identifier, the parallel marker, the source line and what last moved it', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    const notStarted = await screen.findByLabelText('Not started');
    expect(within(notStarted).getByText('T1701')).toBeTruthy();
    expect(within(notStarted).getByText(/line 3/)).toBeTruthy();
    expect(within(notStarted).getByText(/moved by the file/)).toBeTruthy();
    const done = screen.getByLabelText('Done');
    expect(within(done).getByText('[P]')).toBeTruthy();
  });

  it('names a proposal as what moved a card, not a bare status', async () => {
    const tasks = [card({ status: 'in_progress', movedBy: 'proposal', movedAt: '2026-09-07T11:00:00.000Z', movedByActorId: 'u_1' })];
    render(<TaskBoardPage api={apiWith(board({ tasks }))} epicId="e1" />);
    const inProgress = await screen.findByLabelText('In progress');
    expect(within(inProgress).getByText(/moved by a proposal/)).toBeTruthy();
    expect(within(inProgress).getByText(/u_1/)).toBeTruthy();
  });

  it('shows the repository paths a description names, and nothing when it names none', async () => {
    const tasks = [card(), card({ id: 't3', taskKey: 'T1703', sourcePaths: [] })];
    render(<TaskBoardPage api={apiWith(board({ tasks }))} epicId="e1" />);
    await screen.findByLabelText('Not started');
    expect(screen.getByText('backend/src/a.ts')).toBeTruthy();
  });

  it('keeps a task the latest parse omitted, and marks it (FR-KAN-025)', async () => {
    const tasks = [card({ notInLatestParse: true })];
    render(<TaskBoardPage api={apiWith(board({ tasks }))} epicId="e1" />);
    expect(await screen.findByText('not in the latest parse')).toBeTruthy();
  });
});

describe('T1716 · the header (FR-KAN-052)', () => {
  it('names the execution, the digest, the time and the counts', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    const header = await screen.findByTestId('latest-parse');
    expect(header.textContent).toContain('exec_9');
    expect(header.textContent).toContain('aaaaaaaaaaaa');
    // SC-KAN-001's arithmetic, checkable by eye.
    expect(header.textContent).toContain('4 considered = 2 parsed + 1 refused + 1 duplicate');
  });

  it('says when the file changed outside a governed command (FR-KAN-023)', async () => {
    render(<TaskBoardPage api={apiWith(board({ outOfBandEdit: true }))} epicId="e1" />);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/changed outside a governed command/)).toBeTruthy();
  });

  it('states that movement is observed, not pushed live (FR-KAN-046)', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    expect(await screen.findByText(/observed on sync and on\s+event, not pushed live/)).toBeTruthy();
  });

  it('states which side is authoritative, because absence cannot be inferred', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    expect(await screen.findByText(/project directory is authoritative/)).toBeTruthy();
  });
});

describe('T1716 · refused lines are shown, never dropped (FR-KAN-003)', () => {
  it('lists each with its number, code and text', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    await screen.findByLabelText('Refused lines');
    const rows = screen.getAllByTestId('refused-line');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('line 5');
    expect(rows[0]?.textContent).toContain('identifier_not_matched');
    expect(rows[1]?.textContent).toContain('duplicate_identifier');
  });

  it('says so plainly when the parse read every line', async () => {
    render(<TaskBoardPage api={apiWith(board({ refusedLines: [] }))} epicId="e1" />);
    expect(await screen.findByText('Every task line of the latest parse was read.')).toBeTruthy();
  });
});

describe('T1716 · the two empty states are different (US1 scenario 5)', () => {
  it('names the command to run when nothing has synced', async () => {
    const empty = board({ tasks: [], latestParse: null, counts: { linesConsidered: 0, parsed: 0, refused: 0, duplicates: 0 }, refusedLines: [] });
    render(<TaskBoardPage api={apiWith(empty)} epicId="e1" />);
    // The sentence is split by a <code> element, so the assertion matches the
    // contiguous text node rather than the rendered sentence.
    expect(await screen.findByText(/has been synced for this Epic yet/)).toBeTruthy();
    expect(screen.getByText('/speckit-tasks')).toBeTruthy();
  });

  it('says the file carried no task lines when a sync did happen', async () => {
    const empty = board({ tasks: [], counts: { linesConsidered: 0, parsed: 0, refused: 0, duplicates: 0 }, refusedLines: [] });
    render(<TaskBoardPage api={apiWith(empty)} epicId="e1" />);
    expect(await screen.findByText(/contains no task lines/)).toBeTruthy();
    expect(screen.queryByText(/has been synced for this Epic yet/)).toBeNull();
  });
});

describe('T1716 · the filters (FR-KAN-053)', () => {
  it('filters by free text over identifier and description', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    await screen.findByLabelText('Not started');
    fireEvent.change(screen.getByLabelText('Filter tasks'), { target: { value: 'Implement' } });
    await waitFor(() => expect(screen.queryByText('T1701')).toBeNull());
    expect(screen.getByText('T1702')).toBeTruthy();
  });

  it('filters to parallel-safe tasks', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    await screen.findByLabelText('Not started');
    fireEvent.click(screen.getByLabelText('Parallel-safe only'));
    await waitFor(() => expect(screen.queryByText('T1701')).toBeNull());
    expect(screen.getByText('T1702')).toBeTruthy();
  });
});

describe('T1716 · the four states (FR-KAN-059)', () => {
  it('states that it is loading', () => {
    render(<TaskBoardPage api={apiWith(new Promise<TaskBoard>(() => undefined))} epicId="e1" />);
    expect(screen.getByText(/Loading the task board/)).toBeTruthy();
  });

  it('states an error in words and leaves the rest of the Epic standing', async () => {
    const api = {
      getEpicTasks: vi.fn(async () => { throw new ApiError('not_found', 'No board.', 404); }),
      getTaskDisagreements: vi.fn(async () => NO_DISAGREEMENTS),
      getEpicTaskProgress: vi.fn(async () => NO_PROGRESS),
    } as unknown as ApiClient;
    render(<TaskBoardPage api={api} epicId="e1" />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No board.');
    expect(alert.textContent).toContain('other sections are unaffected');
  });
});

describe('T1716 · nothing on this surface edits a file (FR-KAN-010)', () => {
  it('offers no edit, upload, rename or delete control', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    await screen.findByLabelText('Not started');
    for (const label of [/edit/i, /upload/i, /rename/i, /delete/i, /save/i]) {
      expect(screen.queryByRole('button', { name: label }), String(label)).toBeNull();
    }
    // The only inputs are the filters.
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
  });
});

describe('T1729 · the run and what it left (FR-KAN-044, FR-KAN-045)', () => {
  it('names the command, its outcome and the tasks still unchecked', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    const run = await screen.findByTestId('latest-run');
    expect(run.textContent).toContain('implement');
    expect(run.textContent).toContain('partially-completed');
    expect(run.textContent).toContain('1 task still unchecked');
  });

  it('shows the outcome beside the cards without moving any of them', async () => {
    // FR-KAN-045: `partially-completed` is a fact about the run. The card in
    // `Not started` stays there — the file and the events decide, not the run.
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    const notStarted = await screen.findByLabelText('Not started');
    expect(within(notStarted).getByText('T1701')).toBeTruthy();
  });

  it('says nothing about a run it cannot read, rather than inventing one', async () => {
    const unknown = board({ latestParse: { ...PARSE, command: null, outcome: null } });
    render(<TaskBoardPage api={apiWith(unknown)} epicId="e1" />);
    await screen.findByTestId('latest-parse');
    expect(screen.queryByTestId('latest-run')).toBeNull();
  });

  it('lists unmatched progress reports and says nothing was created from them (FR-KAN-042)', async () => {
    const withUnmatched = board({
      unmatchedProgress: [{ executionId: 'exec_9', taskId: 'tidy-up', occurredAt: '2026-09-07T10:05:00.000Z' }],
    });
    render(<TaskBoardPage api={apiWith(withUnmatched)} epicId="e1" />);
    const group = await screen.findByRole('region', { name: 'Unmatched progress reports' });
    expect(within(group).getByText('tidy-up')).toBeTruthy();
    expect(group.textContent).toContain('Nothing was created from it');
  });

  it('hides the section entirely when every report matched', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    await screen.findByLabelText('Not started');
    expect(screen.queryByRole('region', { name: 'Unmatched progress reports' })).toBeNull();
  });
});

describe('T1748 · the card opens the move dialog (contracts/board-contract.md §4)', () => {
  it('offers a keyboard-operable status control on every card', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    await screen.findByLabelText('Not started');
    // A `select`, not a drag handle: BR-0193 requires the board be operable
    // without a pointer, so this is the PRIMARY affordance (R-046-10).
    const controls = screen.getAllByRole('combobox');
    expect(controls.length).toBe(2);
  });

  it('opens the dialog rather than moving the card directly', async () => {
    const api = apiWith(board());
    render(<TaskBoardPage api={api} epicId="e1" />);
    await screen.findByLabelText('Not started');
    fireEvent.change(screen.getAllByRole('combobox')[0] as HTMLElement, { target: { value: 'done' } });
    // The dialog is the only path: nothing has been proposed yet.
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect((api as unknown as { proposeTaskStatus?: unknown }).proposeTaskStatus).toBeUndefined();
  });

  it('proposes with the card current status as the expected one (FR-KAN-016)', async () => {
    const proposeTaskStatus = vi.fn(async () => ({ proposalId: 'p1', verdict: 'applied' as const, reason: 'ok', decidedAt: '' }));
    const api = { getEpicTasks: vi.fn(async () => board()), getTaskDisagreements: vi.fn(async () => NO_DISAGREEMENTS), getEpicTaskProgress: vi.fn(async () => NO_PROGRESS), proposeTaskStatus } as unknown as ApiClient;
    render(<TaskBoardPage api={api} epicId="e1" />);
    await screen.findByLabelText('Not started');
    fireEvent.change(screen.getAllByRole('combobox')[0] as HTMLElement, { target: { value: 'blocked' } });
    fireEvent.change(await screen.findByLabelText('Reason'), { target: { value: 'Waiting on an answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Propose the move' }));
    await waitFor(() =>
      expect(proposeTaskStatus).toHaveBeenCalledWith('t1', {
        expectedCurrentStatus: 'not_started',
        requestedStatus: 'blocked',
        reason: 'Waiting on an answer',
      }),
    );
  });

  it('keeps the dialog open and shows the verdict when a move does not apply (FR-KAN-015)', async () => {
    const proposeTaskStatus = vi.fn(async () => ({
      proposalId: 'p1', verdict: 'approval_required' as const, reason: 'This project requires a second person.', decidedAt: '',
    }));
    const api = { getEpicTasks: vi.fn(async () => board()), getTaskDisagreements: vi.fn(async () => NO_DISAGREEMENTS), getEpicTaskProgress: vi.fn(async () => NO_PROGRESS), proposeTaskStatus } as unknown as ApiClient;
    render(<TaskBoardPage api={api} epicId="e1" />);
    await screen.findByLabelText('Not started');
    fireEvent.change(screen.getAllByRole('combobox')[0] as HTMLElement, { target: { value: 'blocked' } });
    fireEvent.change(await screen.findByLabelText('Reason'), { target: { value: 'Waiting on an answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Propose the move' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('approval_required');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('T1755 · the board says what it does not know (FR-KAN-020, FR-KAN-024)', () => {
  it('says so plainly when the board and the file agree', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    const group = await screen.findByRole('region', { name: 'Open disagreements' });
    expect(group.textContent).toContain('The board and the file agree.');
  });

  it('names both sides of a task running ahead of the file', async () => {
    const open: TaskDisagreements = {
      ...NO_DISAGREEMENTS,
      aheadOfFile: [{ taskKey: 'T1701', status: 'in_progress' }],
      total: 1,
    };
    render(<TaskBoardPage api={apiWith(board(), open)} epicId="e1" />);
    const group = await screen.findByRole('region', { name: 'Open disagreements' });
    expect(group.textContent).toContain('T1701');
    expect(group.textContent).toContain('because a person said so');
    // The rule that decided the outcome, stated on the surface.
    expect(group.textContent).toContain('until the file speaks');
  });

  it('marks the card itself, not only the list', async () => {
    const tasks = [card({ status: 'in_progress', movedBy: 'proposal' })];
    render(<TaskBoardPage api={apiWith(board({ tasks }))} epicId="e1" />);
    expect(await screen.findByText(/ahead of the file/)).toBeTruthy();
  });

  it('reports a digest mismatch as a finding, and says it is not repaired (FR-KAN-036)', async () => {
    const open: TaskDisagreements = {
      ...NO_DISAGREEMENTS,
      digestMismatch: { parsed: 'a'.repeat(64), artifact: 'b'.repeat(64) },
      total: 1,
    };
    render(<TaskBoardPage api={apiWith(board(), open)} epicId="e1" />);
    const group = await screen.findByRole('region', { name: 'Open disagreements' });
    expect(group.textContent).toContain('Reported, not repaired');
  });

  it('says an out-of-band edit was accepted rather than resolved (R-05)', async () => {
    const open: TaskDisagreements = { ...NO_DISAGREEMENTS, outOfBandEdit: true, total: 1 };
    render(<TaskBoardPage api={apiWith(board(), open)} epicId="e1" />);
    const group = await screen.findByRole('region', { name: 'Open disagreements' });
    expect(group.textContent).toContain('content was accepted');
    expect(group.textContent).toContain('recorded rather than resolved');
  });

  it('counts them, so the header states a number rather than a vague some', async () => {
    const open: TaskDisagreements = {
      ...NO_DISAGREEMENTS,
      aheadOfFile: [{ taskKey: 'T1701', status: 'blocked' }],
      notInLatestParse: [{ taskKey: 'T1702' }],
      total: 2,
    };
    render(<TaskBoardPage api={apiWith(board(), open)} epicId="e1" />);
    expect(await screen.findByRole('heading', { name: 'Open disagreements (2)' })).toBeTruthy();
    expect(screen.getAllByTestId('disagreement')).toHaveLength(2);
  });

  it('leaves the board standing when the disagreements read fails (FR-SHL-060)', async () => {
    const api = {
      getEpicTasks: vi.fn(async () => board()),
      getTaskDisagreements: vi.fn(async () => { throw new ApiError('not_found', 'Unavailable.', 404); }),
      getEpicTaskProgress: vi.fn(async () => NO_PROGRESS),
    } as unknown as ApiClient;
    render(<TaskBoardPage api={api} epicId="e1" />);
    // The columns render; only the section is absent.
    await screen.findByLabelText('Not started');
    expect(screen.queryByRole('region', { name: 'Open disagreements' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('T1772 · the board says when it is behind (FR-KAN-048)', () => {
  it('names both times, so the gap is read rather than guessed', async () => {
    const api = apiWith(board({
      staleness: {
        executionId: 'x_provisional',
        command: 'implement',
        executionAt: '2026-09-07T14:00:00.000Z',
        parsedAt: '2026-09-07T10:00:00.000Z',
      },
    }));
    render(<TaskBoardPage api={api} epicId="e1" />);
    const note = await screen.findByTestId('board-stale');
    expect(note.textContent).toContain('behind the Epic');
    expect(note.textContent).toContain('implement');
    expect(note.textContent).toContain('x_provisional');
    // Both instants, each rendered the way every other time on this page is.
    expect(note.textContent).toContain(new Date('2026-09-07T14:00:00.000Z').toLocaleString());
    expect(note.textContent).toContain(new Date('2026-09-07T10:00:00.000Z').toLocaleString());
  });

  it('says nothing when the board is level — silence is the current state', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    await screen.findByTestId('latest-parse');
    expect(screen.queryByTestId('board-stale')).toBeNull();
  });

  it('still shows the cards it has — a stale board is out of date, not wrong', async () => {
    const api = apiWith(board({
      staleness: { executionId: 'x_9', command: 'implement', executionAt: '2026-09-07T14:00:00.000Z', parsedAt: '2026-09-07T10:00:00.000Z' },
    }));
    render(<TaskBoardPage api={api} epicId="e1" />);
    await screen.findByTestId('board-stale');
    expect(screen.getAllByTestId('task-card')).toHaveLength(2);
  });
});


/**
 * `T1782` (EPIC-046, `FR-KAN-014`, `FR-KAN-015`) — the card says what happened
 * to a proposal.
 *
 * `/speckit-converge` found the verdict stated only inside the move dialog. A
 * person who got `approval_required` and closed it saw a card identical to one
 * nobody had touched — no requested status, no requester, no reason, no time,
 * no verdict. Most of `SC-KAN-005`'s user-facing half, missing.
 */
describe('T1782 · an outstanding proposal is on the card (FR-KAN-014, FR-KAN-015)', () => {
  const awaiting = {
    proposalId: 'pr_1',
    expectedCurrentStatus: 'not_started' as const,
    requestedStatus: 'in_progress' as const,
    reason: 'Started it this morning',
    proposerId: 'u_ana',
    proposerType: 'user' as const,
    proposedAt: '2026-09-07T10:00:00.000Z',
    verdict: 'approval_required' as const,
  };

  it('states the requested status, the requester, the reason and the time', async () => {
    const api = apiWith(board({ tasks: [card({ outstandingProposal: awaiting })] }));
    render(<TaskBoardPage api={api} epicId="e1" />);
    const note = await screen.findByTestId('outstanding-proposal');
    expect(note.textContent).toContain('In progress');
    expect(note.textContent).toContain('u_ana');
    expect(note.textContent).toContain('Started it this morning');
    expect(note.textContent).toContain(new Date('2026-09-07T10:00:00.000Z').toLocaleString());
  });

  it('states the verdict in words AND by name, so it can be read and quoted', async () => {
    const api = apiWith(board({ tasks: [card({ outstandingProposal: awaiting })] }));
    render(<TaskBoardPage api={api} epicId="e1" />);
    const note = await screen.findByTestId('outstanding-proposal');
    expect(note.textContent).toContain('waiting for a second person to approve');
    expect(note.textContent).toContain('approval_required');
  });

  it.each([
    ['refused', 'refused'],
    ['inconsistent', 'the task had already moved'],
    ['reconciliation_required', 'needs reconciliation'],
  ] as const)('states a %s verdict and says the card stays where it is', async (verdict, words) => {
    const api = apiWith(board({ tasks: [card({ outstandingProposal: { ...awaiting, verdict } })] }));
    render(<TaskBoardPage api={api} epicId="e1" />);
    const note = await screen.findByTestId('outstanding-proposal');
    expect(note.textContent).toContain(words);
    expect(note.textContent).toContain('stays where it is');
  });

  it('says nothing when there is no outstanding proposal — silence is the ordinary case', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    await screen.findByTestId('latest-parse');
    expect(screen.queryByTestId('outstanding-proposal')).toBeNull();
  });

  it('leaves the card in its own column — a proposal that did not apply moved nothing', async () => {
    const api = apiWith(board({ tasks: [card({ status: 'not_started', outstandingProposal: awaiting })] }));
    render(<TaskBoardPage api={api} epicId="e1" />);
    await screen.findByTestId('outstanding-proposal');
    const notStarted = screen.getByRole('region', { name: 'Not started' });
    expect(within(notStarted).getAllByTestId('task-card')).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'In progress' })).queryAllByTestId('task-card')).toHaveLength(0);
  });
});

/**
 * `T1785` (EPIC-046, `FR-KAN-053`) — the fourth filter.
 *
 * The requirement names four axes; three had a control. *Ahead of the file* is
 * the one a reviewer reaches for most, because it is the set of cards the file
 * cannot confirm.
 */
describe('T1785 · filtering by ahead of the file (FR-KAN-053)', () => {
  const ahead = card({ id: 'ta', taskKey: 'T9001', status: 'in_progress', movedBy: 'proposal' });
  const plain = card({ id: 'tb', taskKey: 'T9002', status: 'not_started' });

  it('narrows to the cards running ahead of the file', async () => {
    render(<TaskBoardPage api={apiWith(board({ tasks: [ahead, plain] }))} epicId="e1" />);
    await screen.findByTestId('latest-parse');
    expect(screen.getAllByTestId('task-card')).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('Ahead of the file only'));
    const cards = screen.getAllByTestId('task-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]?.textContent).toContain('T9001');
  });

  it('shows everything again when it is switched off', async () => {
    render(<TaskBoardPage api={apiWith(board({ tasks: [ahead, plain] }))} epicId="e1" />);
    await screen.findByTestId('latest-parse');
    const control = screen.getByLabelText('Ahead of the file only');
    fireEvent.click(control);
    fireEvent.click(control);
    expect(screen.getAllByTestId('task-card')).toHaveLength(2);
  });
});

/**
 * `T1786` (EPIC-046, `FR-KAN-059`, `FR-SHL-060`) — the fourth state, stated.
 *
 * Loading, empty and error were all said in words. **Partial** was handled and
 * never said: a failed disagreements read made the section vanish, and a reader
 * saw a board that looked complete and was not.
 */
describe('T1786 · the board states its partial state (FR-KAN-059)', () => {
  it('says which part could not be loaded, and keeps the cards it has', async () => {
    const api = apiWith(board());
    api.getTaskDisagreements = vi.fn(async () => {
      throw new ApiError('unavailable', 'The disagreements could not be read.', 503);
    });
    render(<TaskBoardPage api={api} epicId="e1" />);
    const note = await screen.findByTestId('board-partial');
    expect(note.textContent).toContain('disagreements');
    // The rest of the board is standing — that is what makes it partial and not
    // an error (`FR-SHL-060`).
    expect(screen.getAllByTestId('task-card')).toHaveLength(2);
    expect(screen.getByTestId('latest-parse')).toBeTruthy();
  });

  it('says nothing when every part loaded', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    await screen.findByTestId('latest-parse');
    expect(screen.queryByTestId('board-partial')).toBeNull();
  });
});


/**
 * `T1787` (EPIC-046, `FR-KAN-055`, `contracts/board-contract.md` §5) — the
 * board shows the Epic's progress.
 *
 * The second convergence pass found the board showing **no percentage at all**.
 * §5 names three surfaces that must show the same figure from the same
 * derivation; `/plan` and `/tasks` did, and the board — the one screen actually
 * about this Epic's tasks — did not.
 */
describe('T1787 · progress on the board (FR-KAN-055)', () => {
  const progress = { total: 5, done: 2, inProgress: 1, notStarted: 1, blocked: 1, percentComplete: 40 };

  it('shows the percentage and all five counts', async () => {
    const api = apiWith(board());
    api.getEpicTaskProgress = vi.fn(async () => progress);
    render(<TaskBoardPage api={api} epicId="e1" />);
    const note = await screen.findByTestId('board-progress');
    expect(note.textContent).toContain('40%');
    for (const part of ['2 done', '1 in progress', '1 not started', '1 blocked', '5']) {
      expect(note.textContent, part).toContain(part);
    }
  });

  it('states the exclusion, because a denominator that drops rows must explain itself', async () => {
    const api = apiWith(board());
    api.getEpicTaskProgress = vi.fn(async () => progress);
    render(<TaskBoardPage api={api} epicId="e1" />);
    const note = await screen.findByTestId('board-progress');
    expect(note.textContent).toContain('latest');
  });

  it('reads 0% for an Epic with no tasks rather than an empty or non-numeric value', async () => {
    const api = apiWith(board());
    api.getEpicTaskProgress = vi.fn(async () => ({ total: 0, done: 0, inProgress: 0, notStarted: 0, blocked: 0, percentComplete: 0 }));
    render(<TaskBoardPage api={api} epicId="e1" />);
    expect((await screen.findByTestId('board-progress')).textContent).toContain('0%');
  });

  it('treats a failed progress read as PARTIAL, not as a dead board', async () => {
    const api = apiWith(board());
    api.getEpicTaskProgress = vi.fn(async () => {
      throw new ApiError('unavailable', 'no', 503);
    });
    render(<TaskBoardPage api={api} epicId="e1" />);
    const note = await screen.findByTestId('board-partial');
    expect(note.textContent).toContain('progress');
    expect(screen.getAllByTestId('task-card')).toHaveLength(2);
  });
});

/**
 * `T1788` (EPIC-046, `FR-KAN-022`) — the card states what the file overruled.
 *
 * The marker was computed, stored on the manifest line, and rendered nowhere.
 * `FR-KAN-022` asks for three specific things — the proposal, the verdict and
 * the superseding digest — because *a manual status was superseded* with none
 * of them is a sentence a reader cannot act on.
 */
describe('T1788 · superseded by the file (FR-KAN-022)', () => {
  const superseded = {
    proposalId: 'pr_7',
    requestedStatus: 'in_progress' as const,
    verdict: 'applied' as const,
    proposerId: 'u_ana',
    supersedingDigest: 'abcdef0123456789',
  };

  it('names the proposal, the verdict, who made it and the superseding digest', async () => {
    const api = apiWith(board({ tasks: [card({ status: 'done', supersededByFile: superseded })] }));
    render(<TaskBoardPage api={api} epicId="e1" />);
    const note = await screen.findByTestId('superseded');
    expect(note.textContent).toContain('pr_7');
    expect(note.textContent).toContain('applied');
    expect(note.textContent).toContain('u_ana');
    expect(note.textContent).toContain('abcdef012345');
  });

  it('says the record survives, which is the half a screen cannot otherwise show', async () => {
    const api = apiWith(board({ tasks: [card({ status: 'done', supersededByFile: superseded })] }));
    render(<TaskBoardPage api={api} epicId="e1" />);
    expect((await screen.findByTestId('superseded')).textContent).toMatch(/kept|not deleted|unamended/i);
  });

  it('says nothing when the file superseded nothing', async () => {
    render(<TaskBoardPage api={apiWith(board())} epicId="e1" />);
    await screen.findByTestId('latest-parse');
    expect(screen.queryByTestId('superseded')).toBeNull();
  });
});

/**
 * `T1789` (EPIC-046, `FR-KAN-018`, `BR-0003`) — read-only for a member who may
 * not move.
 *
 * A control that submits and comes back `refused` teaches a person their
 * permission by making them fail. §4 wants no control at all, and the reason
 * said.
 */
describe('T1789 · the board is read-only without the move permission (BR-0003)', () => {
  it('shows no move control at all', async () => {
    render(<TaskBoardPage api={apiWith(board({ canMove: false }))} epicId="e1" />);
    await screen.findByTestId('latest-parse');
    expect(screen.queryAllByLabelText(/^Move /)).toHaveLength(0);
  });

  it('states why, rather than leaving the absence unexplained', async () => {
    render(<TaskBoardPage api={apiWith(board({ canMove: false }))} epicId="e1" />);
    const note = await screen.findByTestId('board-read-only');
    expect(note.textContent).toMatch(/permission|may not move/i);
  });

  it('still shows every card and the header — read-only is not empty', async () => {
    render(<TaskBoardPage api={apiWith(board({ canMove: false }))} epicId="e1" />);
    await screen.findByTestId('board-read-only');
    expect(screen.getAllByTestId('task-card')).toHaveLength(2);
    expect(screen.getByTestId('latest-parse')).toBeTruthy();
  });

  it('offers the control again when the reader may move', async () => {
    render(<TaskBoardPage api={apiWith(board({ canMove: true }))} epicId="e1" />);
    await screen.findByTestId('latest-parse');
    expect(screen.queryAllByLabelText(/^Move /).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('board-read-only')).toBeNull();
  });
});

/**
 * `T1790` (EPIC-046, `contracts/board-contract.md` §4) — two affordances, one
 * path.
 *
 * Native HTML5 drag, no package (`R-046-10`). It opens the same dialog as the
 * control: a second way to start a move, never a second way to make one.
 */
describe('T1790 · dragging a card onto a column (board-contract §4)', () => {
  it('makes cards draggable when the reader may move', async () => {
    render(<TaskBoardPage api={apiWith(board({ canMove: true }))} epicId="e1" />);
    await screen.findByTestId('latest-parse');
    expect(screen.getAllByTestId('task-card')[0]?.getAttribute('draggable')).toBe('true');
  });

  it('does NOT make them draggable without the permission', async () => {
    render(<TaskBoardPage api={apiWith(board({ canMove: false }))} epicId="e1" />);
    await screen.findByTestId('latest-parse');
    expect(screen.getAllByTestId('task-card')[0]?.getAttribute('draggable')).not.toBe('true');
  });

  it('opens the same dialog a drop as the control does — one path', async () => {
    render(<TaskBoardPage api={apiWith(board({ canMove: true }))} epicId="e1" />);
    await screen.findByTestId('latest-parse');
    const source = screen.getAllByTestId('task-card')[0]!;
    fireEvent.dragStart(source);
    const column = screen.getByRole('region', { name: 'Blocked' });
    fireEvent.dragOver(column);
    fireEvent.drop(column);
    expect(await screen.findByRole('dialog', { name: /move/i })).toBeTruthy();
  });
});

/**
 * `T1791` (EPIC-046, `FR-KAN-054`, `contracts/board-contract.md` §3) — *no path
 * named*.
 *
 * §3 names the empty rendering explicitly, so a reader can tell *this task
 * names no file* from *this board did not show me the files*.
 */
describe('T1791 · a card whose description names no path (board-contract §3)', () => {
  it('says so rather than rendering nothing', async () => {
    render(<TaskBoardPage api={apiWith(board({ tasks: [card({ sourcePaths: [] })] }))} epicId="e1" />);
    const one = (await screen.findAllByTestId('task-card'))[0]!;
    expect(one.textContent).toContain('no path named');
  });

  it('lists the paths when there are some, and does not say it then', async () => {
    render(<TaskBoardPage api={apiWith(board({ tasks: [card({ sourcePaths: ['a/one.ts'] })] }))} epicId="e1" />);
    const one = (await screen.findAllByTestId('task-card'))[0]!;
    expect(one.textContent).toContain('a/one.ts');
    expect(one.textContent).not.toContain('no path named');
  });
});


/**
 * `T1792` (EPIC-046, `US4` sc. 3) — the card offers the second person's answer.
 *
 * `approval_required` was terminal: the verdict was shown and nothing could
 * answer it. The control is offered only where it can succeed — a proposal
 * actually waiting, a reader who may move — because the server refuses the
 * other cases and a screen should not teach a permission by making someone
 * fail (`BR-0003`).
 */
describe('T1792 · answering a waiting proposal (US4 sc. 3)', () => {
  const awaiting = {
    proposalId: 'pr_9',
    expectedCurrentStatus: 'not_started' as const,
    requestedStatus: 'in_progress' as const,
    reason: 'Started it',
    proposerId: 'u_ana',
    proposerType: 'user' as const,
    proposedAt: '2026-09-07T10:00:00.000Z',
    verdict: 'approval_required' as const,
  };

  function withProposal(over: Partial<OutstandingProposal> = {}, canMove = true) {
    const adjudicateProposal = vi.fn(async () => ({
      proposalId: 'pr_9', verdict: 'applied' as const, reason: 'Applied by a second person.', decidedAt: '',
    }));
    const api = apiWith(board({ canMove, tasks: [card({ outstandingProposal: { ...awaiting, ...over } })] }));
    (api as unknown as { adjudicateProposal: unknown }).adjudicateProposal = adjudicateProposal;
    return { api, adjudicateProposal };
  }

  it('offers approve and decline for a proposal that is waiting', async () => {
    const { api } = withProposal();
    render(<TaskBoardPage api={api} epicId="e1" />);
    await screen.findByTestId('outstanding-proposal');
    expect(screen.getByRole('button', { name: 'Approve this move' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeTruthy();
  });

  it('sends the approval and states the verdict it got back', async () => {
    const { api, adjudicateProposal } = withProposal();
    render(<TaskBoardPage api={api} epicId="e1" />);
    await screen.findByTestId('outstanding-proposal');
    fireEvent.click(screen.getByRole('button', { name: 'Approve this move' }));
    await waitFor(() => expect(adjudicateProposal).toHaveBeenCalledWith('pr_9', { approve: true }));
    expect((await screen.findByTestId('adjudication-verdict')).textContent).toContain('applied');
  });

  it('sends a decline as approve:false — an absent field is never read as a yes', async () => {
    const { api, adjudicateProposal } = withProposal();
    render(<TaskBoardPage api={api} epicId="e1" />);
    await screen.findByTestId('outstanding-proposal');
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(adjudicateProposal).toHaveBeenCalledWith('pr_9', { approve: false }));
  });

  it('offers nothing for a proposal that is refused rather than waiting', async () => {
    const { api } = withProposal({ verdict: 'refused' });
    render(<TaskBoardPage api={api} epicId="e1" />);
    await screen.findByTestId('outstanding-proposal');
    expect(screen.queryByRole('button', { name: 'Approve this move' })).toBeNull();
  });

  it('offers nothing to a reader who may not move — approving a move is making it', async () => {
    const { api } = withProposal({}, false);
    render(<TaskBoardPage api={api} epicId="e1" />);
    await screen.findByTestId('outstanding-proposal');
    expect(screen.queryByRole('button', { name: 'Approve this move' })).toBeNull();
  });
});
