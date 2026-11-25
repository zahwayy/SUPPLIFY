import { Loader2 } from 'lucide-react';

const VARIANT_CLASSES = {
  primary:
    'bg-[#3243DD] text-white hover:bg-[#2635BC] focus-visible:ring-[#3243DD]/40 shadow-[0_1px_2px_rgba(50,67,221,0.2)]',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 focus-visible:ring-slate-300',
  'accent-outline':
    'bg-white text-[#D6246C] border border-[#FF3D8B]/60 hover:bg-[#FFF0F6] hover:border-[#FF3D8B] focus-visible:ring-[#FF3D8B]/30',
  accent:
    'bg-[#FF3D8B] text-white hover:bg-[#E02C75] focus-visible:ring-[#FF3D8B]/40 shadow-[0_1px_2px_rgba(255,61,139,0.2)]',
  warning:
    'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500/40 shadow-[0_1px_2px_rgba(217,119,6,0.2)]',
  'warning-outline':
    'bg-white text-amber-800 border border-amber-300 hover:bg-amber-50 hover:border-amber-400 focus-visible:ring-amber-400/35',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40 shadow-[0_1px_2px_rgba(220,38,38,0.2)]',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-300',
};

const SIZE_CLASSES = {
  sm: 'min-h-[32px] px-3 text-xs rounded-lg gap-1.5',
  md: 'min-h-[38px] px-4 text-sm rounded-lg gap-2',
  lg: 'min-h-[44px] px-5 text-sm rounded-xl gap-2',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  const variantCls = VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary;
  const sizeCls = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center whitespace-nowrap font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-55 disabled:cursor-not-allowed ${variantCls} ${sizeCls} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}
