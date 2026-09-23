/**
 * T071 — the requirement register page with filters (US2, FR-008).
 *
 * Filtering is a QUERY of the API, not a client-side sieve: every filter
 * change goes back through `listRequirements`, where the indexes are
 * (SC-009's 1-second p95 applies to listing views). That is why these are
 * Select filters over a plain `<table>` rather than the design system's
 * self-filtering Table — its filter narrows rows already fetched, and this
 * page's contract is that the DATABASE narrows them.
 *
 * Restyled onto the design system (EPIC-029 T897): FormField-labelled
 * filters, token-styled table, StatusPill status (text as well as colour,
 * FR-DS-012), an empty result that explains itself (FR-DS-021).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type Epic, type Requirement, type RequirementFilters } from '../services/api';
import { Button } from '../design/components/Button';
import { EmptyState } from '../design/components/EmptyState';
import { FormField } from '../design/components/FormField';
import { LoadingIndicator } from '../design/components/LoadingIndicator';
import { PageHeader } from '../design/components/PageHeader';
import { Select } from '../design/components/Select';
import { StatusPill } from '../design/components/StatusPill';

export interface RequirementsPageProps {
  api: ApiClient;
  projectId: string;
  /** Optional hook so a shell can open the editor for a row. */
  onEdit?: (requirement: Requirement) => void;
  /** The signed-in user; when they own the project, each row offers the Epic assignment (FR-EPB-023, T1614). */
  currentUserId?: string | undefined;
}

const TYPES = ['business', 'functional', 'non_functional', 'constraint'];
const PRIORITIES = ['p1', 'p2', 'p3'];
const STATUSES = ['active', 'retired'];

export function RequirementsPage({ api, projectId, onEdit, currentUserId }: RequirementsPageProps): ReactElement {
  const [rows, setRows] = useState<Requirement[] | null>(null);
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // EPIC-044 T1614 (FR-EPB-023): the Epics and the owner are read beside the register; if either
  // read fails the rows still list, and the assignment control simply does not appear.
  useEffect(() => {
    if (currentUserId === undefined) return;
    void (async (): Promise<void> => {
      const [e, p] = await Promise.allSettled([api.listEpics(projectId), api.getProject(projectId)]);
      if (e.status === 'fulfilled') setEpics(e.value.epics);
      if (p.status === 'fulfilled') setOwnerUserId(p.value.ownerUserId);
    })();
  }, [api, projectId, currentUserId]);

  useEffect(() => {
    const filters: RequirementFilters = {
      ...(type !== '' ? { type } : {}),
      ...(priority !== '' ? { priority } : {}),
      ...(status !== '' ? { status } : {}),
    };
    void (async (): Promise<void> => {
      try {
        setRows(await api.listRequirements(projectId, filters));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load requirements.');
      }
    })();
  }, [api, projectId, type, priority, status, reload]);

  const canAssign = currentUserId !== undefined && ownerUserId !== null && currentUserId === ownerUserId;
  const assignable = epics.filter((e) => e.status === 'active');

  return (
    <section className="ds-stack">
      <PageHeader title="Requirements" level={2} />
      <div className="ds-row">
        <FormField id="requirements-type" label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">all</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="requirements-priority" label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">all</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="requirements-status" label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">all</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {error !== null && (
        <p className="ds-field__error" role="alert">
          {error}
        </p>
      )}
      {rows === null && error === null && <LoadingIndicator label="Loading requirements" />}
      {rows !== null && rows.length === 0 && (
        <EmptyState
          title="No requirements match."
          explanation="Nothing in this project fits the filters above — clear one to widen the search."
        />
      )}
      {rows !== null && rows.length > 0 && (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Description</th>
                <th scope="col">Type</th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                {/* EPIC-044 T1581 (FR-EPB-023, FR-EPB-024): the Epic, or unassigned — never blank. */}
                <th scope="col">Epic</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((requirement) => (
                <tr key={requirement.id}>
                  <td>
                    {onEdit ? (
                      <Button variant="ghost" onClick={() => onEdit(requirement)}>
                        {requirement.reference}
                      </Button>
                    ) : (
                      requirement.reference
                    )}
                  </td>
                  <td>{requirement.description}</td>
                  <td>{requirement.type}</td>
                  <td>{requirement.priority}</td>
                  {/* Retired is flagged, never hidden (FR-006). */}
                  <td>
                    {requirement.status === 'retired' ? (
                      <StatusPill tone="warning">retired</StatusPill>
                    ) : (
                      <StatusPill tone="success">active</StatusPill>
                    )}
                  </td>
                  <td>
                    {requirement.epicNumber != null ? `Epic ${requirement.epicNumber} · ${requirement.epicTitle ?? ''}` : 'unassigned'}
                    {canAssign && (
                      <>
                        {' '}
                        <select
                          aria-label={`Assign ${requirement.reference} to an Epic`}
                          value={requirement.epicId ?? ''}
                          onChange={(ev): void => {
                            const epicId = ev.target.value === '' ? null : ev.target.value;
                            void api.assignRequirementEpic(requirement.id, epicId).then(() => setReload((n) => n + 1));
                          }}
                        >
                          <option value="">unassigned</option>
                          {assignable.map((e) => (
                            <option key={e.id} value={e.id}>
                              Epic {e.number} · {e.title}
                            </option>
                          ))}
                          {/* A row on a closed or split Epic keeps naming it, though it cannot be chosen anew. */}
                          {requirement.epicId && !assignable.some((e) => e.id === requirement.epicId) && (
                            <option value={requirement.epicId}>
                              Epic {requirement.epicNumber} · {requirement.epicTitle ?? ''}
                            </option>
                          )}
                        </select>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
