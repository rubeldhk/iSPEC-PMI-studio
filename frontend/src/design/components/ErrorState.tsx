/**
 * T892 (EPIC-029) — ErrorState: what went wrong and what to do next,
 * exposing no internal detail (FR-DS-022). The API accepts exactly a message
 * and an action — a stack trace has no prop to arrive through.
 * Unit tests: tests/unit/design/feedback.spec.tsx (T888).
 */
import type { ReactElement } from 'react';

export interface ErrorStateProps {
  /** What went wrong, in the user's terms. */
  message: string;
  /** What to do next — required; an error with no way forward is a dead end. */
  action: string;
}

export function ErrorState({ message, action }: ErrorStateProps): ReactElement {
  return (
    <section className="ds-error" role="alert">
      <p className="ds-error__message">{message}</p>
      <p className="ds-error__action">{action}</p>
    </section>
  );
}
