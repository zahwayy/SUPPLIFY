const TONE_CLASSES = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  primary: 'bg-[#EEF1FD] text-[#3243DD] border-[#3243DD]/20',
  accent: 'bg-[#FFF0F6] text-[#C81D67] border-[#FF3D8B]/25',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
};

export default function Badge({
  children,
  tone = 'neutral',
  icon: Icon = null,
  className = '',
}) {
  const toneCls = TONE_CLASSES[tone] || TONE_CLASSES.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneCls} ${className}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}
