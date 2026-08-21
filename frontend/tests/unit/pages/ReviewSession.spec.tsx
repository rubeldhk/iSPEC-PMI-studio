/**
 * T397 — the review session view: questions, options, suggested answers,
 * conflicts — and a 20-question session answerable and submittable WITHOUT
 * navigating away from the review (SC-003).
 *
 * Written to FAIL before T398 exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReviewSessionPage } from '../../../src/pages/ReviewSession';
import type { ApiClient, ReviewQuestion, ReviewSession } from '../../../src/services/api';

function question(i: number, overrides: Partial<ReviewQuestion> = {}): ReviewQuestion {
  return {
    id: `q_${i}`,
    context: `Question ${i}: which option should the specification take?`,
    optionsConsidered: ['option-a', 'option-b'],
    suggestedAnswer: 'option-a',
    restricted: false,
    answers: [],
    ...overrides,
  };
}

function session(questions: ReviewQuestion[], state: 'open' | 'submitted' = 'open'): ReviewSession {
  return {
    id: 'rs_1',
    runId: 'run_1',
    state,
    openedAt: '2026-08-21T09:00:00Z',
    submittedAt: state === 'submitted' ? '2026-08-21T10:00:00Z' : null,
    questions,
  };
}

function api(current: ReviewSession): ApiClient {
  return {
    getRunReview: vi.fn(async () => current),
    saveDraftAnswer: vi.fn(async () => ({
      id: 'ans_x', questionId: 'q_1', value: 'option-a', authorId: 'me',
      recordedAt: '2026-08-21T09:10:00Z', note: null, state: 'draft' as const,
      conflict: false, selectedAsWinner: false,
    })),
    submitReviewSession: vi.fn(async () => session(current.questions, 'submitted')),
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('ReviewSessionPage (US2)', () => {
  it('shows every question with context, options and the suggested answer', async () => {
    const client = api(session([question(1), question(2)]));
    render(<ReviewSessionPage api={client} runId="run_1" />);
    expect(await screen.findByText(/Question 1:/)).toBeDefined();
    expect(screen.getByText(/Question 2:/)).toBeDefined();
    expect(screen.getAllByText('option-a, option-b')).toHaveLength(2);
    expect(screen.getAllByText('option-a')).toHaveLength(2);
  });

  it('surfaces a conflict on the question it belongs to', async () => {
    const conflicted = question(1, {
      answers: [
        { id: 'a1', questionId: 'q_1', value: 'x', authorId: 'u1', recordedAt: 't', note: null, state: 'draft', conflict: true, selectedAsWinner: false },
        { id: 'a2', questionId: 'q_1', value: 'y', authorId: 'u2', recordedAt: 't', note: null, state: 'draft', conflict: true, selectedAsWinner: false },
      ],
    });
    render(<ReviewSessionPage api={api(session([conflicted, question(2)]))} runId="run_1" />);
    expect(await screen.findByRole('status')).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain('Conflict');
  });

  it('a 20-question session is answerable and submittable without navigating away (SC-003)', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => question(i + 1));
    const client = api(session(twenty));
    render(<ReviewSessionPage api={client} runId="run_1" />);
    await screen.findByText(/Question 20:/);

    // All 20 questions are on THIS page…
    expect(screen.getAllByText(/which option should the specification take/)).toHaveLength(20);

    // …every one is answerable here…
    const useSuggested = screen.getAllByRole('button', { name: 'Use suggested' });
    expect(useSuggested).toHaveLength(20);
    for (const button of useSuggested) fireEvent.click(button);
    await waitFor(() => expect(client.saveDraftAnswer).toHaveBeenCalledTimes(20));

    // …and the batch submits from the same page. No navigation happened:
    // the component was never unmounted or re-routed.
    fireEvent.click(screen.getByRole('button', { name: 'Submit all answers' }));
    await waitFor(() => expect(client.submitReviewSession).toHaveBeenCalledWith('rs_1'));
    expect(await screen.findByText('· submitted')).toBeDefined();
  });

  it('a submitted session is read-only — the record, not a form', async () => {
    const answered = question(1, {
      answers: [{ id: 'a1', questionId: 'q_1', value: 'kept', authorId: 'u1', recordedAt: 't', note: 'why', state: 'committed', conflict: false, selectedAsWinner: false }],
    });
    render(<ReviewSessionPage api={api(session([answered], 'submitted'))} runId="run_1" />);
    await screen.findByText(/Question 1:/);
    expect(screen.getByRole('button', { name: 'Submit all answers' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Use suggested' })).toHaveProperty('disabled', true);
    // The permanent record shows the answer with author and note (SC-006).
    expect(screen.getByText('kept')).toBeDefined();
    expect(screen.getByText('u1')).toBeDefined();
    expect(screen.getByText('(why)')).toBeDefined();
  });

  it('shows a restricted question as restricted rather than omitting it', async () => {
    const restricted = question(1, { restricted: true });
    render(<ReviewSessionPage api={api(session([restricted]))} runId="run_1" />);
    expect(await screen.findByRole('note')).toBeDefined();
    expect(screen.getByRole('note').textContent).toContain('Restricted');
  });
});
