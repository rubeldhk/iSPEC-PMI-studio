/**
 * `T1192` (EPIC-033 Phase 11) — the baseline control.
 *
 * ## Why this is not simply an Approve button
 *
 * A baseline cannot complete today, and the reason is a deliberate refusal
 * rather than a bug. `FR-RQR-053`: a baseline cannot complete on an unevaluated
 * Evidence Contract, and `BR-0144` says *declaring* completion is not the
 * evidence. `ROOM_PORTS` declares `EvidenceContractSource` as
 * `filledBy: 'EPIC-032', absent: 'refuse'`, and `EPIC-032` has not bound it — so
 * `BaselineService.approve` throws `EvidenceSourceUnavailableError` before it
 * reads anything else.
 *
 * A button that always failed would teach a person that approving is broken. A
 * greyed-out one would imply the feature exists and they lack permission —
 * `T403w` rejected exactly that shape for `BR-0004`, and the reasoning carries:
 * *"a greyed-out control would imply a feature exists and this user lacks it,
 * which is a different and untrue thing."*
 *
 * So the control **states its preconditions** and offers approval only when
 * they are met. The unmet ones come from the readiness projection, which is the
 * same source the Evidence region renders (`UX-0032`) — not a second opinion
 * computed here.
 */
import { useState, type FormEvent, type ReactElement } from 'react';

export interface BaselineBlocker {
  readonly kind: string;
  readonly subject: string;
  readonly detail: string;
}

export interface BaselineProps {
  /** Straight from the readiness projection. Never re-derived here. */
  readonly blockers: readonly BaselineBlocker[];
  /** `null` while readiness is unknown — which is never "ready". */
  readonly ready: boolean | null;
  onApprove(rationale: string): Promise<void>;
}

export function Baseline({ blockers, ready, onApprove }: BaselineProps): ReactElement {
  const [rationale, setRationale] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    if (rationale.trim() === '') {
      // `BR-0025` — a baseline nobody explained cannot be reviewed.
      setProblem('A rationale is required.');
      return;
    }
    setProblem(null);
    setBusy(true);
    try {
      await onApprove(rationale.trim());
      setRationale('');
    } catch (error) {
      // The refusal is the product speaking, so it is shown rather than
      // swallowed — including `EvidenceSourceUnavailableError`, which is what a
      // person will meet until `EPIC-032` binds its source.
      setProblem(error instanceof Error ? error.message : 'The baseline was refused.');
    } finally {
      setBusy(false);
    }
  };

  if (ready !== true) {
    return (
      <section className="ds-stack">
        <h3>Baseline</h3>
        <p>
          This set cannot be baselined yet. A baseline is immutable once approved, so what is
          outstanding is listed rather than waived.
        </p>
        {blockers.length === 0 ? (
          <p role="status">
            Readiness is unknown, which is not the same as ready. Nothing can be approved until it
            is known.
          </p>
        ) : (
          <ul>
            {blockers.map((blocker) => (
              <li key={`${blocker.kind}:${blocker.subject}`}>
                <strong>{blocker.kind}</strong> — {blocker.detail}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="ds-stack">
      <h3>Baseline</h3>
      <p>
        Nothing is outstanding. Approving freezes this set: it carries your name, this rationale,
        the time, and a version, and it cannot be edited afterwards — only superseded.
      </p>
      <form className="ds-stack" onSubmit={(event): void => void submit(event)}>
        <label htmlFor="baseline-rationale">Rationale</label>
        <textarea
          id="baseline-rationale"
          value={rationale}
          onChange={(event): void => setRationale(event.target.value)}
        />
        {problem !== null && <p role="alert">{problem}</p>}
        <button type="submit" disabled={busy}>
          Approve baseline
        </button>
      </form>
    </section>
  );
}
