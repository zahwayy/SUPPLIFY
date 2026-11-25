import Link from 'next/link';
import { Card, CardContent } from '../ui/Card.jsx';

export default function StatCard({
  label,
  value = '—',
  helper = '',
  icon: Icon = null,
  tone = 'primary',
  surface = 'default',
  href = null,
  onClick = null,
  active = false,
}) {
  const isPrimarySurface = surface === 'primary';

  const iconBg = isPrimarySurface
    ? 'bg-white/15 text-white'
    : tone === 'accent'
    ? 'bg-[#FFF0F6] text-[#C81D67]'
    : tone === 'warning'
    ? 'bg-amber-100/80 text-amber-800'
    : tone === 'danger'
    ? 'bg-red-100/80 text-red-700'
    : tone === 'success'
    ? 'bg-emerald-100/80 text-emerald-700'
    : tone === 'neutral'
    ? 'bg-slate-200/70 text-slate-700'
    : surface === 'soft-blue'
    ? 'bg-white text-[#3243DD] border border-[#3243DD]/15'
    : 'bg-[#EEF1FD] text-[#3243DD]';

  const interactiveCls =
    href || onClick
      ? isPrimarySurface
        ? 'transition-all hover:bg-[#2635BC] cursor-pointer'
        : 'transition-all hover:border-[#3243DD]/45 hover:shadow-sm cursor-pointer'
      : '';
  const activeCls = active
    ? 'border-[#3243DD] ring-2 ring-[#3243DD]/20 bg-[#EEF1FD]/45'
    : '';

  const content = (
    <Card
      variant={surface}
      className={`h-full ${interactiveCls} ${activeCls}`}
    >
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`text-xs font-medium truncate ${
              isPrimarySurface ? 'text-white/80' : 'text-slate-600'
            }`}
          >
            {label}
          </p>
          <p
            className={`mt-1.5 text-2xl font-bold tracking-tight tabular-nums ${
              isPrimarySurface ? 'text-white' : 'text-slate-900'
            }`}
          >
            {value}
          </p>
          {helper && (
            <p
              className={`mt-1 text-xs leading-snug ${
                isPrimarySurface ? 'text-white/80' : 'text-slate-500'
              }`}
            >
              {helper}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] focus-visible:ring-offset-1"
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] focus-visible:ring-offset-1"
      >
        {content}
      </button>
    );
  }

  return content;
}
