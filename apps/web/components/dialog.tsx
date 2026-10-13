'use client';
import { useEffect, useId, useRef } from 'react';
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
  dismissible = true,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="portal-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy && dismissible) onClose();
      }}
    >
      <header className="dialog-header">
        <h2 id={id}>{title}</h2>
        {dismissible && (
          <button
            type="button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        )}
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
