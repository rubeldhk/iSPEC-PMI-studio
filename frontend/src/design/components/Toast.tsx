/**
 * T892 (EPIC-029) — Toast: `role="status"` / polite announcement per D-42 —
 * the one row with real depth, because announcement timing is a product
 * judgement. It renders EXACTLY the caller's message (FR-DS-042: `Saved`,
 * never `Success`), and is never the sole carrier of an error the user must
 * act on — actionable errors belong to ErrorState/FormField, which is why
 * even the error tone stays `status`, not an interrupting `alert`.
 * Unit tests: tests/unit/design/feedback.spec.tsx (T888).
 */
import type { ReactElement } from 'react';

export interface ToastProps {
  /** What happened, specifically — "Requirement saved", not "Success". */
  message: string;
  tone?: 'info' | 'error';
  onDismiss?: () => void;
}

export function Toast({ message, tone = 'info', onDismiss }: ToastProps): ReactElement {
  return (
    <div className={`ds-toast ds-toast--${tone}`} role="status">
      <span className="ds-toast__message">{message}</span>
      {onDismiss && (
        <button type="button" className="ds-toast__dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
