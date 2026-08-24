/**
 * T891 (EPIC-029) — Button, built on `<button>` (D-42): type, disabled and
 * keyboard activation are the element's. Loading KEEPS the label — a spinner
 * replacing text loses the announcement (contracts/components.md row 1).
 * Unit tests: tests/unit/design/forms.spec.tsx (T887).
 */
import type { ButtonHTMLAttributes, ReactElement } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * T920, parity row 7 — the prototype's four weights. `secondary` is its
   * bare `.btn`: a bordered surface control, and the one most page actions
   * actually want. `primary` stays the accent-filled one and stays the
   * default, so no existing caller changes meaning; a page that wants the
   * prototype's restraint now has a way to ask for it. `ghost` is
   * borderless — a control that reads as text until you reach it.
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps): ReactElement {
  const classes = ['ds-button', `ds-button--${variant}`, loading ? 'ds-button--loading' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {children}
      {loading && <span className="ds-button__spinner" aria-hidden="true" />}
    </button>
  );
}
