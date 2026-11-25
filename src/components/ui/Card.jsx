const CARD_VARIANTS = {
  default: 'bg-white border-slate-200/90 text-slate-900',
  'soft-blue': 'bg-[#EEF1FD]/65 border-[#3243DD]/20 text-slate-900',
  'soft-pink': 'bg-[#FFF0F6]/70 border-[#FF3D8B]/25 text-slate-900',
  neutral: 'bg-[#F8FAFC] border-slate-200/90 text-slate-900',
  primary: 'bg-[#3243DD] border-[#2635BC] text-white',
};

export function Card({
  children,
  className = '',
  highlight = false,
  variant = 'default',
}) {
  const effectiveVariant =
    variant !== 'default' ? variant : highlight ? 'soft-blue' : 'default';
  const variantCls = CARD_VARIANTS[effectiveVariant] || CARD_VARIANTS.default;
  const ringCls =
    highlight && effectiveVariant !== 'primary' ? 'ring-1 ring-[#3243DD]/12' : '';

  return (
    <div
      className={`min-w-0 rounded-xl border shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${variantCls} ${ringCls} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-4 sm:px-5 py-3.5 border-b border-slate-200/60 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h2 className={`text-sm sm:text-base font-semibold leading-snug ${className}`}>
      {children}
    </h2>
  );
}

export function CardDescription({ children, className = '' }) {
  return (
    <p className={`mt-0.5 text-xs sm:text-sm text-slate-500 ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '' }) {
  return <div className={`p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return (
    <div
      className={`px-4 sm:px-5 py-3.5 border-t border-slate-200/60 bg-slate-50/70 rounded-b-xl ${className}`}
    >
      {children}
    </div>
  );
}
