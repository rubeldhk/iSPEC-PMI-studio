/**
 * T071 — the requirement register page with filters (US2, FR-008).
 *
 * Filtering is a QUERY of the API, not a client-side sieve: every filter
 * change goes back through `listRequirements`, where the indexes are
 * (SC-009's 1-second p95 applies to listing views).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type Requirement, type RequirementFilters } from '../services/api';

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
    <section>
      <h2>Requirements</h2>
      <div>
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">all</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">all</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">all</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error !== null && <p role="alert">{error}</p>}
      {rows !== null && rows.length === 0 && <p>No requirements match.</p>}
      {rows !== null && rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Description</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((requirement) => (
              <tr key={requirement.id}>
                <td>
                  {onEdit ? (
                    <button type="button" onClick={() => onEdit(requirement)}>
                      {requirement.reference}
                    </button>
                  ) : (
                    requirement.reference
                  )}
                </td>
                <td>{requirement.description}</td>
                <td>{requirement.type}</td>
                <td>{requirement.priority}</td>
                {/* Retired is flagged, never hidden (FR-006). */}
                <td>{requirement.status === 'retired' ? 'retired' : 'active'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
