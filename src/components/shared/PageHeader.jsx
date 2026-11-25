import Breadcrumbs from './Breadcrumbs.jsx';

export default function PageHeader({
  title,
  description = '',
  badge = null,
  actions = null,
  breadcrumbs = null,
}) {
  return (
    <div className="pb-4 border-b border-slate-200/90">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
