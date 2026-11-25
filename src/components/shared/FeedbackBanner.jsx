'use client';

import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const STYLES = {
  success: {
    wrap: 'border-emerald-200 bg-emerald-50/90 text-emerald-950 border-l-4 border-l-emerald-500',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
    role: 'status',
  },
  error: {
    wrap: 'border-red-200 bg-red-50/90 text-red-950 border-l-4 border-l-red-500',
    icon: AlertCircle,
    iconColor: 'text-red-600',
    role: 'alert',
  },
  warning: {
    wrap: 'border-amber-200 bg-amber-50/90 text-amber-950 border-l-4 border-l-amber-500',
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    role: 'status',
  },
  info: {
    wrap: 'border-[#3243DD]/25 bg-[#EEF1FD]/85 text-slate-900 border-l-4 border-l-[#3243DD]',
    icon: Info,
    iconColor: 'text-[#3243DD]',
    role: 'status',
  },
};

export default function FeedbackBanner({ feedback, onDismiss }) {
  if (!feedback || !feedback.text) return null;

  const cfg = STYLES[feedback.type] || STYLES.info;
  const Icon = cfg.icon;

  return (
    <div
      role={cfg.role}
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${cfg.wrap}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.iconColor}`} aria-hidden="true" />
        <span className="leading-snug">{feedback.text}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-md opacity-70 hover:opacity-100 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] transition-opacity cursor-pointer shrink-0"
          aria-label="Tutup pemberitahuan"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
