/**
 * T893 (EPIC-029) — StatusPill: status carried by TEXT as well as colour
 * (FR-DS-012, D-42 row 15). The children ARE the status text; a pill with no
 * text is a colour swatch, which is the failure this component exists to
 * prevent. Unit tests: tests/unit/design/structure.spec.tsx (T889).
 */
import type { ReactElement, ReactNode } from 'react';

export interface StatusPillProps {
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
  /** The status, as text (or an icon plus text) — never colour alone. */
  children: ReactNode;
}

export function StatusPill({ tone, children }: StatusPillProps): ReactElement {
  return <span className={`ds-pill ds-pill--${tone}`}>{children}</span>;
}
