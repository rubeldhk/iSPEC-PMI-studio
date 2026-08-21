/**
 * T400 — access grant management (EPIC-024 US4, FR-ACC-021, FR-ACC-022,
 * FR-ACC-027 surface).
 *
 * The 409 on revoking the last editor is surfaced as the refusal it is —
 * the invariant lives on the server; this control just tells the truth.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ApiError, type AccessGrant, type ApiClient } from '../services/api';

export interface AccessGrantsProps {
  api: ApiClient;
  artifactType: string;
  artifactId: string;
}

export function AccessGrants({ api, artifactType, artifactId }: AccessGrantsProps): ReactElement {
  const [grants, setGrants] = useState<AccessGrant[] | null>(null);
  const [userId, setUserId] = useState('');
  const [level, setLevel] = useState<'read' | 'edit'>('read');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setGrants(await api.listGrants(artifactType, artifactId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }, [api, artifactType, artifactId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function add(): Promise<void> {
    setError(null);
    try {
      await api.createGrant(artifactType, artifactId, { userId, level });
      setUserId('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  async function revoke(grantId: string): Promise<void> {
    setError(null);
    try {
      await api.revokeGrant(artifactType, artifactId, grantId);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (grants === null && error !== null) {
    return <p role="alert">{error}</p>;
  }
  if (grants === null) {
    return <p>Loading…</p>;
  }

  return (
    <section aria-label="Access grants">
      <h2>Who has access</h2>
      {grants.length === 0 ? (
        <p>Open — no grants yet. Adding the first grant restricts this artifact.</p>
      ) : (
        <ul>
          {grants.map((grant) => (
            <li key={grant.id}>
              <span>{grant.userId}</span> — <span>{grant.level}</span>{' '}
              <button type="button" onClick={() => void revoke(grant.id)}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
      <label>
        User
        <input value={userId} onChange={(e) => setUserId(e.target.value)} />
      </label>
      <label>
        Level
        <select value={level} onChange={(e) => setLevel(e.target.value as 'read' | 'edit')}>
          <option value="read">Read</option>
          <option value="edit">Edit</option>
        </select>
      </label>
      <button type="button" disabled={userId.trim() === ''} onClick={() => void add()}>
        Grant access
      </button>
      {error !== null && <p role="alert">{error}</p>}
    </section>
  );
}
