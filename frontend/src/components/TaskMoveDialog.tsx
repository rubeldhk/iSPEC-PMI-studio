/**
 * `T1748` (EPIC-046, `FR-KAN-011`, `FR-KAN-014`, `FR-KAN-018`) — the move
 * dialog.
 *
 * ## The reason is required, and the dialog says why
 *
 * `FR-KAN-011`. A move with no reason is refused before a proposal exists, so
 * asking for one here is not politeness — it is the requirement, and the dialog
 * states what the reason is *for*: the file is authoritative for what is done,
 * and this move is a proposal about the record.
 *
 * ## It states which side is authoritative
 *
 * `FR-KAN-018`. A reader cannot infer from an absent Edit button that the
 * project directory owns the file; absence looks like an oversight. So the
 * dialog says it, in words, every time.
 *
 * ## One path, two affordances
 *
 * `contracts/board-contract.md` §4. The card's status control and a drag onto a
 * column both open this dialog, because both are the same governed act. There is
 * no drag-and-drop library: `BR-0193` requires the board be operable without a
 * pointer, so the keyboard path has to exist regardless, and once it does the
 * library is decoration (`R-046-10`).
 */
import { useState, type FormEvent, type ReactElement } from 'react';
import type { TaskBoardCard, TaskBoardStatus } from '../services/api';

const LABELS: Readonly<Record<TaskBoardStatus, string>> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
};

export interface TaskMoveDialogProps {
  readonly task: TaskBoardCard;
  readonly requestedStatus: TaskBoardStatus;
  readonly onCancel: () => void;
  readonly onSubmit: (reason: string) => Promise<void> | void;
  /** A verdict from a previous attempt, shown so a refusal is not silent. */
  readonly verdict?: { verdict: string; reason: string } | undefined;
}

export function TaskMoveDialog({ task, requestedStatus, onCancel, onSubmit, verdict }: TaskMoveDialogProps): ReactElement {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const empty = reason.trim().length === 0;

  function submit(event: FormEvent): void {
    event.preventDefault();
    setTouched(true);
    if (empty) return;
    void onSubmit(reason.trim());
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Move ${task.taskKey ?? 'task'} to ${LABELS[requestedStatus]}`} className="ds-stack">
      <h3>
        Move {task.taskKey ?? 'this task'} to {LABELS[requestedStatus]}
      </h3>

      <p className="ds-field__hint">
        The project directory is authoritative for what is done. This move is a <strong>proposal about the record</strong>, not an
        edit of <code>tasks.md</code> — the file is not changed.
      </p>

      {verdict !== undefined && (
        <p className="ds-field__error" role="alert">
          {verdict.verdict}: {verdict.reason}
        </p>
      )}

      <form onSubmit={submit} className="ds-stack">
        <label className="ds-field">
          <span className="ds-field__label">Reason</span>
          <textarea
            className="ds-field__input"
            value={reason}
            onChange={(e): void => setReason(e.target.value)}
            onBlur={(): void => setTouched(true)}
            aria-describedby="move-reason-hint"
            required
          />
        </label>
        <p id="move-reason-hint" className="ds-field__hint">
          Say what you know that the file does not — the reason is recorded with the proposal and its verdict.
        </p>
        {touched && empty && (
          <p className="ds-field__error" role="alert">
            A reason is required to move a task.
          </p>
        )}
        <div>
          <button type="submit" disabled={empty}>
            Propose the move
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
