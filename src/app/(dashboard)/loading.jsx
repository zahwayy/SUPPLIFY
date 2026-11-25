export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Memuat halaman">
      <div className="pb-5 border-b border-slate-200 space-y-2">
        <div className="h-7 w-56 rounded-lg bg-slate-200" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-200/80" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-white border border-slate-200 p-4 space-y-2.5"
          >
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="h-7 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-xl bg-white border border-slate-200 p-5 space-y-3">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="h-10 w-full rounded bg-slate-100" />
        <div className="h-10 w-full rounded bg-slate-100" />
        <div className="h-10 w-full rounded bg-slate-100" />
      </div>
    </div>
  );
}
