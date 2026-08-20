/**
 * T134 — traceability and coverage views (US7, FR-029 to FR-031).
 *
 * Both traversal directions are first-class: forward from a requirement to
 * everything derived from it, backward from a task to its origins. Retired
 * requirements render FLAGGED, never omitted. Coverage shows the gaps —
 * derived from absence, which is why an empty list is good news here.
 */
import { useEffect, useState, type ReactElement } from 'react';
import {
  ApiError,
  type ApiClient,
  type CoverageReport,
  type ForwardTrace,
  type ReverseTrace,
} from '../services/api';

export interface TraceabilityPageProps {
  api: ApiClient;
  projectId: string;
}

export function TraceabilityPage({ api, projectId }: TraceabilityPageProps): ReactElement {
  const [requirementId, setRequirementId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [forward, setForward] = useState<ForwardTrace | null>(null);
  const [reverse, setReverse] = useState<ReverseTrace | null>(null);
  const [coverage, setCoverage] = useState<CoverageReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        setCoverage(await api.getProjectCoverage(projectId));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load coverage.');
      }
    })();
  }, [api, projectId]);

  async function traceForward(): Promise<void> {
    setError(null);
    try {
      setForward(await api.getRequirementTrace(requirementId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Trace failed.');
    }
  }

  async function traceBack(): Promise<void> {
    setError(null);
    try {
      setReverse(await api.getTaskTrace(taskId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Trace failed.');
    }
  }

  return (
    <section>
      <h2>Traceability</h2>

      <div>
        <label>
          Requirement id
          <input value={requirementId} onChange={(e) => setRequirementId(e.target.value)} />
        </label>
        <button type="button" onClick={() => void traceForward()}>
          Trace forward
        </button>
      </div>
      {forward && (
        <div>
          <h3>Derived from {forward.requirementId}</h3>
          {forward.specifications.length === 0 && <p>Nothing has been derived yet.</p>}
          <ul>
            {forward.specifications.map((spec) => (
              <li key={spec.specificationId}>
                <span>{spec.specificationId}</span>
                {spec.taskIds.length > 0 && <span> → tasks: {spec.taskIds.join(', ')}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label>
          Task id
          <input value={taskId} onChange={(e) => setTaskId(e.target.value)} />
        </label>
        <button type="button" onClick={() => void traceBack()}>
          Trace back
        </button>
      </div>
      {reverse && (
        <div>
          <h3>Origins of {reverse.taskId}</h3>
          {reverse.specifications.length === 0 && (
            <p>This task traces to no specification — an SC-003 gap worth chasing.</p>
          )}
          <ul>
            {reverse.specifications.map((spec) => (
              <li key={spec.specificationId}>
                <span>{spec.specificationId}</span>
                <ul>
                  {spec.requirements.map((req) => (
                    <li key={req.requirementId}>
                      <span>{req.requirementId}</span>
                      {/* Flagged, never omitted (US7 scenario 4). */}
                      {req.retired && <em> (retired)</em>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3>Coverage</h3>
        {coverage === null && <p>Loading coverage…</p>}
        {coverage !== null && (
          <>
            <p>
              {coverage.requirementCount} requirements · {coverage.specificationCount}{' '}
              specifications
            </p>
            <h4>Requirements with no specification</h4>
            {coverage.uncoveredRequirementIds.length === 0 ? (
              <p>None — every requirement is covered.</p>
            ) : (
              <ul>
                {coverage.uncoveredRequirementIds.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            )}
            <h4>Specifications with no tasks</h4>
            {coverage.specificationsWithoutTasks.length === 0 ? (
              <p>None — every specification has tasks.</p>
            ) : (
              <ul>
                {coverage.specificationsWithoutTasks.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {error !== null && <p role="alert">{error}</p>}
    </section>
  );
}
