/**
 * `T1717` (EPIC-046, `contracts/board-contract.md`) — the Task Kanban.
 *
 * ## It is honest before it is clever
 *
 * The header says what the board is a view *of* — the execution, the digest and
 * the time of the latest parse, and the counts. A board without that provenance
 * is a list of assertions, and `SC-KAN-001`'s arithmetic
 * (`considered = parsed + refused + duplicates`) is checkable by eye precisely
 * so a reader can tell the board is the whole file and not a convenient subset.
 *
 * ## Refused lines are shown, not swallowed
 *
 * `FR-KAN-003`, `contracts/board-contract.md` §2a. A line the grammar could not
 * read is listed with its number, its text and its coded reason. Dropping it
 * would make the board *look* cleaner and be less true, which is the trade this
 * Epic exists to refuse.
 *
 * ## Two empty states, deliberately different
 *
 * *No `tasks.md` synced yet* and *the synced `tasks.md` contains no task lines*
 * are not the same fact, and a reader who cannot tell them apart does not know
 * whether to run `/speckit-tasks` or to look at the file (`US1` scenario 5).
 *
 * ## Movement is observed, not pushed
 *
 * `FR-KAN-046`, `R-07`. There is no live transport, and the board says so
 * rather than letting a reader assume one. It reflects state on load.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  ApiError,
  type ApiClient,
  type Progress,
  type TaskBoard as TaskBoardView,
  type TaskBoardCard,
  type TaskBoardStatus,
  type TaskDisagreements,
  type TaskProposalOutcome,
} from '../services/api';
import { Button } from '../design/components/Button';
import { LoadingIndicator } from '../design/components/LoadingIndicator';
import { TaskMoveDialog } from '../components/TaskMoveDialog';

function message(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

function when(at: string | null): string {
  if (at === null) return '';
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? at : date.toLocaleString();
}

function shortDigest(digest: string): string {
  return digest.slice(0, 12);
}

/** A status in the words the columns use, so one card cannot name it differently. */
const STATUS_LABEL: Readonly<Record<TaskBoardStatus, string>> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
};

