/**
 * T116 — lifecycle transition controls (US6, FR-015/FR-016).
 *
 * The permitted-transition map mirrors M08 §8 (exactly 8 transitions), the
 * same map the server enforces. An invalid transition is NOT offered — the
 * UI never presents a control the server would reject.
 */
import { useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type Specification } from '../services/api';

type TransitionAction =
  | 'submit-for-review'
  | 'reject'
  | 'approve'
  | 'baseline'
  | 'mark-implemented'
  | 'archive';

/** M08 §8 — the 8 permitted transitions, keyed by current state. */
const PERMITTED: Record<Specification['lifecycleState'], ReadonlyArray<{ action: TransitionAction; label: string }>> = {
  draft: [{ action: 'submit-for-review', label: 'Submit for review' }],
  review: [
    { action: 'approve', label: 'Approve' },
    { action: 'reject', label: 'Reject' },
  ],
  approved: [
    { action: 'baseline', label: 'Baseline' },
    { action: 'archive', label: 'Archive' },
  ],
  baselined: [
    { action: 'mark-implemented', label: 'Mark implemented' },
    { action: 'archive', label: 'Archive' },
  ],
  implemented: [{ action: 'archive', label: 'Archive' }],
  archived: [],
};

export interface LifecycleControlsProps {
  api: ApiClient;
  specificationId: string;
  lifecycleState: Specification['lifecycleState'];
  onTransitioned: () => void;
}

export function LifecycleControls({
  api,
  specificationId,
  lifecycleState,
  onTransitioned,
}: LifecycleControlsProps): ReactElement {
  const [error, setError] = useState<string | null>(null);
  const permitted = PERMITTED[lifecycleState];

  async function transition(action: TransitionAction): Promise<void> {
    setError(null);
    try {
      await api.transitionSpecification(specificationId, action);
      onTransitioned();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <div>
      {permitted.length === 0 ? (
        <p>Archived — no further transitions.</p>
      ) : (
        permitted.map(({ action, label }) => (
          <button key={action} type="button" onClick={() => void transition(action)}>
            {label}
          </button>
        ))
      )}
      {error !== null && <p role="alert">{error}</p>}
    </div>
  );
}
