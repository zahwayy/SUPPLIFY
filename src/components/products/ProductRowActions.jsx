'use client';

import { useEffect, useId, useRef } from 'react';
import { Archive, MoreVertical, Trash2 } from 'lucide-react';

export default function ProductRowActions({
  product,
  disabled = false,
  canArchive = false,
  canDelete = false,
  onArchive,
  onDelete,
}) {
  const uid = useId();
  const popoverId = `product-actions-${product.id}-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!panel || !trigger) return;

    const handleToggle = (e) => {
      const supportsAnchor =
        typeof CSS !== 'undefined' && CSS.supports('position-area: block-end');
      if (supportsAnchor) return;

      if (e.newState === 'open') {
        const triggerRect = trigger.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const panelWidth = panelRect.width || 192;
        const panelHeight = panelRect.height || 88;
        const gap = 6;

        let top = triggerRect.bottom + gap;
        if (
          top + panelHeight > window.innerHeight - 8 &&
          triggerRect.top - panelHeight - gap >= 8
        ) {
          top = triggerRect.top - panelHeight - gap;
        }
        top = Math.max(8, Math.min(top, window.innerHeight - panelHeight - 8));

        let left = triggerRect.right - panelWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));

        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
      } else {
        panel.style.top = '';
        panel.style.left = '';
      }
    };

    panel.addEventListener('toggle', handleToggle);
    return () => panel.removeEventListener('toggle', handleToggle);
  }, []);

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={popoverId}
        disabled={disabled}
        aria-label={`Tindakan lainnya untuk ${product.name}`}
        title="Tindakan lainnya"
        className="inline-flex items-center justify-center min-h-[32px] min-w-[32px] rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-[#F4F5F8] hover:text-slate-900 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      <div
        ref={panelRef}
        id={popoverId}
        popover="auto"
        className="supplify-action-popover w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg text-left"
      >
        {canArchive && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              panelRef.current?.hidePopover?.();
              onArchive?.(product);
            }}
            className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-amber-800 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Archive className="h-3.5 w-3.5 text-amber-700 shrink-0" aria-hidden="true" />
            <span>Arsipkan Produk</span>
          </button>
        )}

        {canArchive && canDelete && <hr className="my-1 border-slate-100" />}

        {canDelete && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              panelRef.current?.hidePopover?.();
              onDelete?.(product);
            }}
            className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-600 shrink-0" aria-hidden="true" />
            <span>Hapus Permanen</span>
          </button>
        )}
      </div>
    </div>
  );
}
