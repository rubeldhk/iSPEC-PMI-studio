/**
 * T200d — the run list. `DEF-010-001`, `T200b`. Unit test: `T200d`'s spec.
 *
 * **Built because `ReviewSession` had no parent.** Four of the five pages
 * `DEF-010-001` found orphaned chain off the project view, which already holds
 * the ids they need. `ReviewSessionPage` takes a `runId`, and nothing in the
 * product produced one — `GET /projects/:projectId/runs` had existed since
 * `EPIC-023` with no caller. Routing the review session without this page would
 * have meant the shell inventing a run id, which is not a route, it is a guess.
 *
 * `EPIC-023` owns this surface; it is delivered under `EPIC-010`'s convergence
 * because that is where the defect was found and where the routing lives.
 * `T200b` records the decision and names the owner.
 *
 * The three states are distinguished deliberately — loading, empty and failed
 * all render as "nothing here" if you let them, and a page whose blankness
 * hides its own reason is the shape this whole defect family keeps taking.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type Run } from '../services/api';

export interface RunsPageProps {
  api: ApiClient;
  projectId: string;
  /** The only thing in the product that can supply `ReviewSessionPage`'s prop. */
  onOpen: (runId: string) => void;
}

export function RunsPage({ api, projectId, onOpen }: RunsPageProps): ReactElement {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        setRuns(await api.listRuns(projectId));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    })();
  }, [api, projectId]);

  if (error !== null) {
    return (
      <section>
        <p role="alert">{error}</p>
      </section>
    );
  }
  if (runs === null) {
    return (
      <section>
        <p>Loading…</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Runs</h2>
      {runs.length === 0 && <p>No runs yet.</p>}
      {runs.length > 0 && (
        <ul>
          {runs.map((run) => (
            <li key={run.id}>
              {/* One control per run, not one for the list: the run id is what
                  the review session is opened with. */}
              <button type="button" onClick={() => onOpen(run.id)}>
                {run.id}
              </button>{' '}
              <span>{run.state}</span> <span>{run.mode}</span>{' '}
              <span>{new Date(run.startedAt).toISOString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
