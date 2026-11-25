'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  open,
  onClose,
  title,
  description = '',
  children,
  footer = null,
  maxWidthClass = 'max-w-lg',
}) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  function isOutsideBoundingBox(e, dialog) {
    const rect = dialog.getBoundingClientRect();
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  }

  function handlePointerDown(e) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) {
      return;
    }
    pressedOutsideRef.current = isOutsideBoundingBox(e, dialog);
  }

  function handlePointerUp(e) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) {
      return;
    }
    if (pressedOutsideRef.current && isOutsideBoundingBox(e, dialog)) {
      onClose?.();
    }
    pressedOutsideRef.current = false;
  }

  function handleCancel(e) {
    e.preventDefault();
    onClose?.();
  }

  function handleNativeClose() {
    if (open) {
      onClose?.();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' })}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className={`m-auto w-[calc(100%-1.5rem)] ${maxWidthClass} max-h-[90vh] open:flex flex-col rounded-xl bg-white p-0 text-left text-slate-900 border border-slate-200 shadow-xl overflow-hidden`}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200/70 bg-[#F4F5F8]/60 shrink-0">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="text-base font-semibold text-slate-900"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onClose?.()}
          className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] transition-colors cursor-pointer shrink-0"
          aria-label="Tutup dialog"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-5 overflow-y-auto flex-1">{children}</div>

      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-200/70 bg-[#F4F5F8]/70 shrink-0">
          {footer}
        </div>
      )}
    </dialog>
  );
}
