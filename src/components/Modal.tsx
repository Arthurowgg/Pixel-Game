import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon, Key } from './Icon';
export function Modal({
  children,
  title,
  eyebrow,
  onClose,
  className = '',
  wide = false,
  dismissible = true,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  className?: string;
  wide?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const backdrop = ref.current?.parentElement;
    const background = Array.from(backdrop?.parentElement?.children || []).filter(
      (element) => element !== backdrop,
    ) as HTMLElement[];
    const wasInert = background.map((element) => element.inert);
    const wasHidden = background.map((element) => element.getAttribute('aria-hidden'));
    const previousOverflow = document.body.style.overflow;
    background.forEach((element) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = 'hidden';
    const focusables = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input, select, textarea, [tabindex="0"]',
        ) || [],
      );
    (focusables().find((el) => el.hasAttribute('data-autofocus')) || focusables()[0] || ref.current)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (dismissible) closeRef.current();
      }
      if (event.key === 'Tab') {
        const items = focusables(),
          first = items[0],
          last = items[items.length - 1];
        if (!first) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      background.forEach((element, index) => {
        element.inert = wasInert[index];
        if (wasHidden[index] === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', wasHidden[index]!);
      });
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [dismissible]);
  return (
    <div
      className={`modal-overlay ${className}`}
      onPointerDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal-panel ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        ref={ref}
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id={id}>{title}</h2>
          </div>
          {dismissible && (
            <button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog">
              <Icon name="close" size={16} />
            </button>
          )}
        </header>
        {children}
        {dismissible && (
          <div className="modal-bottom-hint">
            <Key>ESC</Key> back to the woods
          </div>
        )}
      </div>
    </div>
  );
}
