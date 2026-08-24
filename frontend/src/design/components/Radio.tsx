/**
 * T891 (EPIC-029) — Radio, built on `<input type="radio">`, grouped by `name`
 * (D-42). Unit tests: tests/unit/design/forms.spec.tsx (T887).
 */
import type { InputHTMLAttributes, ReactElement } from 'react';

export interface RadioProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Radio({ invalid = false, className, ...rest }: RadioProps): ReactElement {
  return (
    <input
      {...rest}
      type="radio"
      className={['ds-radio', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
    />
  );
}
