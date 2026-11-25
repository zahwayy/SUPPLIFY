import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button.jsx';

export default function Pagination({
  page = 1,
  totalPages = 1,
  onPageChange,
  className = '',
}) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <p className="text-xs sm:text-sm text-slate-600">
        Halaman <span className="font-semibold text-slate-900">{page}</span> dari{' '}
        <span className="font-semibold text-slate-900">{totalPages}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
          Sebelumnya
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange?.(page + 1)}
          aria-label="Halaman berikutnya"
        >
          Berikutnya
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
