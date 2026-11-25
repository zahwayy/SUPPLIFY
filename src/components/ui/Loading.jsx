import { Loader2 } from 'lucide-react';

export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };
  return (
    <Loader2
      className={`animate-spin text-[#3243DD] ${sizes[size] || sizes.md} ${className}`}
      aria-label="Memuat"
    />
  );
}

export default function Loading({ label = 'Memuat data...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Spinner size="lg" />
      <p className="mt-3 text-sm text-slate-600">{label}</p>
    </div>
  );
}
