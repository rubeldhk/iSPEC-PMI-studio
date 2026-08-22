/**
 * T891 (EPIC-029) — TextInput, built on `<input>` (D-42). The error state is
 * `aria-invalid`; the announced message belongs to FormField (FR-DS-021).
 * Unit tests: tests/unit/design/forms.spec.tsx (T887).
 */
import type { InputHTMLAttributes, ReactElement } from 'react';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ invalid = false, className, type = 'text', ...rest }: TextInputProps): ReactElement {
  return (
    <input
      {...rest}
      type={type}
      className={['ds-input', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={invalid || rest['aria-invalid'] || undefined}
    />
  );
}
