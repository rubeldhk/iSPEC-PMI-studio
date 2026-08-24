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
import { ApiError, type ApiClient, type Requirement, type RequirementFilters } from '../services/api';
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
}

const TYPES = ['business', 'functional', 'non_functional', 'constraint'];
const PRIORITIES = ['p1', 'p2', 'p3'];
const STATUSES = ['active', 'retired'];

export function RequirementsPage({ api, projectId, onEdit }: RequirementsPageProps): ReactElement {
  const [rows, setRows] = useState<Requirement[] | null>(null);
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

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
  }, [api, projectId, type, priority, status]);

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
