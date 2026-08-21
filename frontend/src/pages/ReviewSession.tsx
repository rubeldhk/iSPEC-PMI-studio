/**
 * T398 — the review session page (EPIC-023 US2, SC-003).
 *
 * One collective decision session instead of a stop-start process: every
 * question with its context, options, and the engine's suggested answer, all
 * answerable and submittable on THIS page — a 20-question session never
 * forces the reviewer to navigate away (SC-003).
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type ReviewQuestion, type ReviewSession } from '../services/api';

export interface ReviewSessionPageProps {
  api: ApiClient;
  runId: string;
}

function QuestionCard({
  question,
  disabled,
  onAnswer,
}: {
  question: ReviewQuestion;
  disabled: boolean;
  onAnswer: (questionId: string, input: { value?: string; takeSuggested?: boolean; note?: string }) => void;
}): ReactElement {
  const [own, setOwn] = useState('');
  const [note, setNote] = useState('');
  const hasConflict = question.answers.some((a) => a.conflict && !a.selectedAsWinner) &&
    !question.answers.some((a) => a.selectedAsWinner);
  const drafted = question.answers.length > 0;

  return (
    <li aria-label={`Question ${question.id}`}>
      <p>{question.context}</p>
      {question.restricted && <p role="note">Restricted — concerns an artifact you cannot access.</p>}
      {hasConflict && <p role="status">Conflict — answers disagree and need resolution.</p>}
      <p>
        Options considered: <span>{question.optionsConsidered.join(', ')}</span>
      </p>
      <p>
        Suggested answer: <strong>{question.suggestedAnswer}</strong>
      </p>
      {drafted && (
        <ul aria-label="Recorded answers">
          {question.answers.map((a) => (
            <li key={a.id}>
              <span>{a.value}</span> — <span>{a.authorId}</span>
              {a.note !== null && <em> ({a.note})</em>}
              {a.selectedAsWinner && <span> ✓ selected</span>}
            </li>
          ))}
        </ul>
      )}
      <label>
        Your answer
        <input
          value={own}
          disabled={disabled}
          onChange={(e) => setOwn(e.target.value)}
        />
      </label>
      <label>
        Note
        <input value={note} disabled={disabled} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAnswer(question.id, { takeSuggested: true, ...(note ? { note } : {}) })}
      >
        Use suggested
      </button>
      <button
        type="button"
        disabled={disabled || own.trim() === ''}
        onClick={() => onAnswer(question.id, { value: own, ...(note ? { note } : {}) })}
      >
        Save answer
      </button>
    </li>
  );
}

export function ReviewSessionPage({ api, runId }: ReviewSessionPageProps): ReactElement {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setSession(await api.getRunReview(runId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }, [api, runId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function answer(
    questionId: string,
    input: { value?: string; takeSuggested?: boolean; note?: string },
  ): Promise<void> {
    if (session === null) return;
    setError(null);
    try {
      await api.saveDraftAnswer(session.id, questionId, input);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  async function submit(): Promise<void> {
    if (session === null) return;
    setError(null);
    try {
      setSession(await api.submitReviewSession(session.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (error !== null && session === null) {
    return (
      <main>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (session === null) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    );
  }

  const submitted = session.state === 'submitted';
  const unanswered = session.questions.filter((q) => q.answers.length === 0).length;

  return (
    <main>
      <h1>Review session</h1>
      <p>
        {session.questions.length} questions · {unanswered} unanswered
        {submitted && <strong> · submitted</strong>}
      </p>
      <ul aria-label="Questions">
        {session.questions.map((q) => (
          <QuestionCard key={q.id} question={q} disabled={submitted} onAnswer={(id, input) => void answer(id, input)} />
        ))}
      </ul>
      <button type="button" disabled={submitted} onClick={() => void submit()}>
        Submit all answers
      </button>
      {error !== null && <p role="alert">{error}</p>}
    </main>
  );
}
