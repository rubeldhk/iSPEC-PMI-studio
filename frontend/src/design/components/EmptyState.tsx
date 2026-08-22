/**
 * T892 (EPIC-029) — EmptyState: explains WHY it is empty and what to do next
 * (FR-DS-021). Semantic sectioning per D-42; the explanation is REQUIRED by
 * the API because an empty box with no why is the failure this component
 * exists to prevent. Unit tests: tests/unit/design/feedback.spec.tsx (T888).
 */
import type { ReactElement } from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  /** Why it is empty — required, never decorative. */
  explanation: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, explanation, actionLabel, onAction }: EmptyStateProps): ReactElement {
  return (
    <section className="ds-empty">
      <p className="ds-empty__title">{title}</p>
      <p className="ds-empty__why">{explanation}</p>
      {actionLabel && (
        <Button variant="ghost" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </section>
  );
}
