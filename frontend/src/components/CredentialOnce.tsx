/**
 * EPIC-041 T1379/T1381 (`FR-LPW-021`, `FR-LPW-053`) — a connector credential's
 * value, shown once. The platform cannot re-display it; this component holds
 * it only until the person copies it or moves on, and never persists it.
 */
import { useState, type ReactElement } from 'react';
import { Button } from '../design/components/Button';

export interface CredentialOnceProps {
  label: string;
  value: string;
  onDismiss: () => void;
}

export function CredentialOnce({ label, value, onDismiss }: CredentialOnceProps): ReactElement {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="ds-stack" aria-label="Connector credential" role="region">
      <p className="ds-field__hint">
        The credential <strong>{label}</strong> is shown once. Copy it into <code>PMI_STUDIO_TOKEN</code> on the machine that
        runs the agent; PMI Studio cannot show it again.
      </p>
      <p>
        <code>{value}</code>
      </p>
      <div className="ds-row">
        <Button type="button" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </section>
  );
}
