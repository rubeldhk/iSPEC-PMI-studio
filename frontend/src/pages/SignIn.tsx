/**
 * T057 — the sign-in page (US1, contracts/platform-api.md · Authentication).
 *
 * The session itself is an HTTP-only cookie the browser carries; this page's
 * whole job is credentials in, identity out to `onSignedIn`, errors readable.
 */
import { useState, type FormEvent, type ReactElement } from 'react';
import { ApiError, type ApiClient, type WhoAmI } from '../services/api';

export interface SignInProps {
  api: ApiClient;
  /** Called with the established identity — the shell redirects. */
  onSignedIn: (identity: WhoAmI) => void;
}

export function SignIn({ api, onSignedIn }: SignInProps): ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onSignedIn(await api.signIn(email, password));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>PMI Studio</h1>
      <form onSubmit={(e) => void submit(e)}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {error !== null && <p role="alert">{error}</p>}
    </main>
  );
}
