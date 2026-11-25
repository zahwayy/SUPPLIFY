export default function Input({
  id,
  label,
  error = null,
  helperText = null,
  icon: Icon = null,
  required = false,
  className = '',
  ...props
}) {
  const inputId = id || props.name;
  const descId = error
    ? `${inputId}-error`
    : helperText
    ? `${inputId}-helper`
    : undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-[#FF3D8B]" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
        )}
        <input
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={descId}
          className={`w-full rounded-lg border bg-white py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 ${
            Icon ? 'pl-9 pr-3' : 'px-3'
          } ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-300 focus:border-[#3243DD] focus:ring-[#3243DD]/20'
          } ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p id={descId} className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={descId} className="mt-1 text-xs text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
}
