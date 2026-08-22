/**
 * T891 (EPIC-029) — FormField, built on `<label>` + `aria-describedby`
 * (D-42). Owns the label, the hint, and the error message ANNOUNCED to
 * assistive tech (FR-DS-021) — the control inside stays a bare primitive.
 * Unit tests: tests/unit/design/forms.spec.tsx (T887).
 */
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

export interface FormFieldProps {
  /** Becomes the control's id; label, hint and error derive theirs from it. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  /** A single form control (TextInput, Select, …) to wire up. */
  children: ReactNode;
}

export function FormField({ id, label, hint, error, disabled, children }: FormFieldProps): ReactElement {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-describedby': describedBy,
        ...(error ? { 'aria-invalid': true } : {}),
        ...(disabled === undefined ? {} : { disabled }),
      })
    : children;

  const classes = [
    'ds-field',
    disabled ? 'ds-field--disabled' : '',
    error ? 'ds-field--error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <label className="ds-field__label" htmlFor={id}>
        {label}
      </label>
      {hint && (
        <p className="ds-field__hint" id={hintId as string}>
          {hint}
        </p>
      )}
      {control}
      {error && (
        <p className="ds-field__error" id={errorId as string} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
