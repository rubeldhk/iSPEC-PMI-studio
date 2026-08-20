/**
 * T124 — the validation findings panel (US7, FR-017/FR-018).
 *
 * Every finding carries its location and severity; severity is also encoded
 * as `data-severity` so state is machine-readable, not only prose.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type Finding } from '../services/api';

export interface ValidationFindingsProps {
  api: ApiClient;
  specificationId: string;
}

export function ValidationFindings({ api, specificationId }: ValidationFindingsProps): ReactElement {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        setFindings(await api.getFindings(specificationId));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    })();
  }, [api, specificationId]);

  if (error !== null) return <p role="alert">{error}</p>;
  if (findings === null) return <p>Loading…</p>;

  return (
    <section>
      <h2>Validation findings</h2>
      {findings.length === 0 ? (
        <p>No findings — the last validation run was clean.</p>
      ) : (
        <ul>
          {findings.map((finding) => (
            <li key={finding.id} data-severity={finding.severity}>
              <strong>{finding.severity}</strong> <code>{finding.location}</code>{' '}
              <span>{finding.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
