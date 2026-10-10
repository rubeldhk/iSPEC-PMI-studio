/**
 * EPIC-048 `T2379` (`FR-LRN-071`, `-072`, `-074`, `-075`; `UX-0032`) — the detail
 * the Decision Inbox renders for an item whose target type is
 * `learning-candidate`.
 *
 * Everything a reviewer needs on one view: the proposed statement, its category,
 * the source session, each citation with its live state, confidence and basis,
 * the claimed scope, corroborations, any conflict, and — for a supersession —
 * the entry it replaces beside it. Agent-proposed and approved content are
 * distinct by border **and** by label. Withheld evidence is a count, never an
 * item.
 *
 * Deciding: approve (the statement may be edited; the scope may only be
 * narrowed — the choices offered never exceed the claim) or reject with a
 * reason. The review route decides who may (`FR-LRN-027`); a refusal is shown,
 * not swallowed.
 *
 * Hosted by `EPIC-031`'s Inbox through its renderer registry (`A-031-2`); the
 * registration is `T2385`, blocked until that Epic merges. No navigation area of
 * its own (`FR-LRN-070`).
 */
import { useCallback, useEffect, useId, useMemo, useState, type ReactElement } from 'react';
import type { LearningCandidateView, LearningReviewInput, LearningReviewResult, LearningScope } from '../../services/api';
import { Button } from '../../design/components/Button';
import { ErrorState } from '../../design/components/ErrorState';
import { LoadingIndicator } from '../../design/components/LoadingIndicator';
import { StatusPill } from '../../design/components/StatusPill';
import './learning.css';

/** The two calls this view makes — a narrowing of `ApiClient`. */
export interface LearningCandidateApi {
  getLearningCandidate(candidateId: string): Promise<LearningCandidateView>;
  reviewLearningCandidate(candidateId: string, input: LearningReviewInput): Promise<LearningReviewResult>;
}

export interface LearningCandidateDetailProps {
  readonly api: LearningCandidateApi;
  readonly candidateId: string;
  readonly onDecided?: (result: LearningReviewResult) => void;
}

export function describeScope(scope: LearningScope): string {
  if (scope.kind === 'workspace') return 'the whole workspace';
  if (scope.kind === 'project') return `project ${scope.projectIds[0]}`;
  return `projects ${scope.projectIds.join(', ')}`;
}

/** Every scope a reviewer may approve: the claim itself, or one project inside it — never wider. */
function narrowings(claimed: LearningScope): { value: string; label: string; scope: LearningScope | null }[] {
  const options: { value: string; label: string; scope: LearningScope | null }[] = [{ value: 'claimed', label: `As claimed — ${describeScope(claimed)}`, scope: null }];
  if (claimed.kind === 'projects') {
    for (const p of claimed.projectIds) options.push({ value: `project:${p}`, label: `Only project ${p}`, scope: { kind: 'project', projectIds: [p] } });
  }
  return options;
}

