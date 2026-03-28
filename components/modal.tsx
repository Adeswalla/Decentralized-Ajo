'use client';

import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** When true, clicking the backdrop does not close the modal */
  disableBackdropClose?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
};

/**
 * Generic modal: portals to `document.body`, semi-transparent backdrop, focus trap, Escape to close.
 */
export function Modal({
  isOpen,
  onClose,
  children,
  className,
  disableBackdropClose = false,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeyDown);
    const t = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const trapFocus = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const list = [...focusable].filter((el) => !el.hasAttribute('disabled'));
    if (list.length === 0) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close dialog"
        onClick={() => {
          if (!disableBackdropClose) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabelledBy ? undefined : 'Dialog'}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className={cn(
          'bg-background border border-border shadow-lg fixed left-1/2 top-1/2 z-[51] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg p-6 outline-none',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
