'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const TOAST_STYLES = {
  success: {
    defaultTitle: 'Berhasil',
    bar: 'bg-emerald-500',
    border: 'border-emerald-200',
    surface: 'bg-white',
    iconBg: 'bg-emerald-50 text-emerald-700',
    Icon: CheckCircle2,
    role: 'status',
  },
  error: {
    defaultTitle: 'Terjadi Kendala',
    bar: 'bg-red-500',
    border: 'border-red-200',
    surface: 'bg-white',
    iconBg: 'bg-red-50 text-red-700',
    Icon: AlertCircle,
    role: 'alert',
  },
  warning: {
    defaultTitle: 'Perhatian',
    bar: 'bg-amber-500',
    border: 'border-amber-200',
    surface: 'bg-white',
    iconBg: 'bg-amber-50 text-amber-700',
    Icon: AlertTriangle,
    role: 'status',
  },
  info: {
    defaultTitle: 'Informasi',
    bar: 'bg-[#3243DD]',
    border: 'border-[#3243DD]/25',
    surface: 'bg-[#F8FAFF]',
    iconBg: 'bg-[#EEF1FD] text-[#3243DD]',
    Icon: Info,
    role: 'status',
  },
};

const NOOP_TOAST = {
  pushToast: () => null,
  success: () => null,
  error: () => null,
  warning: () => null,
  info: () => null,
  dismiss: () => {},
};

const ToastContext = createContext(NOOP_TOAST);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const nextIdRef = useRef(1);

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (type, text, options = {}) => {
      if (!text || typeof text !== 'string') return null;
      const safeType = TOAST_STYLES[type] ? type : 'info';
      const id = nextIdRef.current++;
      const duration =
        typeof options.duration === 'number'
          ? options.duration
          : safeType === 'error' || safeType === 'warning'
          ? 6500
          : 4500;
      const timeLabel = new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());

      setToasts((prev) => [
        ...prev.slice(-3),
        {
          id,
          type: safeType,
          text,
          title: options.title || null,
          timeLabel,
        },
      ]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          timersRef.current.delete(id);
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    []
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      pushToast,
      dismiss,
      success: (text, options) => pushToast('success', text, options),
      error: (text, options) => pushToast('error', text, options),
      warning: (text, options) => pushToast('warning', text, options),
      info: (text, options) => pushToast('info', text, options),
    }),
    [pushToast, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 w-[calc(100vw-2rem)] sm:w-96 pointer-events-none"
        >
          {toasts.map((toast) => {
            const cfg = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
            const Icon = cfg.Icon;
            const headingText = toast.title || cfg.defaultTitle;
            return (
              <div
                key={toast.id}
                role={cfg.role}
                className={`pointer-events-auto relative overflow-hidden rounded-xl border ${cfg.border} ${cfg.surface} shadow-lg flex items-start gap-3 p-3.5 pl-4`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-1 ${cfg.bar}`}
                />
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 text-xs sm:text-sm">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="font-semibold text-slate-900 text-xs">{headingText}</p>
                    <span className="text-[10px] font-medium text-slate-400 tabular-nums shrink-0">
                      {toast.timeLabel}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-snug break-words text-xs sm:text-sm">
                    {toast.text}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] cursor-pointer shrink-0"
                  aria-label="Tutup notifikasi"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext) || NOOP_TOAST;
}
