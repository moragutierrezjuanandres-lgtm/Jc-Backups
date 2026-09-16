import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

/**
 * Modal – renders children into document.body via a React Portal.
 * This guarantees position:fixed overlays are always centered on the
 * real viewport, regardless of any CSS transform on ancestor elements.
 *
 * Props:
 *   onClose  – called when the backdrop is clicked
 *   children – the modal content (modal-content div, etc.)
 *   maxWidth – optional max-width for the content box (default 520px)
 */
export default function Modal({ onClose, children, maxWidth = '520px' }) {
  const panel = useRef(null);
  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...(panel.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]') || [])].filter(e => e.offsetParent !== null);
    (focusable()[0] || panel.current)?.focus();
    const handleKey = e => {
      if(e.key === 'Escape') {e.preventDefault();e.stopPropagation();onClose?.();}
      if(e.key === 'Tab') {const items=focusable(),first=items[0],last=items[items.length-1];if(!items.length){e.preventDefault();return;}if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}}
    };
    const element=panel.current;
    element?.addEventListener('keydown',handleKey);
    return () => { document.body.style.overflow = prev; element?.removeEventListener('keydown',handleKey);previousFocus?.focus(); };
  }, []);

  return ReactDOM.createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ padding: '16px' }}
    >
      <div
        className="modal-content"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Formulario del portal"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
