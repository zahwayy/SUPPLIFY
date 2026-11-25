import { Inbox } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Belum ada data',
  description = 'Data yang relevan akan ditampilkan di sini setelah tersedia.',
  action = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/90 bg-[#F4F5F8]/60 px-5 py-8 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF1FD] text-[#3243DD] border border-[#3243DD]/15">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-sm sm:text-base font-semibold text-slate-900">
        {title}
      </h3>
      <p className="mt-1 max-w-md text-xs sm:text-sm text-slate-600 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
