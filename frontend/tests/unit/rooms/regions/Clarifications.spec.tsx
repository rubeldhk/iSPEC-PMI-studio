/**
 * `T1187` (EPIC-033 Phase 10) — the clarifications region.
 *
 * `FR-RQR-012` is specific in two ways that are easy to build wrong, so both are
 * asserted: the questions come **as one set**, and they are answerable **in
 * place**. `FR-RQR-013` adds the third — an answer is retained rather than
 * discarded once resolved.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Clarifications } from '../../../../src/rooms/regions/Clarifications';
import type { RoomClarification } from '../../../../src/services/api';

afterEach(cleanup);

const OPEN: RoomClarification = {
  id: 'q1',
  roomObjectId: 'ro_1',
  candidateId: null,
  question: 'What counts as a business day?',
  answer: null,
  answeredBy: null,
  blocksBaseline: true,
};

const ANSWERED: RoomClarification = {
  id: 'q2',
  roomObjectId: 'ro_1',
  candidateId: null,
  question: 'Which timezone applies?',
  answer: 'The workspace timezone.',
  answeredBy: 'u_1',
  blocksBaseline: false,
};

const props = (over: Partial<React.ComponentProps<typeof Clarifications>> = {}) => ({
  clarifications: [OPEN, ANSWERED],
  onAnswer: vi.fn().mockResolvedValue(undefined),
  ...over,
});

describe('T1187 · the whole set, not one at a time', () => {
  it('shows every question together', () => {
    // `FR-RQR-012` — one at a time hides how much is left and makes the set
    // impossible to reason about.
    render(<Clarifications {...props()} />);
    expect(screen.getByText(/business day/i)).toBeDefined();
    expect(screen.getByText(/timezone applies/i)).toBeDefined();
  });

  it('says how many are still open', () => {
    render(<Clarifications {...props()} />);
    expect(screen.getByText(/1 of 2 unanswered/i)).toBeDefined();
  });

  it('marks a blocking question as blocking', () => {
    render(<Clarifications {...props()} />);
    expect(screen.getByText(/blocks baseline/i)).toBeDefined();
  });

  it('renders an empty state', () => {
    render(<Clarifications {...props({ clarifications: [] })} />);
    expect(screen.getByText(/no questions raised yet/i)).toBeDefined();
  });
});

describe('T1187 · answerable in place, and retained', () => {
  it('sends the answer without leaving the region', async () => {
    const onAnswer = vi.fn().mockResolvedValue(undefined);
    render(<Clarifications {...props({ onAnswer })} />);

    fireEvent.change(screen.getByLabelText(/answer/i), {
      target: { value: 'Monday to Friday.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^answer$/i }));

    await waitFor(() => {
      expect(onAnswer).toHaveBeenCalledWith('q1', 'Monday to Friday.');
    });
  });

  it('keeps an answered question visible WITH its answer', () => {
    // `FR-RQR-013`. The trap is treating a resolved question as done and hiding
    // it: the answer is part of how the requirement got its meaning.
    render(<Clarifications {...props()} />);
    expect(screen.getByText(/timezone applies/i)).toBeDefined();
    expect(screen.getByText(/The workspace timezone\./)).toBeDefined();
  });

  it('offers no answer field for an already answered question', () => {
    render(<Clarifications {...props({ clarifications: [ANSWERED] })} />);
    expect(screen.queryByRole('button', { name: /^answer$/i })).toBeNull();
  });

  it('will not send an empty answer', () => {
    const onAnswer = vi.fn().mockResolvedValue(undefined);
    render(<Clarifications {...props({ onAnswer })} />);
    fireEvent.click(screen.getByRole('button', { name: /^answer$/i }));
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('uses native controls inside a form, so Enter answers', async () => {
    // `SC-RQR-008` — the keyboard half, asserted structurally.
    const onAnswer = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<Clarifications {...props({ onAnswer })} />);
    fireEvent.change(screen.getByLabelText(/answer/i), { target: { value: 'Yes.' } });
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    await waitFor(() => {
      expect(onAnswer).toHaveBeenCalled();
    });
  });
});
