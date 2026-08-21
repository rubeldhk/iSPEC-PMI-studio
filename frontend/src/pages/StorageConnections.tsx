/**
 * T402 — the storage connections page (EPIC-025 US5, FR-PUB-031, FR-PUB-036
 * surface).
 *
 * Health is shown as the three distinct states the platform reports; a
 * publish failure surfaces its NAMED reason — never a generic message
 * (SC-009). The publish button takes no artifact selection: publishing is
 * whole-project (FR-PUB-032).
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  ApiError,
  type ApiClient,
  type PublishRecord,
  type RepublishPreview,
  type StorageConnection,
} from '../services/api';

export interface StorageConnectionsPageProps {
  api: ApiClient;
  workspaceId: string;
  projectId: string;
}

const STATUS_LABELS: Record<StorageConnection['status'], string> = {
  healthy: 'Healthy',
  needs_reauthorisation: 'Needs re-authorisation',
  unavailable: 'Unavailable',
};

export function StorageConnectionsPage({
  api,
  workspaceId,
  projectId,
}: StorageConnectionsPageProps): ReactElement {
  const [connections, setConnections] = useState<StorageConnection[] | null>(null);
  const [publishes, setPublishes] = useState<PublishRecord[]>([]);
  const [preview, setPreview] = useState<RepublishPreview | null>(null);
  const [providerType, setProviderType] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [rows, history] = await Promise.all([
        api.listStorageConnections(workspaceId),
        api.listPublishes(projectId),
      ]);
      setConnections(rows);
      setPublishes(history);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }, [api, workspaceId, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>): Promise<void> {
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (connections === null && error !== null) {
    return (
      <main>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (connections === null) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    );
  }

  const latest = publishes[publishes.length - 1] ?? null;

  return (
    <main>
      <h1>External storage</h1>

      <section aria-label="Connections">
        {connections.length === 0 ? (
          <p>No storage connection yet.</p>
        ) : (
          <ul>
            {connections.map((connection) => (
              <li key={connection.id}>
                <span>{connection.providerName}</span> → <span>{connection.destination}</span>{' '}
                <strong>{STATUS_LABELS[connection.status]}</strong>
                {connection.disconnectedAt !== null && <em> (disconnected)</em>}
                {connection.disconnectedAt === null && (
                  <button
                    type="button"
                    onClick={() => void run(() => api.disconnectStorageConnection(connection.id))}
                  >
                    Disconnect
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <label>
          Provider
          <input value={providerType} onChange={(e) => setProviderType(e.target.value)} />
        </label>
        <label>
          Destination
          <input value={destination} onChange={(e) => setDestination(e.target.value)} />
        </label>
        <button
          type="button"
          disabled={providerType.trim() === '' || destination.trim() === ''}
          onClick={() =>
            void run(() => api.createStorageConnection(workspaceId, { providerType, destination }))
          }
        >
          Connect
        </button>
      </section>

      <section aria-label="Publishing">
        <button type="button" onClick={() => void run(() => api.publishProject(projectId))}>
          Publish project
        </button>
        <button
          type="button"
          onClick={() =>
            void run(async () => setPreview(await api.getPublishPreview(projectId)))
          }
        >
          Preview republish
        </button>
        {preview !== null && (
          <p role="note">
            {preview.added.length} added · {preview.replaced.length} replaced ·{' '}
            {preview.unchanged.length} unchanged
          </p>
        )}
        {latest !== null && (
          <div aria-label="Latest publish">
            <p>
              Latest publish: <strong>{latest.state}</strong>
            </p>
            {latest.failureMessage !== null && <p role="alert">{latest.failureMessage}</p>}
            {latest.artifactsExcluded.length > 0 && (
              <ul aria-label="Excluded artifacts">
                {latest.artifactsExcluded.map((excluded) => (
                  <li key={excluded.artifactId}>
                    {excluded.name} — {excluded.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      {error !== null && <p role="alert">{error}</p>}
    </main>
  );
}
