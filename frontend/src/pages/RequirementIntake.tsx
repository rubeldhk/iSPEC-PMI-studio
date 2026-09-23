/**
 * `T1169` (EPIC-033 Phase 9) — where a Requirement Room begins.
 *
 * The first step of quickstart Scenario 13, and until now the missing one:
 * `POST /rooms/requirement` existed on no screen, so the journey `SC-RQR-008`
 * measures could not be started.
 *
 * **Nothing here decides anything.** The page collects unstructured intent and
 * hands it to the server, which extracts candidates. `FR-RQR-011` requires every
 * AI element to carry an epistemic label, and labelling happens where the
 * analysis happens — a client that pre-classified what the user typed would be
 * inventing the label.
 *
 * **No workspace field, deliberately.** Since `T1148` the server takes the
 * workspace from the session (`DEF-033-001`). A form offering a tenant to name is
 * exactly how a caller-asserted workspace gets reintroduced.
 */
import { useState, type FormEvent, type ReactElement } from 'react';
import { ApiError, type ApiClient } from '../services/api';

export interface RequirementIntakeProps {
  api: ApiClient;
  projectId: string;
  /** Called with the new Room's object id once the server has opened it. */
  onOpened: (roomObjectId: string) => void;
}

export function RequirementIntake({
  api,
  projectId,
  onOpened,
}: RequirementIntakeProps): ReactElement {
  const [text, setText] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Whitespace is not intent. Trimming here and on the server both matter: this
  // one keeps the button honest, that one is the rule.
  const ready = text.trim().length > 0;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    // Guarded rather than trusted to the `disabled` attribute: a form submitted
    // by Enter does not consult it, and two Rooms from one intent is a mess the
    // user cannot tidy up — neither is obviously the real one.
    if (!ready || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const { roomObjectId } = await api.openRequirementRoom({
        projectId,
        text: text.trim(),
        ...(sourceRef.trim() ? { sourceRef: sourceRef.trim() } : {}),
      });
      onOpened(roomObjectId);
    } catch (err) {
      // The server's sentence, when it authored one. `ApiError` carries the
      // platform message; anything else is ours, because an unrecognised error
      // rendered verbatim is how an internal detail reaches a screen.
      setError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      // Always re-enabled. A form left disabled after one failure is a dead end
      // that looks like a working page.
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e): void => void submit(e)} noValidate>
      <h1>Start a Requirement Room</h1>
      <p>
        Paste or write the intent as it arrived — unstructured is expected. The Room extracts
        candidate requirements from it; nothing is decided here.
      </p>

      <label htmlFor="intake-text">Intent</label>
      <textarea
        id="intake-text"
        name="text"
        rows={12}
        value={text}
        onChange={(e): void => setText(e.target.value)}
        // `aria-describedby` only while there is something to describe: a
        // dangling reference is announced as nothing at all.
        {...(error !== null ? { 'aria-describedby': 'intake-error' } : {})}
      />

      <label htmlFor="intake-source">Source</label>
      <input
        id="intake-source"
        name="sourceRef"
        type="text"
        value={sourceRef}
        onChange={(e): void => setSourceRef(e.target.value)}
        placeholder="Where this came from — a document, a meeting, a ticket"
      />

      {error !== null && (
        // Assertive, and in the flow rather than a toast: a refusal that
        // disappears before it is read is a refusal nobody received.
        <p id="intake-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={!ready || submitting}>
        {submitting ? 'Opening Room…' : 'Open Room'}
      </button>
    </form>
  );
}
