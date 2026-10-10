import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/** Native modal supplies focus containment, Escape, and focus restoration. */
export function Dialog({ label, onClose, children, className = '' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      dialog?.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog ref={ref} aria-label={label} onCancel={event => { event.preventDefault(); onClose(); }}
      className={`app-dialog ${className}`}>
      {children}
    </dialog>, document.body
  );
}
