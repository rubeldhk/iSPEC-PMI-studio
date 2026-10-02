/**
 * T114 — the version history panel (US5, FR-013). Newest first.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type SpecificationVersionInfo } from '../services/api';

export interface VersionHistoryProps {
  api: ApiClient;
  specificationId: string;
  /** EPIC-041 T1376 — a selection the page turns into a `VersionDiff` (FR-LPW-044). */
  onSelect?: (versionNumber: number) => void;
}

export function VersionHistory({ api, specificationId, onSelect }: VersionHistoryProps): ReactElement {
  const [versions, setVersions] = useState<SpecificationVersionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const rows = await api.listSpecificationVersions(specificationId);
        setVersions([...rows].sort((a, b) => b.versionNumber - a.versionNumber));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    })();
  }, [api, specificationId]);

  if (error !== null) return <p role="alert">{error}</p>;
  if (versions === null) return <p>Loading…</p>;

  return (
    <section>
      <h2>Version history</h2>
      <ul>
        {versions.map((version) => (
          <li key={version.id}>
            <strong>v{version.versionNumber}</strong> <span>by {version.authoredById}</span>{' '}
            <time dateTime={version.authoredAt}>{version.authoredAt}</time>{' '}
            <span>({version.lifecycleStateAtCreation})</span>
            {onSelect !== undefined && (
              <>
                {' '}
                <button type="button" onClick={() => onSelect(version.versionNumber)}>
                  Compare v{version.versionNumber}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
