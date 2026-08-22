/**
 * T893 (EPIC-029) — Modal, built on `<dialog>` (D-42): showModal() gives the
 * focus trap, Escape-to-close and the inert backdrop natively. The component
 * adds what the platform does not: focus RESTORE to the opener on close, and
 * an explicit Escape handler so environments without full dialog support
 * (jsdom included) still close (contracts/components.md row 11).
 * Unit tests: tests/unit/design/structure.spec.tsx (T889).
 */
import { useEffect, useRef, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { ErrorState } from './ErrorState';
import { LoadingIndicator } from './LoadingIndicator';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  loading?: boolean;
  error?: string;
  errorAction?: string;
  children?: ReactNode;
}

export function Modal({
  open,
  title,
  onClose,
  loading = false,
  error,
  errorAction = 'Close and try again.',
  children,
}: ModalProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      restoreRef.current = document.activeElement as HTMLElement | null;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      dialog.focus();
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      restoreRef.current?.focus?.();
      restoreRef.current = null;
    }
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="ds-modal"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <p className="ds-modal__title">{title}</p>
      <div className="ds-modal__body">
        {loading ? (
          <LoadingIndicator label="Loading" />
        ) : error ? (
          <ErrorState message={error} action={errorAction} />
        ) : (
          children
        )}
      </div>
      <button type="button" className="ds-modal__close" onClick={onClose}>
        Close
      </button>
    </dialog>
  );
}
