/**
 * `T1735` (EPIC-046, `R-046-11`, `contracts/board-contract.md` §1) — the
 * **Plan & Tasks** landing.
 *
 * ## The address this area has never had
 *
 * `frontend/src/shell/areas.ts` has carried a debt since `EPIC-036`'s analysis
 * (`N1`, 2026-08-24): *"Tasks are reached through a specification. A
 * project-level plan view is not built yet."* Navigation renders a link to
 * `Area.path`, and `/specifications/:id/tasks` is not an address — so the area
 * could not be a primary-navigation destination at all.
 *
 * PMI-DOC-007 §6 puts the Task Kanban in exactly this area, so this Epic
 * discharges the debt as a side effect of its own requirement rather than
 * leaving a second landing view to be built later. `EPIC-012`'s `T441p` is
 * **superseded, not abandoned** — its specification-scoped list still works and
 * is still reachable.
 *
 * ## It lists Epics, not specifications
 *
 * A synced task's home is its Epic (`Q1`), and an Epic may have tasks before it
 * has a specification. Listing specifications here would hide exactly the Epics
 * a developer most needs to see — the ones mid-flight.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type Epic, type Progress } from '../services/api';
import { LoadingIndicator } from '../design/components/LoadingIndicator';

function message(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

interface EpicProgress {
  readonly epic: Epic;
  readonly progress: Progress | null;
  /** The read failed for this Epic alone; the rest of the table stands. */
  readonly error: string | null;
}

export interface PlanLandingProps {
  readonly api: ApiClient;
  readonly projectId: string;
  readonly onOpenEpic: (epicId: string) => void;
}

export function PlanLandingPage({ api, projectId, onOpenEpic }: PlanLandingProps): ReactElement {
  const [rows, setRows] = useState<EpicProgress[] | null>(null);
  const [project, setProject] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    void (async (): Promise<void> => {
      try {
        const [{ epics }, projectProgress] = await Promise.all([
          api.listEpics(projectId),
          api.getProjectTaskProgress(projectId),
        ]);
        // One read per Epic, each failing on its own: a single unreadable Epic
        // must not blank the table, which is `FR-SHL-060`'s partial state.
        const withProgress = await Promise.all(
          epics.map(async (epic): Promise<EpicProgress> => {
            try {
              return { epic, progress: await api.getEpicTaskProgress(epic.id), error: null };
            } catch (err: unknown) {
              return { epic, progress: null, error: message(err) };
            }
          }),
        );
        if (live) {
          setRows(withProgress);
          setProject(projectProgress);
        }
      } catch (err: unknown) {
        if (live) setError(message(err));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return (): void => {
      live = false;
    };
  }, [api, projectId]);

  const visible = useMemo(() => {
    const text = filter.trim().toLowerCase();
    if (text === '') return rows ?? [];
    return (rows ?? []).filter((r) => r.epic.title.toLowerCase().includes(text) || String(r.epic.number).includes(text));
  }, [rows, filter]);

  return (
    <section className="ds-stack" aria-label="Plan and tasks">
      <h2>Plan &amp; Tasks</h2>

      {loading && <LoadingIndicator label="Loading the plan" />}

      {error !== null && (
        <p className="ds-field__error" role="alert">
          {error} Try again, or read the task lists in the project directory.
        </p>
      )}

      {!loading && error === null && rows !== null && (
        <>
          <p className="ds-field__hint">
            Tasks are parsed from each Epic&apos;s <code>tasks.md</code>. Percentages exclude tasks the latest parse no longer
            contains, and count the tasks of every Epic plus any generated for a specification.
          </p>

          {project !== null && (
            <p className="ds-field__hint" data-testid="project-progress">
              Project · {project.done} of {project.total} done · {project.percentComplete}%
              {project.blocked > 0 && <> · {project.blocked} blocked</>}
            </p>
          )}

          <label className="ds-field" role="search">
            <span className="ds-field__label">Filter Epics</span>
            <input className="ds-field__input" type="search" value={filter} onChange={(e): void => setFilter(e.target.value)} />
          </label>

          {rows.length === 0 && <p className="ds-field__hint">This project has no Epics yet.</p>}

          {rows.length > 0 && (
            <table className="ds-table">
              <caption className="ds-visually-hidden">Epics and their task progress</caption>
              <thead>
                <tr>
                  <th scope="col">Epic</th>
                  <th scope="col">Done</th>
                  <th scope="col">Total</th>
                  <th scope="col">Percent</th>
                  <th scope="col">Board</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ epic, progress, error: rowError }) => (
                  <tr key={epic.id} data-testid="epic-row">
                    <th scope="row">
                      {epic.number} · {epic.title}
                    </th>
                    <td>{progress?.done ?? '—'}</td>
                    <td>{progress?.total ?? '—'}</td>
                    <td>{progress === null ? <span className="ds-field__hint">{rowError}</span> : `${progress.percentComplete}%`}</td>
                    <td>
                      <button type="button" className="ds-link-button" onClick={(): void => onOpenEpic(epic.id)}>
                        Open board
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
