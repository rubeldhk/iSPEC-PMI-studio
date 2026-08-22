/**
 * T891 (EPIC-029) — Checkbox, built on `<input type="checkbox">` (D-42).
 * `indeterminate` is a property, not a state (contracts/components.md row 4).
 * Unit tests: tests/unit/design/forms.spec.tsx (T887).
 */
import type { InputHTMLAttributes, ReactElement } from 'react';

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Checkbox({ invalid = false, className, ...rest }: CheckboxProps): ReactElement {
  return (
    <input
      {...rest}
      type="checkbox"
      className={['ds-checkbox', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
    />
  );
}
