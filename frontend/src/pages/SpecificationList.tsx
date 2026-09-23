/**
 * T083d — the specification list page (US3, FR-012).
 *
 * An out-of-date specification is flagged in the list itself (FR-032): the
 * reader must not have to open each one to learn it is stale.
 *
 * EPIC-044 `T1600` (`FR-EPB-050`): every row names its Epic and the Epic's
 * derived stage, or *no Epic* with an empty stage; both filter; an owner
 * assigns an unbound specification from its row. The Epic and the board are
 * read beside the list — a failure of either leaves the list itself standing.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type BoardRead, type Epic, type Specification } from '../services/api';

export interface SpecificationListProps {
  api: ApiClient;
  projectId: string;
  onOpen: (specificationId: string) => void;
  /** The signed-in user; when known, the assignment control appears for the owner only. */
  currentUserId?: string | undefined;
}

export function SpecificationList({ api, projectId, onOpen, currentUserId }: SpecificationListProps): ReactElement {
  const [specifications, setSpecifications] = useState<Specification[] | null>(null);
  const [board, setBoard] = useState<BoardRead | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aside, setAside] = useState<string | null>(null);
  const [epicFilter, setEpicFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const page = await api.listSpecifications(projectId);
        setSpecifications(page.rows);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
        return;
      }
      const [b, e, p] = await Promise.allSettled([api.getBoard(projectId), api.listEpics(projectId), api.getProject(projectId)]);
      const problems: string[] = [];
      if (b.status === 'fulfilled') setBoard(b.value);
      else problems.push('stages');
      if (e.status === 'fulfilled') setEpics(e.value.epics);
      else problems.push('Epics');
      if (p.status === 'fulfilled') setOwnerUserId(p.value.ownerUserId);
      else problems.push('project');
      setAside(problems.length > 0 ? `Some of this screen did not load: ${problems.join(', ')}.` : null);
    })();
  }, [api, projectId, reload]);

  if (error !== null) {
    return (
      <section>
        <p role="alert">{error}</p>
      </section>
    );
  }
  if (specifications === null) {
    return (
      <section>
        <p>Loading…</p>
      </section>
    );
  }

  const canAssign = currentUserId !== undefined && ownerUserId !== null && currentUserId === ownerUserId;
  const stageOf = (epicId: string | null | undefined): string => (epicId ? board?.epics.find((s) => s.epicId === epicId)?.stage ?? '' : '');
  // FR-EPB-050: both columns filter. A *no Epic* row has an empty stage, so it matches only the empty stage filter.
  const visible = specifications
    .filter((s) => (epicFilter === '' ? true : epicFilter === 'none' ? !s.epicId : s.epicId === epicFilter))
    .filter((s) => (stageFilter === '' ? true : stageOf(s.epicId) === stageFilter));

  return (
    <section>
      <h2>Specifications</h2>
      {aside !== null && <p role="status">{aside}</p>}
      {specifications.length > 0 && (
        <p>
          <label htmlFor="specification-epic-filter">Filter by Epic</label>{' '}
          <select id="specification-epic-filter" value={epicFilter} onChange={(ev) => setEpicFilter(ev.target.value)}>
            <option value="">all</option>
            <option value="none">no Epic</option>
            {epics.map((e) => (
              <option key={e.id} value={e.id}>
                Epic {e.number} · {e.title}
              </option>
            ))}
          </select>{' '}
          <label htmlFor="specification-stage-filter">Filter by stage</label>{' '}
          <select id="specification-stage-filter" value={stageFilter} onChange={(ev) => setStageFilter(ev.target.value)}>
            <option value="">all</option>
            {(board?.columns ?? []).map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </p>
      )}
      {specifications.length === 0 && <p>No specifications yet.</p>}
      {specifications.length > 0 && (
        <ul>
          {visible.map((spec) => (
            <li key={spec.id}>
              <button type="button" onClick={() => onOpen(spec.id)}>
                {spec.title}
              </button>{' '}
              <span>{spec.lifecycleState}</span>{' '}
              <span>
                {spec.engineName} {spec.engineVersion}
              </span>
              {spec.isOutOfDate && <strong> Out of date</strong>}{' '}
              <span>{spec.epicNumber != null ? `Epic ${spec.epicNumber} · ${spec.epicTitle ?? ''}` : 'no Epic'}</span>{' '}
              <span>{stageOf(spec.epicId)}</span>
              {canAssign && !spec.epicId && epics.length > 0 && (
                <>
                  {' '}
                  <label>
                    <span className="ds-visually-hidden">Assign {spec.title} to an Epic</span>
                    <select
                      aria-label={`Assign ${spec.title} to an Epic`}
                      defaultValue=""
                      onChange={(ev): void => {
                        const epicId = ev.target.value;
                        if (!epicId) return;
                        void api.assignSpecificationEpic(spec.id, epicId).then(() => setReload((n) => n + 1));
                      }}
                    >
                      <option value="">assign to…</option>
                      {epics
                        .filter((e) => e.status === 'active')
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            Epic {e.number} · {e.title}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