/** The column order of `contracts/board-contract.md` §3, with its labels. */
const COLUMNS: ReadonlyArray<{ status: TaskBoardStatus; label: string }> = [
  { status: 'not_started', label: 'Not started' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
  { status: 'blocked', label: 'Blocked' },
];

/**
 * What an outstanding proposal MEANS, in words (`FR-KAN-015`).
 *
 * The verdict name is `EPIC-030`'s vocabulary and belongs in the record; what a
 * person needs on a card is what it means for them. Both are shown — the
 * sentence to read, the name to quote in a support conversation.
 */
const VERDICT_MEANS: Readonly<Record<string, string>> = {
  approval_required: 'waiting for a second person to approve',
  refused: 'refused',
  inconsistent: 'not applied — the task had already moved',
  reconciliation_required: 'needs reconciliation before it can apply',
  validated: 'checked, not yet applied',
};

/** What last moved a card, in words a reader does not have to decode. */
const MOVED_BY: Readonly<Record<TaskBoardCard['movedBy'], string>> = {
  parse: 'the file',
  event: 'an implement event',
  proposal: 'a proposal',
  engine: 'generation',
};

export interface TaskBoardProps {
  readonly api: ApiClient;
  readonly epicId: string;
}

export function TaskBoardPage({ api, epicId }: TaskBoardProps): ReactElement {
  const [board, setBoard] = useState<TaskBoardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [onlyParallel, setOnlyParallel] = useState(false);
  const [onlyMarked, setOnlyMarked] = useState(false);
  const [moving, setMoving] = useState<{ task: TaskBoardCard; to: TaskBoardStatus } | null>(null);
  const [verdict, setVerdict] = useState<TaskProposalOutcome | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState<TaskDisagreements | null>(null);
  // `T1786` (`FR-KAN-059`): which part could not be read. Null means every
  // part loaded — a board that is partial and does not say so is a board
  // that looks complete and is not.
  const [partial, setPartial] = useState<string | null>(null);
  const [onlyAhead, setOnlyAhead] = useState(false);
  // `T1787` (`FR-KAN-055`): the Epic's own progress, read beside the board.
  // Its own request, so a slow or failed count never delays or blanks the cards.
  const [progress, setProgress] = useState<Progress | null>(null);
  // `T1790`: the card a drag started on. Nothing is applied on drop — the
  // dialog opens, exactly as the control opens it. Two affordances, one path.
  const [dragging, setDragging] = useState<TaskBoardCard | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setPartial(null);
    void api
      .getEpicTaskProgress(epicId)
      .then((answer) => {
        if (live) setProgress(answer);
      })
      .catch(() => {
        if (live) {
          setProgress(null);
          setPartial((held) => (held === null ? 'the progress figures' : `${held} and the progress figures`));
        }
      });
    // The disagreements are their own read: a reviewer asking what the board
    // does not know should not have to fetch every card, and a failure of it
    // must not blank the board (`FR-SHL-060`'s partial state).
    void api
      .getTaskDisagreements(epicId)
      .then((answer) => {
        if (live) setOpen(answer);
      })
      .catch(() => {
        if (live) {
          setOpen(null);
          setPartial((held) => (held === null ? 'the open disagreements' : `${held} and the open disagreements`));
        }
      });
    api
      .getEpicTasks(epicId)
      .then((answer) => {
        if (live) setBoard(answer);
      })
      .catch((err: unknown) => {
        if (live) setError(message(err));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return (): void => {
      live = false;
    };
  }, [api, epicId, reload]);

  /**
   * A second person's answer (`US4` sc. 3, `T1792`).
   *
   * The board is re-read rather than patched: the verdict decides where the
   * card goes, and guessing it here is how a screen starts disagreeing with the
   * server. The answer is stated verbatim, refusals included.
   */
  const decide = async (proposalId: string, approve: boolean): Promise<void> => {
    setVerdict(null);
    try {
      const outcome = await api.adjudicateProposal(proposalId, { approve });
      setVerdict(outcome);
    } catch (err) {
      setError(message(err));
      return;
    }
    setReload((n) => n + 1);
  };

  const visible = useMemo(() => {
    const text = filter.trim().toLowerCase();
    return (board?.tasks ?? []).filter((t) => {
      if (onlyParallel && !t.parallel) return false;
      if (onlyMarked && !t.notInLatestParse) return false;
      // `FR-KAN-053`'s fourth axis: the cards the file cannot confirm — a status
      // a person set that a checkbox has no way to express.
      if (onlyAhead && !(t.movedBy === 'proposal' && (t.status === 'in_progress' || t.status === 'blocked'))) return false;
      if (text === '') return true;
      return (t.taskKey ?? '').toLowerCase().includes(text) || t.description.toLowerCase().includes(text);
    });
  }, [board, filter, onlyParallel, onlyMarked, onlyAhead]);

  const counts = board?.counts ?? { linesConsidered: 0, parsed: 0, refused: 0, duplicates: 0 };
  // Two different facts: nothing synced, versus a file that carried no tasks.
  const neverSynced = board !== null && board.latestParse === null;
  const syncedButEmpty = board !== null && board.latestParse !== null && counts.linesConsidered === 0;

  return (
    <section className="ds-stack" aria-label="Task board">
      <h2>Tasks</h2>

      {loading && <LoadingIndicator label="Loading the task board" />}

      {error !== null && (
        <p className="ds-field__error" role="alert">
          {error} The Epic&apos;s other sections are unaffected; try again, or read <code>tasks.md</code> in the project directory.
        </p>
      )}

      {!loading && error === null && board !== null && (
        <>
          <p className="ds-field__hint">
            These tasks are parsed from the Epic&apos;s <code>tasks.md</code>. The project directory is authoritative for what is done;
            PMI Studio mirrors it and records the proposals and verdicts nothing else keeps. Movement is observed on sync and on
            event, not pushed live.
          </p>

          {board.latestParse !== null && (
            <p className="ds-field__hint" data-testid="latest-parse">
              Latest parse · execution <code>{board.latestParse.executionId}</code> ·{' '}
              <code title={board.latestParse.digest}>{shortDigest(board.latestParse.digest)}</code> · {when(board.latestParse.syncedAt)} ·{' '}
              {counts.linesConsidered} considered = {counts.parsed} parsed + {counts.refused} refused + {counts.duplicates} duplicate
            </p>
          )}

          {verdict !== null && moving === null && (
            <p className="ds-field__hint" role="status" data-testid="adjudication-verdict">
              Verdict · <code>{verdict.verdict}</code> — {verdict.reason}
            </p>
          )}

          {partial !== null && (
            <p className="ds-field__hint" role="status" data-testid="board-partial">
              Part of this board could not be read: <strong>{partial}</strong>. Everything else here loaded and is
              current — reload to try again. A board that is partial and does not say so is a board that looks
              complete and is not.
            </p>
          )}

          {progress !== null && (
            <p className="ds-field__hint" data-testid="board-progress">
              Progress · <strong>{progress.percentComplete}%</strong> — {progress.done} done · {progress.inProgress} in
              progress · {progress.notStarted} not started · {progress.blocked} blocked, of {progress.total}. Tasks the
              latest parse no longer contains are excluded from the total.
            </p>
          )}

          {!board.canMove && (
            <p className="ds-field__hint" role="status" data-testid="board-read-only">
              You do not hold the permission to move a task in this project, so this board is read-only. Everything here
              is visible; the move control is not shown rather than offered and refused.
            </p>
          )}

          {board.staleness !== null && (
            <p className="ds-field__hint" role="status" data-testid="board-stale">
              This board is behind the Epic. Its latest parse is {when(board.staleness.parsedAt)}; the Epic&apos;s latest run
              — <code>{board.staleness.command}</code>, execution <code>{board.staleness.executionId}</code> — is
              {' '}{when(board.staleness.executionAt)}. A run recorded while PMI Studio was unreachable syncs no tasks, so
              nothing here has been guessed from it. The next governed command&apos;s sync brings the board level.
            </p>
          )}

          {board.latestParse?.command !== null && board.latestParse !== null && (
            <p className="ds-field__hint" data-testid="latest-run">
              Run · {board.latestParse.command}
              {board.latestParse.outcome !== null && <> · {board.latestParse.outcome}</>} · {board.remainingUnchecked} task
              {board.remainingUnchecked === 1 ? '' : 's'} still unchecked in the file it synced
            </p>
          )}

          {board.unmatchedProgress.length > 0 && (
            <section className="ds-stack" aria-label="Unmatched progress reports">
              <h3>Unmatched progress reports ({board.unmatchedProgress.length})</h3>
              <p className="ds-field__hint">
                A run reported progress for an identifier no task carries. Nothing was created from it — it is listed here, and
                matched if that identifier is ever parsed.
              </p>
              <ul className="ds-list">
                {board.unmatchedProgress.map((u) => (
                  <li key={`${u.executionId}-${u.taskId}`} data-testid="unmatched-progress">
                    <code>{u.taskId}</code> · execution <code>{u.executionId}</code> · {when(u.occurredAt)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {board.outOfBandEdit && (
            <p className="ds-field__hint" role="status">
              The file changed outside a governed command since the previous sync. The content is accepted — the file is
              authoritative — and the change is recorded here rather than resolved.
            </p>
          )}

          {neverSynced && (
            <p className="ds-field__hint">
              No <code>tasks.md</code> has been synced for this Epic yet. Running <code>/speckit-tasks</code> produces the first one.
            </p>
          )}

          {syncedButEmpty && (
            <p className="ds-field__hint">
              The synced <code>tasks.md</code> contains no task lines (digest <code>{shortDigest(board.latestParse?.digest ?? '')}</code>).
            </p>
          )}

          <div className="ds-stack" role="search">
            <label className="ds-field">
              <span className="ds-field__label">Filter tasks</span>
              <input className="ds-field__input" type="search" value={filter} onChange={(e): void => setFilter(e.target.value)} />
            </label>
            <label className="ds-field">
              <input type="checkbox" checked={onlyParallel} onChange={(e): void => setOnlyParallel(e.target.checked)} />
              <span className="ds-field__label">Parallel-safe only</span>
            </label>
            <label className="ds-field">
              <input type="checkbox" checked={onlyMarked} onChange={(e): void => setOnlyMarked(e.target.checked)} />
              <span className="ds-field__label">Not in the latest parse only</span>
            </label>
            <label className="ds-field">
              <input type="checkbox" checked={onlyAhead} onChange={(e): void => setOnlyAhead(e.target.checked)} />
              <span className="ds-field__label">Ahead of the file only</span>
            </label>
          </div>

          <div className="ds-columns">
            {COLUMNS.map((column) => {
              const cards = visible.filter((t) => t.status === column.status);
              return (
                <section
                  key={column.status}
                  className="ds-stack"
                  aria-label={column.label}
                  data-status={column.status}
                  onDragOver={(e): void => {
                    if (board.canMove && dragging !== null) e.preventDefault();
                  }}
                  onDrop={(e): void => {
                    e.preventDefault();
                    // The SAME dialog the control opens. A drop starts a move; it
                    // never makes one, so there is one path to a proposal and one
                    // place the reason is required (`FR-KAN-011`).
                    if (!board.canMove || dragging === null || dragging.status === column.status) return;
                    setVerdict(null);
                    setMoving({ task: dragging, to: column.status });
                    setDragging(null);
                  }}
                >
                  <h3>
                    {column.label} <span className="ds-field__hint">({cards.length})</span>
                  </h3>
                  {cards.length === 0 && <p className="ds-field__hint">Nothing here.</p>}
                  <ul className="ds-list">
                    {cards.map((t) => (
                      <li
                        key={t.id}
                        data-testid="task-card"
                        // `contracts/board-contract.md` §4 — native HTML5 drag as the
                        // ENHANCEMENT beside the keyboard-operable control (`BR-0193`).
                        // No package: `R-046-10` forbade one and none is needed.
                        {...(board.canMove ? { draggable: true } : {})}
                        onDragStart={(): void => setDragging(t)}
                        onDragEnd={(): void => setDragging(null)}
                      >
                        <strong>{t.taskKey ?? '(generated)'}</strong>
                        {t.parallel && <span className="ds-field__hint"> [P]</span>} — {t.description}
                        <div className="ds-field__hint">
                          {t.sourceLine !== null && <>line {t.sourceLine} · </>}
                          moved by {MOVED_BY[t.movedBy]}
                          {t.movedAt !== null && <> · {when(t.movedAt)}</>}
                          {t.movedByActorId !== null && <> · {t.movedByActorId}</>}
                        </div>
                        <div className="ds-field__hint">
                          {/*
                            `contracts/board-contract.md` §3 names the empty rendering, so a
                            reader can tell *this task names no file* from *this board did not
                            show me the files*.
                          */}
                          {t.sourcePaths.length === 0 ? (
                            <em>no path named</em>
                          ) : (
                            t.sourcePaths.map((p) => <code key={p}>{p}</code>)
                          )}
                        </div>
                        {t.notInLatestParse && <div className="ds-field__hint">not in the latest parse</div>}
                        {t.movedBy === 'proposal' && (t.status === 'in_progress' || t.status === 'blocked') && (
                          <div className="ds-field__hint">ahead of the file — a checkbox cannot say this</div>
                        )}
                        {/*
                          `FR-KAN-014`/`FR-KAN-015`. A proposal that did not apply left the card
                          where it was, and the card must say so — the dialog cannot, because it
                          closes. Requested status, requester, reason, time and verdict, all of it,
                          because a reader coming back tomorrow has seen none of them.
                        */}
                        {/*
                          `FR-KAN-022`. The file overruled a manual status, and the card names
                          the three things the requirement asks for — the proposal, the verdict
                          and the parse that did it — because *a manual status was superseded*
                          with none of them is a sentence nobody can act on.
                        */}
                        {t.supersededByFile !== null && (
                          <div className="ds-field__hint" role="status" data-testid="superseded">
                            Superseded by the file: <code>{t.supersededByFile.proposalId}</code> proposed{' '}
                            <strong>{STATUS_LABEL[t.supersededByFile.requestedStatus]}</strong> by{' '}
                            {t.supersededByFile.proposerId} and was <code>{t.supersededByFile.verdict}</code>; the parse{' '}
                            <code title={t.supersededByFile.supersedingDigest}>
                              {shortDigest(t.supersededByFile.supersedingDigest)}
                            </code>{' '}
                            overrode it. The proposal record is kept, unamended.
                          </div>
                        )}
                        {t.outstandingProposal !== null && (
                          <div className="ds-field__hint" role="status" data-testid="outstanding-proposal">
                            Proposed <strong>{STATUS_LABEL[t.outstandingProposal.requestedStatus]}</strong> by{' '}
                            {t.outstandingProposal.proposerId} · {when(t.outstandingProposal.proposedAt)} —{' '}
                            {VERDICT_MEANS[t.outstandingProposal.verdict] ?? t.outstandingProposal.verdict} (
                            <code>{t.outstandingProposal.verdict}</code>). The card stays where it is.
                            <div>Reason given: {t.outstandingProposal.reason}</div>
                            {/*
                              `US4` sc. 3 — the thing that ends the waiting. Offered only for a
                              proposal actually awaiting approval, only to someone who may move,
                              and never to the proposer: the whole content of *requires an
                              approver* is that they are not it. The server refuses all three
                              cases regardless; the screen does not offer what it knows will be
                              refused (`BR-0003`).
                            */}
                            {t.outstandingProposal.verdict === 'approval_required' && board.canMove && (
                              <div className="ds-row">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={(): void => {
                                    void decide(t.outstandingProposal!.proposalId, true);
                                  }}
                                >
                                  Approve this move
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={(): void => {
                                    void decide(t.outstandingProposal!.proposalId, false);
                                  }}
                                >
                                  Decline
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {board.canMove && (
                        <label className="ds-field">
                          <span className="ds-visually-hidden">Move {t.taskKey ?? t.id} to</span>
                          <select
                            className="ds-field__input"
                            value={t.status}
                            onChange={(e): void => {
                              setVerdict(null);
                              setMoving({ task: t, to: e.target.value as TaskBoardStatus });
                            }}
                          >
                            {COLUMNS.map((c) => (
                              <option key={c.status} value={c.status}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          {moving !== null && (
            <TaskMoveDialog
              task={moving.task}
              requestedStatus={moving.to}
              {...(verdict !== null ? { verdict } : {})}
              onCancel={(): void => {
                setMoving(null);
                setVerdict(null);
              }}
              onSubmit={async (reason: string): Promise<void> => {
                const outcome = await api.proposeTaskStatus(moving.task.id, {
                  expectedCurrentStatus: moving.task.status,
                  requestedStatus: moving.to,
                  reason,
                });
                if (outcome.verdict === 'applied') {
                  // The card moved. Re-read rather than patching local state:
                  // the board is a projection, and guessing its new shape here
                  // is how a screen starts disagreeing with the server.
                  setMoving(null);
                  setVerdict(null);
                  setReload((n) => n + 1);
                  return;
                }
                // Refused, inconsistent or awaiting a second person — the
                // dialog stays open and says which (`FR-KAN-015`).
                setVerdict(outcome);
              }}
            />
          )}

          {open !== null && (
            <section className="ds-stack" aria-label="Open disagreements">
              <h3>Open disagreements ({open.total})</h3>
              {open.total === 0 ? (
                <p className="ds-field__hint">The board and the file agree.</p>
              ) : (
                <ul className="ds-list">
                  {open.aheadOfFile.map((d) => (
                    <li key={`ahead-${d.taskKey}`} data-testid="disagreement">
                      <code>{d.taskKey}</code> is <strong>{d.status}</strong> because a person said so; the file says only
                      whether it is done. The proposal stands until the file speaks.
                    </li>
                  ))}
                  {open.notInLatestParse.map((d) => (
                    <li key={`absent-${d.taskKey}`} data-testid="disagreement">
                      <code>{d.taskKey}</code> is not in the latest parse. It is kept and excluded from the percentage.
                    </li>
                  ))}
                  {open.unmatchedProgress.map((d) => (
                    <li key={`unmatched-${d.executionId}-${d.taskId}`} data-testid="disagreement">
                      A run reported progress for <code>{d.taskId}</code>, which no task carries. Nothing was created from it.
                    </li>
                  ))}
                  {open.refusedLines.map((d) => (
                    <li key={`refused-${d.line}`} data-testid="disagreement">
                      Line {d.line} was refused: {d.code}.
                    </li>
                  ))}
                  {open.outOfBandEdit && (
                    <li data-testid="disagreement">
                      The file changed with no governed command to account for it. The content was accepted — the file is
                      authoritative — and the change is recorded rather than resolved.
                    </li>
                  )}
                  {open.digestMismatch !== null && (
                    <li data-testid="disagreement">
                      The parse read <code>{shortDigest(open.digestMismatch.parsed)}</code> and the stored
                      <code> tasks.md</code> is <code>{shortDigest(open.digestMismatch.artifact)}</code>. Reported, not repaired.
                    </li>
                  )}
                </ul>
              )}
            </section>
          )}

          <section className="ds-stack" aria-label="Refused lines">
            <h3>Refused lines ({board.refusedLines.length})</h3>
            {board.refusedLines.length === 0 ? (
              <p className="ds-field__hint">Every task line of the latest parse was read.</p>
            ) : (
              <ul className="ds-list">
                {board.refusedLines.map((r) => (
                  <li key={`${r.line}-${r.code}`} data-testid="refused-line">
                    line {r.line} · {r.code} · <code>{r.text}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}
