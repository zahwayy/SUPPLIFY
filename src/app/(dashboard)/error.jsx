'use client';

import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';

export default function DashboardError({ reset }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-md w-full rounded-xl bg-white border border-slate-200 p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Halaman Belum Dapat Dimuat
        </h2>
        <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
          Terjadi kendala saat mengambil data operasional. Silakan coba muat ulang
          halaman atau kembali ke dashboard.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <Button variant="primary" onClick={() => reset?.()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Coba Muat Ulang
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
