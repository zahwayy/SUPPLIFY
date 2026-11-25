export default function Tooltip({ content, children, className = '' }) {
  return (
    <span className={`group relative inline-flex items-center ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
