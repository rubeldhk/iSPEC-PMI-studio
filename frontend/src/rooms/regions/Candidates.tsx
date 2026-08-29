/**
 * `T1186` (EPIC-033 Phase 10) — the candidates region.
 *
 * The screen the owner went looking for and did not find. Intake has extracted
 * candidates since Phase 3 and the Room rendered prose over them; this is where
 * a person sees what their intent became and acts on it.
 *
 * ## Why it says "candidate" so insistently
 *
 * `US1` scenario 1: extracted intent is presented **as candidates rather than
 * as facts**. The word is the guardrail — a list that reads like the requirement
 * register invites someone to treat it as one, and `FR-RQR-002` keeps the
 * register in `EPIC-007`. Nothing here is decided until a human decides it.
 *
 * ## Native controls, deliberately
 *
 * `SC-RQR-008` asks for a journey completable by keyboard alone. That comes down
 * to using a real `<form>`, `<input>` and `<button>`: Enter submits without a
 * key handler, Tab reaches everything in order, and focus is visible because the
 * design system styles `:focus-visible` on real controls. A `<div onClick>`
 * would need every one of those rebuilt, and would get one of them wrong.
 */
import { useState, type FormEvent, type ReactElement } from 'react';
import type { RoomCandidate } from '../../services/api';
import { EpistemicMark } from './Epistemic';

export interface CandidatesProps {
  readonly candidates: readonly RoomCandidate[];
  /**
   * Sends the candidate's **whole** criteria list, not a delta.
   *
   * `FR-RQR-030` treats `null` and `[]` as one state, so a caller that appended
   * server-side would need a second verb to clear. One verb, whole value.
   */
  onSetCriteria(
    candidateId: string,
    acceptanceCriteria: readonly string[] | null,
    intendedForImplementation: boolean,
  ): Promise<void>;
}

/** `FR-RQR-030` — the rule is scoped to what is intended for implementation. */
function needsCriteria(candidate: RoomCandidate): boolean {
  return (
    candidate.intendedForImplementation &&
    (candidate.acceptanceCriteria === null || candidate.acceptanceCriteria.length === 0)
  );
}

function CandidateItem({
  candidate,
  onSetCriteria,
}: {
  candidate: RoomCandidate;
  onSetCriteria: CandidatesProps['onSetCriteria'];
}): ReactElement {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const fieldId = `criterion-${candidate.id}`;

  const add = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const criterion = draft.trim();
    // An empty criterion is not a criterion. Refused here rather than sent, so
    // the person sees nothing happen for the reason they expect.
    if (criterion === '' || busy) return;
    setBusy(true);
    try {
      await onSetCriteria(
        candidate.id,
        [...(candidate.acceptanceCriteria ?? []), criterion],
        candidate.intendedForImplementation,
      );
      setDraft('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="ds-stack" data-testid={`candidate-${candidate.id}`}>
      <p>{candidate.normalizedText}</p>

      <p className="ds-row ds-text-muted">
        {/* The label is the mark's own content, so the kind is readable as
            text and not only as a colour token (`UX-0031`). */}
        <EpistemicMark value={{ epistemic: candidate.epistemic, value: candidate.epistemic }} />
        <span>from {candidate.sourceRef}</span>
        {candidate.promotedTo !== null && <span>· promoted</span>}
      </p>

      {candidate.acceptanceCriteria !== null && candidate.acceptanceCriteria.length > 0 && (
        <ul>
          {candidate.acceptanceCriteria.map((criterion) => (
            <li key={criterion}>{criterion}</li>
          ))}
        </ul>
      )}

      {needsCriteria(candidate) && (
        // `UX-0032` — what blocks is visible here, not one screen away.
        <p role="status">Needs acceptance criteria before it can be baselined.</p>
      )}

      <form className="ds-row" onSubmit={(event): void => void add(event)}>
        <label htmlFor={fieldId}>Acceptance criterion</label>
        <input
          id={fieldId}
          type="text"
          value={draft}
          onChange={(event): void => setDraft(event.target.value)}
          placeholder="Measurable, and checkable by someone else"
        />
        <button type="submit" disabled={busy}>
          Add criterion
        </button>
      </form>
    </li>
  );
}

export function Candidates({ candidates, onSetCriteria }: CandidatesProps): ReactElement {
  return (
    <section className="ds-stack">
      <h3>Candidates</h3>
      <p className="ds-text-muted">
        Extracted from intent. Nothing here is a requirement until a human decides it is.
      </p>

      {candidates.length === 0 ? (
        // Not an error, and not "no results" — a Room with no candidates yet is
        // an ordinary early state.
        <p>No candidates yet. Submit some intent to get started.</p>
      ) : (
        <ul className="ds-stack">
          {candidates.map((candidate) => (
            <CandidateItem
              key={candidate.id}
              candidate={candidate}
              onSetCriteria={onSetCriteria}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
