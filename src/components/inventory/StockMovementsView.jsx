'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { History, Search, X, ArrowUpRight } from 'lucide-react';
import { formatDateTime } from '../../lib/utils/format.js';
import {
  getMovementSourceHref,
  getMovementTypeMeta,
} from '../../lib/utils/labels.js';
import PageHeader from '../shared/PageHeader.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Pagination from '../ui/Pagination.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { Card, CardContent } from '../ui/Card.jsx';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table.jsx';

const FILTER_TABS = [
  { value: '', label: 'Semua' },
  { value: 'in', label: 'Barang Masuk (+)' },
  { value: 'out', label: 'Barang Keluar (-)' },
  { value: 'adjustment_in', label: 'Penyesuaian (+)' },
  { value: 'adjustment_out', label: 'Penyesuaian (-)' },
];

export default function StockMovementsView({
  ledger,
  initialFilters,
  embedded = false,
  basePath = '/stock-movements',
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [movementType, setMovementType] = useState(initialFilters.movementType || '');

  const hasActiveFilters = Boolean(
    initialFilters.search || initialFilters.movementType
  );

  function pushFilters(overrides = {}) {
    const next = { search, movementType, page: 1, ...overrides };
    const params = new URLSearchParams();
    if (embedded) params.set('tab', 'movements');
    if (next.search?.trim()) params.set('search', next.search.trim());
    if (next.movementType) params.set('movementType', next.movementType);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function resetFilters() {
    setSearch('');
    setMovementType('');
    router.push(embedded ? `${basePath}?tab=movements` : basePath);
  }

  return (
    <div className="space-y-5">
      {!embedded ? (
        <PageHeader
          title="Pergerakan Stok"
          description="Riwayat perubahan jumlah stok gudang yang tercatat otomatis ketika transaksi Barang Masuk, Barang Keluar, atau Penyesuaian Stok disetujui."
        />
      ) : (
        <p className="text-xs sm:text-sm text-slate-600">
          Riwayat perubahan jumlah stok gudang yang tercatat otomatis ketika transaksi
          Barang Masuk, Barang Keluar, atau Penyesuaian Stok disetujui.
        </p>
      )}

      <Card variant="neutral">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setMovementType(tab.value);
                    pushFilters({ movementType: tab.value });
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
                    movementType === tab.value
                      ? 'bg-[#3243DD] text-white border-[#3243DD]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#3243DD]/40 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                pushFilters();
              }}
              className="flex gap-2 w-full md:w-auto"
            >
              <div className="relative flex-1 md:w-64">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="SKU, produk, atau kode..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                />
              </div>
              <Button type="submit" variant="secondary">
                Cari
              </Button>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetFilters}
                  aria-label="Reset pencarian"
                  title="Reset pencarian"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </form>
          </div>
        </CardContent>
      </Card>

      {ledger.items.length > 0 ? (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden lg:table-cell">Waktu</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead className="hidden md:table-cell">Jenis Pergerakan</TableHead>
                <TableHead className="hidden md:table-cell">Sumber Transaksi</TableHead>
                <TableHead>Perubahan</TableHead>
                <TableHead className="hidden sm:table-cell">Sebelum → Sesudah</TableHead>
                <TableHead className="hidden lg:table-cell">Diproses Oleh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.items.map((row) => {
                const cfg = getMovementTypeMeta(row.movement_type);
                const sourceHref = getMovementSourceHref(row);
                const sourceLabel =
                  row.transaction_code || row.adjustment_code || row.source_type;

                return (
                  <TableRow key={row.id}>
                    <TableCell className="hidden lg:table-cell text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/products/${row.product_id}`}
                        className="font-semibold text-slate-900 hover:text-[#3243DD]"
                      >
                        {row.product_name}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">
                        {row.sku}
                        {row.rack_location ? (
                          <span className="ml-1.5 font-sans text-[11px]">
                            • Rak: {row.rack_location}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 md:hidden">
                        {cfg.label} • <span className="font-mono">{sourceLabel}</span>
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge tone={cfg.tone}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      {sourceHref ? (
                        <Link
                          href={sourceHref}
                          className="inline-flex items-center gap-1 font-semibold text-[#3243DD] hover:underline"
                        >
                          {sourceLabel}
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="text-slate-700">{sourceLabel}</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`font-bold tabular-nums whitespace-nowrap ${
                        row.quantity_delta > 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {row.quantity_delta > 0
                        ? `+${row.quantity_delta}`
                        : row.quantity_delta}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        {row.unit || ''}
                      </span>
                      <p className="mt-0.5 text-[11px] font-normal text-slate-500 sm:hidden">
                        {row.stock_before} → {row.stock_after}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs tabular-nums whitespace-nowrap">
                      {row.stock_before} →{' '}
                      <strong className="text-slate-900">{row.stock_after}</strong>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-slate-700">
                      {row.actor_name}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Pagination
            page={ledger.page}
            totalPages={ledger.totalPages}
            onPageChange={(nextPage) => pushFilters({ page: nextPage })}
          />
        </div>
      ) : (
        <EmptyState
          icon={History}
          title={
            hasActiveFilters
              ? 'Tidak Ada Pergerakan Stok yang Cocok'
              : 'Belum Ada Riwayat Pergerakan Stok'
          }
          description={
            hasActiveFilters
              ? 'Ubah pilihan jenis pergerakan atau kata kunci pencarian Anda.'
              : 'Riwayat pergerakan stok tercipta otomatis saat transaksi Barang Masuk, Barang Keluar, atau Penyesuaian Stok disetujui oleh Warehouse Manager.'
          }
          action={
            hasActiveFilters && (
              <Button variant="secondary" onClick={resetFilters}>
                Reset Pencarian
              </Button>
            )
          }
        />
      )}
    </div>
  );
}
