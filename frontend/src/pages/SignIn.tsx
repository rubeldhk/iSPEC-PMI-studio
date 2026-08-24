/**
 * T057 — the sign-in page (US1, contracts/platform-api.md · Authentication).
 *
 * The session itself is an HTTP-only cookie the browser carries; this page's
 * whole job is credentials in, identity out to `onSignedIn`, errors readable.
 *
 * Restyled onto the design system (EPIC-029 T895): tokens and components
 * only — FormField owns the labels, Button carries the busy state without
 * losing its words (FR-DS-042).
 */
import { useState, type FormEvent, type ReactElement } from 'react';
import { ApiError, type ApiClient, type WhoAmI } from '../services/api';
import { Button } from '../design/components/Button';
import { FormField } from '../design/components/FormField';
import { PageHeader } from '../design/components/PageHeader';
import { TextInput } from '../design/components/TextInput';

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
    <main className="ds-page">
      <PageHeader title="PMI Studio" />
      <form className="ds-stack" onSubmit={(e) => void submit(e)}>
        <FormField id="sign-in-email" label="Email">
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </FormField>
        <FormField id="sign-in-password" label="Password">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </FormField>
        <div className="ds-row">
          <Button type="submit" loading={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>
      {error !== null && (
        <p className="ds-field__error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
