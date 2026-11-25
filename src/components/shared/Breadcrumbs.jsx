import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function Breadcrumbs({ items = [] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5">
              {idx > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 text-slate-400 shrink-0"
                  aria-hidden="true"
                />
              )}
              {!isLast && item.href ? (
                <Link
                  href={item.href}
                  className="font-medium text-slate-500 hover:text-[#3243DD] transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'font-semibold text-slate-800' : 'text-slate-500'}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