const EVIDENCE_TONE = { verified: 'success', 'integrity-failed': 'danger', unresolvable: 'warning' } as const;

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export function LearningCandidateDetail({ api, candidateId, onDecided }: LearningCandidateDetailProps): ReactElement {
  const headingId = useId();
  const statementId = useId();
  const scopeId = useId();
  const classificationId = useId();
  const reasonId = useId();
  const [view, setView] = useState<LearningCandidateView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statement, setStatement] = useState('');
  const [scopeChoice, setScopeChoice] = useState('claimed');
  const [classification, setClassification] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [result, setResult] = useState<LearningReviewResult | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const v = await api.getLearningCandidate(candidateId);
      setView(v);
      setStatement(v.candidate.statement);
    } catch (err) {
      setLoadError(message(err));
    }
  }, [api, candidateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const options = useMemo(() => (view ? narrowings(view.candidate.claimedScope) : []), [view]);

  const decide = async (input: LearningReviewInput): Promise<void> => {
    setBusy(true);
    setDecisionError(null);
    try {
      const out = await api.reviewLearningCandidate(candidateId, input);
      setResult(out);
      onDecided?.(out);
    } catch (err) {
      setDecisionError(message(err));
    } finally {
      setBusy(false);
    }
  };

  if (loadError !== null) return <ErrorState message={loadError} action="Reload the candidate." />;
  if (view === null) return <LoadingIndicator label="Loading the candidate" />;

  const { candidate, source } = view;
  const pending = candidate.state === 'pending-review' && result === null;
  const shownEvidence = view.evidence.filter((e): e is Exclude<typeof e, { state: 'withheld' }> => e.state !== 'withheld');
  const proposedBy = source.kind === 'execution' ? 'Proposed by an agent' : 'Proposed by a person';

  const approve = (): void => {
    const chosen = options.find((o) => o.value === scopeChoice)?.scope ?? null;
    void decide({
      decision: 'approve',
      ...(statement.trim() !== '' && statement !== candidate.statement ? { statement } : {}),
      ...(chosen !== null ? { scope: chosen } : {}),
      ...(classification.trim() !== '' ? { classification: classification.trim() } : {}),
    });
  };

  return (
    <article className="lrn-view" aria-labelledby={headingId}>
      <header className="lrn-section">
        <h2 id={headingId}>Learning candidate</h2>
        <p>
          <StatusPill tone={candidate.state === 'approved' ? 'success' : candidate.state === 'rejected' ? 'danger' : 'neutral'}>{candidate.state}</StatusPill>{' '}
          {candidate.kind !== 'new' && <StatusPill tone="accent">{candidate.kind}</StatusPill>}
        </p>
      </header>

      {view.supersedes === undefined ? (
        <figure className="lrn-proposed" aria-label={proposedBy}>
          <p className="lrn-label">Proposed — not knowledge until decided</p>
          <blockquote>{candidate.statement}</blockquote>
        </figure>
      ) : (
        <section className="lrn-section" aria-label="Proposed change">
          <p className="lrn-label">Proposed — not knowledge until decided</p>
          <div className="lrn-compare">
            <figure className="lrn-approved" aria-label={`Approved knowledge — v${view.supersedes.version} (${view.supersedes.status})`}>
              <p className="lrn-label">Approved knowledge — v{view.supersedes.version}</p>
              <blockquote>{view.supersedes.statement}</blockquote>
              <p>
                Scope: {describeScope(view.supersedes.scope)} · Classification: {view.supersedes.classification}
              </p>
            </figure>
            <figure className="lrn-proposed" aria-label={proposedBy}>
              <p className="lrn-label">{proposedBy}</p>
              <blockquote>{candidate.statement}</blockquote>
              <p>Claimed scope: {describeScope(candidate.claimedScope)}</p>
            </figure>
          </div>
        </section>
      )}

      <dl className="lrn-meta">
        <div>
          <dt>Category</dt>
          <dd>{candidate.category}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            {source.kind === 'execution' ? (
              <>
                Session {source.executionId} by {source.principalId}
                {source.expert !== undefined && <> · Expert {source.expert.id}, contract v{source.expert.contractVersion}</>}
              </>
            ) : (
              <>Person {source.userId}</>
            )}
            {candidate.late && ' · submitted after the session ended'}
          </dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{candidate.confidenceLevel}</dd>
        </div>
        <div>
          <dt>Basis</dt>
          <dd>{candidate.confidenceBasis}</dd>
        </div>
        <div>
          <dt>Claimed scope</dt>
          <dd>{describeScope(candidate.claimedScope)}</dd>
        </div>
      </dl>

      <section className="lrn-section" aria-label="Evidence">
        <h3>Evidence</h3>
        <ul className="lrn-list">
          {shownEvidence.map((e, i) => (
            <li key={`${e.evidenceId}-${i}`}>
              <StatusPill tone={EVIDENCE_TONE[e.state]}>{e.state}</StatusPill> {e.evidenceId}
              {e.predicateType !== null && <> · {e.predicateType}</>}
              <br />
              <code>{e.digest}</code>
            </li>
          ))}
        </ul>
        {view.withheldEvidenceCount > 0 && (
          <p>
            {view.withheldEvidenceCount === 1 ? '1 evidence item is' : `${view.withheldEvidenceCount} evidence items are`} not visible to you.
          </p>
        )}
      </section>

      {view.corroborations.length > 0 && (
        <section className="lrn-section" aria-label="Corroborations">
          <h3>Corroborations</h3>
          <ul className="lrn-list">
            {view.corroborations.map((c) => (
              <li key={c.id}>
                <blockquote>{c.statement}</blockquote>
                {c.sourceKind === 'execution' ? `Session ${c.executionId} by ${c.sourcePrincipalId}` : `Person ${c.sourcePrincipalId}`} · stated {c.confidenceLevel}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.conflictsWith !== undefined && (
        <section className="lrn-section" aria-label="Conflicts with approved knowledge">
          <h3>Conflicts with approved knowledge</h3>
          <figure className="lrn-approved" aria-label={`Approved knowledge — v${view.conflictsWith.version}`}>
            <p className="lrn-label">Approved knowledge — entry {view.conflictsWith.entryId}, v{view.conflictsWith.version}</p>
            <blockquote>{view.conflictsWith.statement}</blockquote>
          </figure>
        </section>
      )}

      {view.eligibility !== undefined && !view.eligibility.automatic && (
        <p>Waits for a person because: {view.eligibility.failedConditions.join(', ')}</p>
      )}
      {view.decision !== undefined && (
        <p>
          Decision {view.decision.decisionId}: {view.decision.unavailable ?? view.decision.outcome}
        </p>
      )}

      {pending && (
        <section className="lrn-section" aria-label="Decide">
          <h3>Decide</h3>
          <div className="lrn-form">
            <label htmlFor={statementId}>Approved statement</label>
            <textarea id={statementId} rows={3} value={statement} onChange={(e) => setStatement(e.target.value)} />
            <label htmlFor={scopeId}>Approved scope</label>
            <select id={scopeId} value={scopeChoice} onChange={(e) => setScopeChoice(e.target.value)}>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label htmlFor={classificationId}>Classification (optional)</label>
            <input id={classificationId} value={classification} onChange={(e) => setClassification(e.target.value)} />
            <div className="lrn-actions">
              <Button onClick={approve} loading={busy}>
                Approve
              </Button>
            </div>
            <label htmlFor={reasonId}>Reason for rejecting</label>
            <textarea id={reasonId} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="lrn-actions">
              <Button variant="danger" disabled={reason.trim() === '' || busy} onClick={() => void decide({ decision: 'reject', reason: reason.trim() })}>
                Reject
              </Button>
            </div>
          </div>
        </section>
      )}

      {decisionError !== null && (
        <p role="alert" className="lrn-banner">
          {decisionError}
        </p>
      )}
      {result !== null && (
        <p role="status" className="lrn-banner">
          {result.state === 'approved'
            ? `Approved as version ${result.version ?? 1}. ${
                result.retrievability?.outcome === 'retrievable' ? 'Retrievable by context.' : `Not yet retrievable: ${result.retrievability?.reason ?? 'indexing not attempted'}.`
              }`
            : `Recorded: ${result.state}${result.reason ? ` — ${result.reason}` : ''}.`}
        </p>
      )}
    </article>
  );
}
