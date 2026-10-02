/**
 * `T1188` (EPIC-033 Phase 10) — the clarifications region.
 *
 * `FR-RQR-012` is unusually specific and this component exists to honour it:
 * questions are presented **as one set** rather than one at a time, and are
 * **answerable in place**. Both halves matter. A wizard that asks one question
 * per screen hides how much is left and makes the set impossible to reason
 * about; an answer that navigates away loses the context the question was about.
 *
 * `FR-RQR-013` — an answer is retained as part of the record, not discarded once
 * resolved. So an answered question stays visible with its answer beside it,
 * rather than disappearing from the list.
 */
import { useState, type FormEvent, type ReactElement } from 'react';
import type { RoomClarification } from '../../services/api';

export interface ClarificationsProps {
  readonly clarifications: readonly RoomClarification[];
  onAnswer(clarificationId: string, answer: string): Promise<void>;
}

function ClarificationItem({
  clarification,
  onAnswer,
}: {
  clarification: RoomClarification;
  onAnswer: ClarificationsProps['onAnswer'];
}): ReactElement {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const fieldId = `answer-${clarification.id}`;
  const answered = clarification.answer !== null && clarification.answer !== '';

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const answer = draft.trim();
    if (answer === '' || busy) return;
    setBusy(true);
    try {
      await onAnswer(clarification.id, answer);
      setDraft('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="ds-stack" data-testid={`clarification-${clarification.id}`}>
      <p>{clarification.question}</p>

      {clarification.blocksBaseline && !answered && (
        // `UX-0032` — a blocking question says so where it is asked.
        <p role="status">Blocks baseline until answered.</p>
      )}

      {answered ? (
        // `FR-RQR-013` — retained, not cleared. The question and its answer stay
        // together, because a resolved question is part of the record of how the
        // requirement got its meaning.
        <p>
          <strong>Answered:</strong> {clarification.answer}
        </p>
      ) : (
        <form className="ds-row" onSubmit={(event): void => void submit(event)}>
          <label htmlFor={fieldId}>Answer</label>
          <input
            id={fieldId}
            type="text"
            value={draft}
            onChange={(event): void => setDraft(event.target.value)}
          />
          <button type="submit" disabled={busy}>
            Answer
          </button>
        </form>
      )}
    </li>
  );
}

export function Clarifications({ clarifications, onAnswer }: ClarificationsProps): ReactElement {
  const open = clarifications.filter((c) => c.answer === null || c.answer === '').length;

  return (
    <section className="ds-stack">
      <h3>Clarifications</h3>

      {clarifications.length === 0 ? (
        <p>No questions raised yet.</p>
      ) : (
        <>
          {/* The whole set at once, and how much of it is left — `FR-RQR-012`. */}
          <p className="ds-text-muted">
            {open} of {clarifications.length} unanswered
          </p>
          <ul className="ds-stack">
            {clarifications.map((clarification) => (
              <ClarificationItem
                key={clarification.id}
                clarification={clarification}
                onAnswer={onAnswer}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
