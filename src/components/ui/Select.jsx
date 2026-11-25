export default function Select({
  id,
  label,
  error = null,
  helperText = null,
  options = [],
  placeholder = '',
  required = false,
  className = '',
  children,
  ...props
}) {
  const selectId = id || props.name;
  const descId = error
    ? `${selectId}-error`
    : helperText
    ? `${selectId}-helper`
    : undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
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
      <select
        id={selectId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={descId}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-slate-300 focus:border-[#3243DD] focus:ring-[#3243DD]/20'
        } ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
        {children}
      </select>
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
