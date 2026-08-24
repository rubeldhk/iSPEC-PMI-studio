/**
 * T891 (EPIC-029) — Select, built on `<select>` (D-42): native listbox
 * behaviour, no custom popup in Phase 1. Empty means no options to choose,
 * and the control says so instead of offering a blank dropdown.
 * Unit tests: tests/unit/design/forms.spec.tsx (T887).
 */
import { Children, type ReactElement, type SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  loading?: boolean;
  /** Shown as the sole, disabled option when there is nothing to choose. */
  emptyMessage?: string;
}

export function Select({
  invalid = false,
  loading = false,
  emptyMessage = 'No options available',
  disabled,
  className,
  children,
  ...rest
}: SelectProps): ReactElement {
  const empty = Children.count(children) === 0;
  return (
    <select
      {...rest}
      className={['ds-select', className ?? ''].filter(Boolean).join(' ')}
      disabled={disabled || loading || empty}
      aria-busy={loading || undefined}
      aria-invalid={invalid || undefined}
    >
      {empty ? <option value="">{emptyMessage}</option> : children}
    </select>
  );
}
