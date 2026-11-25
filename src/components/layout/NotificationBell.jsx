'use client';

import { useEffect, useId, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, ExternalLink } from 'lucide-react';
import { formatDateTime } from '../../lib/utils/format.js';
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '../../modules/notifications/notificationActions.js';

export default function NotificationBell({ notifications = [], unreadCount = 0 }) {
  const router = useRouter();
  const uid = useId();
  const popoverId = `header-notifications-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [isPending, startTransition] = useTransition();

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
        const panelWidth = panelRect.width || 360;
        const panelHeight = panelRect.height || 320;
        const gap = 8;

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

  function handleSelectNotification(item) {
    panelRef.current?.hidePopover?.();
    startTransition(async () => {
      if (!item.is_read) {
        await markNotificationReadAction(item.id);
      }
      if (item.href) {
        router.push(item.href);
      }
      router.refresh();
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={popoverId}
        aria-label={
          unreadCount > 0 ? `Notifikasi (${unreadCount} belum dibaca)` : 'Notifikasi'
        }
        title="Notifikasi"
        className="relative inline-flex items-center justify-center min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-[#EEF1FD]/70 hover:text-[#3243DD] hover:border-[#3243DD]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] transition-colors cursor-pointer"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3D8B] text-white text-[10px] font-bold leading-none flex items-center justify-center tabular-nums shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <div
        ref={panelRef}
        id={popoverId}
        popover="auto"
        className="supplify-action-popover w-[calc(100vw-1.5rem)] sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden text-left"
      >
        <div className="flex flex-col max-h-[420px]">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-[#F4F5F8]/70 shrink-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Notifikasi
              </p>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#EEF1FD] px-2 py-0.5 text-[11px] font-semibold text-[#3243DD] tabular-nums">
                  {unreadCount} baru
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-[#3243DD] hover:bg-[#EEF1FD] disabled:opacity-50 transition-colors cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100">
            {notifications.length > 0 ? (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSelectNotification(item)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer disabled:opacity-60 ${
                    item.is_read
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-[#EEF1FD]/40 hover:bg-[#EEF1FD]/70'
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                      item.is_read ? 'bg-slate-300' : 'bg-[#3243DD]'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900 leading-snug">
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                        {formatDateTime(item.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed break-words">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-2 pt-0.5 text-[11px] font-semibold text-[#3243DD]">
                      {item.href ? (
                        <span className="inline-flex items-center gap-1">
                          Buka halaman terkait
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </span>
                      ) : !item.is_read ? (
                        <span className="inline-flex items-center gap-1">
                          Tandai dibaca
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-6 w-6 text-slate-300" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium text-slate-600">
                  Belum ada notifikasi saat ini.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
