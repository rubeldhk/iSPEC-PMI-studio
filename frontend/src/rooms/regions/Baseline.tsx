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

/** `T1211` — an approved baseline, as the wire carries it. */
export interface ApprovedBaseline {
  readonly id: string;
  readonly version: number;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly rationale: string;
  readonly setHash: string;
  readonly memberVersionIds: readonly string[];
  /** `FR-RQR-052` — the version that replaced it, or `null` while current. */
  readonly supersededBy: number | null;
}

export interface BaselineProps {
  /** Straight from the readiness projection. Never re-derived here. */
  readonly blockers: readonly BaselineBlocker[];
  /** `null` while readiness is unknown — which is never "ready". */
  readonly ready: boolean | null;
  /**
   * `T1211` — what has already been approved, superseded ones included.
   *
   * `T1208`: without this the screen said *"Nothing is outstanding"* after a
   * successful approval and still offered the control, because readiness is
   * unchanged by approving and nothing rendered the baseline that now existed.
   */
  readonly baselines: readonly ApprovedBaseline[];
  onApprove(rationale: string): Promise<void>;
}

/**
 * What was approved, and when.
 *
 * `S1` acceptance scenario 2 asks a baseline to carry its approver, rationale,
 * timestamp and version; this shows all four, plus the `setHash` so a reader can
 * check the set did not move. It offers no way to change any of it —
 * `FR-RQR-051` makes a baseline immutable, and a control here would imply
 * otherwise.
 */
function Approved({ baselines }: { baselines: readonly ApprovedBaseline[] }): ReactElement {
  return (
    <div className="ds-stack">
      <h4>Approved baselines</h4>
      <ul className="ds-stack">
        {baselines.map((baseline) => (
          <li key={baseline.id} data-testid={`baseline-${baseline.version}`}>
            <p>
              <strong>Version {baseline.version}</strong>
              {baseline.supersededBy === null ? (
                ' — current'
              ) : (
                // `FR-RQR-052` — readable, and it names its successor.
                <> — superseded by version {baseline.supersededBy}</>
              )}
            </p>
            <p>{baseline.rationale}</p>
            <p className="ds-text-muted">
              Approved by {baseline.approvedBy} at {baseline.approvedAt}, freezing{' '}
              {baseline.memberVersionIds.length} requirement version
              {baseline.memberVersionIds.length === 1 ? '' : 's'}.
            </p>
            <p className="ds-text-muted">
              Set hash <code>{baseline.setHash.slice(0, 16)}…</code>
            </p>
          </li>
        ))}
      </ul>
      <p className="ds-text-muted">
        A baseline cannot be edited. A change is a new baseline that supersedes it.
      </p>
    </div>
  );
}

export function Baseline({ blockers, ready, baselines, onApprove }: BaselineProps): ReactElement {
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
        {baselines.length > 0 && <Approved baselines={baselines} />}
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
      {baselines.length > 0 && <Approved baselines={baselines} />}
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
