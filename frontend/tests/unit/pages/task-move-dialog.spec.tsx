/**
 * `T1747` (EPIC-046, `FR-KAN-011`, `FR-KAN-014`, `FR-KAN-018`) — the move
 * dialog.
 *
 * Two assertions carry the weight:
 *
 *  - **the reason is required.** `FR-KAN-011` refuses a move without one before
 *    a proposal exists, so a dialog that let one through would produce a refusal
 *    the user could not have anticipated.
 *  - **it says which side is authoritative.** `FR-KAN-018`. A reader cannot infer
 *    from an absent Edit button that the directory owns the file — absence looks
 *    like an oversight, so the dialog states it.
 *
 * Written to FAIL before `T1748`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TaskMoveDialog } from '../../../src/components/TaskMoveDialog';
import type { TaskBoardCard } from '../../../src/services/api';

function card(over: Partial<TaskBoardCard> = {}): TaskBoardCard {
  return {
    id: 't1',
    taskKey: 'T1701',
    description: 'Write the failing test',
    status: 'not_started',
    parallel: false,
    sourceLine: 3,
    sourcePaths: [],
    movedBy: 'parse',
    movedAt: null,
    movedByActorId: null,
    notInLatestParse: false,
    outstandingProposal: null,
    supersededByFile: null,
    ...over,
  };
}

afterEach(cleanup);

describe('T1747 · the reason is required (FR-KAN-011)', () => {
  it('disables the submit until a reason is given', () => {
    render(<TaskMoveDialog task={card()} requestedStatus="in_progress" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    // jest-dom is not installed here, so the attribute is asserted directly.
    const submit = screen.getByRole('button', { name: 'Propose the move' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Started it this morning' } });
    expect(submit.disabled).toBe(false);
  });

  it('does not submit whitespace, and says so', () => {
    const onSubmit = vi.fn();
    render(<TaskMoveDialog task={card()} requestedStatus="in_progress" onCancel={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: '   ' } });
    fireEvent.blur(screen.getByLabelText('Reason'));
    expect(screen.getByRole('alert').textContent).toContain('A reason is required');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('passes the trimmed reason on submit', () => {
    const onSubmit = vi.fn();
    render(<TaskMoveDialog task={card()} requestedStatus="blocked" onCancel={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: '  Waiting on an answer  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Propose the move' }));
    expect(onSubmit).toHaveBeenCalledWith('Waiting on an answer');
  });
});

describe('T1747 · it states which side is authoritative (FR-KAN-018)', () => {
  it('says the directory owns the file and this is a proposal about the record', () => {
    render(<TaskMoveDialog task={card()} requestedStatus="in_progress" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText(/project directory is authoritative/)).toBeTruthy();
    expect(screen.getByText(/proposal about the record/)).toBeTruthy();
    expect(screen.getByText(/the file is not changed/)).toBeTruthy();
  });

  it('names the task and the status being requested', () => {
    render(<TaskMoveDialog task={card()} requestedStatus="blocked" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Move T1701 to Blocked' })).toBeTruthy();
  });
});

describe('T1747 · a verdict is never silent (FR-KAN-015)', () => {
  it('shows a refusal and its reason when one is supplied', () => {
    render(
      <TaskMoveDialog
        task={card()}
        requestedStatus="in_progress"
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        verdict={{ verdict: 'inconsistent', reason: 'The task had moved to done before this proposal was adjudicated.' }}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('inconsistent');
    expect(alert.textContent).toContain('had moved to done');
  });

  it('shows no alert when there is no verdict to show', () => {
    render(<TaskMoveDialog task={card()} requestedStatus="in_progress" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('T1747 · nothing here edits a file (FR-KAN-010)', () => {
  it('offers no edit, save, upload, rename or delete control', () => {
    render(<TaskMoveDialog task={card()} requestedStatus="in_progress" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    for (const label of [/^edit/i, /^save/i, /upload/i, /rename/i, /delete/i]) {
      expect(screen.queryByRole('button', { name: label }), String(label)).toBeNull();
    }
    // Exactly two buttons: propose, and cancel.
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('cancels without proposing anything', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(<TaskMoveDialog task={card()} requestedStatus="in_progress" onCancel={onCancel} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
