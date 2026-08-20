/**
 * T083d — the specification list page (US3, FR-012).
 *
 * An out-of-date specification is flagged in the list itself (FR-032): the
 * reader must not have to open each one to learn it is stale.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type Specification } from '../services/api';

export interface SpecificationListProps {
  api: ApiClient;
  projectId: string;
  onOpen: (specificationId: string) => void;
}

export function SpecificationList({ api, projectId, onOpen }: SpecificationListProps): ReactElement {
  const [specifications, setSpecifications] = useState<Specification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const page = await api.listSpecifications(projectId);
        setSpecifications(page.rows);
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
  if (specifications === null) {
    return (
      <section>
        <p>Loading…</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Specifications</h2>
      {specifications.length === 0 && <p>No specifications yet.</p>}
      {specifications.length > 0 && (
        <ul>
          {specifications.map((spec) => (
            <li key={spec.id}>
              <button type="button" onClick={() => onOpen(spec.id)}>
                {spec.title}
              </button>{' '}
              <span>{spec.lifecycleState}</span>{' '}
              <span>
                {spec.engineName} {spec.engineVersion}
              </span>
              {spec.isOutOfDate && <strong> Out of date</strong>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
