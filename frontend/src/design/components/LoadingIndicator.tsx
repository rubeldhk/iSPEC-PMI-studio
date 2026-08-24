/**
 * T892 (EPIC-029) — LoadingIndicator: `role="status"` per D-42, inline by
 * construction so it can never block unrelated interaction
 * (contracts/components.md row 10). Motion uses --motion tokens, so
 * prefers-reduced-motion zeroes it (T875).
 * Unit tests: tests/unit/design/feedback.spec.tsx (T888).
 */
import type { ReactElement } from 'react';

export interface LoadingIndicatorProps {
  /** What is loading — announced, because a bare spinner announces nothing. */
  label?: string;
}

export function LoadingIndicator({ label = 'Loading…' }: LoadingIndicatorProps): ReactElement {
  return (
    <span className="ds-loading" role="status">
      <span className="ds-loading__spinner" aria-hidden="true" />
      <span className="ds-loading__label">{label}</span>
    </span>
  );
}
