export function Table({ children, className = '', ariaLabel = 'Tabel data' }) {
  return (
    <div
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD]"
    >
      <table className={`w-full border-collapse text-left text-sm ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '' }) {
  return (
    <thead
      className={`bg-[#F4F5F8] text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200/90 ${className}`}
    >
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '' }) {
  return (
    <tbody className={`divide-y divide-slate-100 text-slate-700 ${className}`}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '' }) {
  return (
    <tr className={`hover:bg-[#EEF1FD]/35 transition-colors ${className}`}>
      {children}
    </tr>
  );
}

export function TableHead({ children, scope = 'col', className = '' }) {
  return (
    <th
      scope={scope}
      className={`px-3 py-2.5 sm:px-4 sm:py-3 font-semibold whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className = '' }) {
  return (
    <td className={`px-3 py-2.5 sm:px-4 sm:py-3 align-middle ${className}`}>
      {children}
    </td>
  );
}
