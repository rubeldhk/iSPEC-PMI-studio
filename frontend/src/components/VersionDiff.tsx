/**
 * T115 — the version diff view (US5, FR-014).
 *
 * Change direction is encoded as `data-change`, not only color, so it is
 * machine-readable and holds for readers who cannot rely on color.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type VersionDiffResult } from '../services/api';

export interface VersionDiffProps {
  api: ApiClient;
  specificationId: string;
  fromVersion: number;
  toVersion: number;
}

export function VersionDiff({ api, specificationId, fromVersion, toVersion }: VersionDiffProps): ReactElement {
  const [diff, setDiff] = useState<VersionDiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        setDiff(await api.diffSpecificationVersions(specificationId, fromVersion, toVersion));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    })();
  }, [api, specificationId, fromVersion, toVersion]);

  if (error !== null) return <p role="alert">{error}</p>;
  if (diff === null) return <p>Loading…</p>;

  return (
    <section>
      <h2>
        Comparing v{diff.fromVersion} to v{diff.toVersion}
      </h2>
      {diff.identical ? (
        <p>These versions are identical.</p>
      ) : (
        <ul>
          {diff.removed.map((line, i) => (
            <li key={`r${i}`} data-change="removed">
              <del>{line}</del>
            </li>
          ))}
          {diff.added.map((line, i) => (
            <li key={`a${i}`} data-change="added">
              <ins>{line}</ins>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
