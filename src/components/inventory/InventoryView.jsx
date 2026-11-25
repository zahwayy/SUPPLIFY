'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Boxes,
  AlertTriangle,
  PackageX,
  CheckCircle2,
  Search,
  X,
  ClipboardList,
  Eye,
} from 'lucide-react';
import {
  getStockStatusMeta,
  STOCK_STATUS_FILTER_OPTIONS,
  STOCK_STATUS_META,
} from '../../lib/utils/labels.js';
import { formatCurrencyIDR } from '../../lib/utils/format.js';
import PageHeader from '../shared/PageHeader.jsx';
import StatCard from '../shared/StatCard.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Select from '../ui/Select.jsx';
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

export default function InventoryView({
  overview,
  categories,
  initialFilters,
  canCreatePo = false,
  embedded = false,
  basePath = '/inventory',
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [categoryId, setCategoryId] = useState(
    initialFilters.categoryId ? String(initialFilters.categoryId) : ''
  );
  const [stockStatus, setStockStatus] = useState(initialFilters.stockStatus || '');

  const hasActiveFilters = Boolean(
    initialFilters.search || initialFilters.categoryId || initialFilters.stockStatus
  );

  function pushFilters(overrides = {}) {
    const next = { search, categoryId, stockStatus, page: 1, ...overrides };
    const params = new URLSearchParams();
    if (embedded) params.set('tab', 'summary');
    if (next.search?.trim()) params.set('search', next.search.trim());
    if (next.categoryId) params.set('categoryId', String(next.categoryId));
    if (next.stockStatus) params.set('stockStatus', next.stockStatus);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function resetFilters() {
    setSearch('');
    setCategoryId('');
    setStockStatus('');
    router.push(embedded ? `${basePath}?tab=summary` : basePath);
  }

  function toggleStatusCard(nextStatus) {
    const target = stockStatus === nextStatus ? '' : nextStatus;
    setStockStatus(target);
    pushFilters({ stockStatus: target });
  }

  const s = overview.summary || {};

  return (
    <div className="space-y-5">
      {!embedded ? (
        <PageHeader
          title="Inventaris"
          description="Pantau kondisi ketersediaan stok aktual per produk, lokasi rak, dan batas stok minimum."
          actions={
            canCreatePo ? (
              <Link
                href="/restock-orders"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3243DD] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors"
              >
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                Buat PO Restock
              </Link>
            ) : null
          }
        />
      ) : canCreatePo ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs sm:text-sm text-slate-600">
            Pantau kondisi ketersediaan stok aktual per produk, lokasi rak, dan batas
            stok minimum.
          </p>
          <Link
            href="/restock-orders"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3243DD] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors shrink-0 self-start sm:self-auto"
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Buat PO Restock
          </Link>
        </div>
      ) : null}

      {/* Kartu Ringkasan Kondisi Stok 4 Tingkat */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          label="Total Produk"
          value={s.total_products ?? 0}
          helper={`${s.total_stock_units ?? 0} unit • Nilai: ${formatCurrencyIDR(s.estimated_inventory_value)}`}
          icon={Boxes}
          surface="soft-blue"
          active={!stockStatus}
          onClick={() => toggleStatusCard('')}
        />
        <StatCard
          label={STOCK_STATUS_META.Normal.label}
          value={s.normal_stock_count ?? 0}
          helper={
            s.unconfigured_min_count > 0
              ? `${s.unconfigured_min_count} belum atur batas`
              : 'Stok dalam kondisi aman'
          }
          icon={CheckCircle2}
          tone="success"
          active={stockStatus === 'normal'}
          onClick={() => toggleStatusCard('normal')}
        />
        <StatCard
          label={STOCK_STATUS_META.Low.label}
          value={s.low_stock_count ?? 0}
          helper="Mendekati batas stok minimum"
          icon={AlertTriangle}
          tone="warning"
          active={stockStatus === 'low'}
          onClick={() => toggleStatusCard('low')}
        />
        <StatCard
          label={STOCK_STATUS_META.Severe.label}
          value={s.severe_stock_count ?? 0}
          helper="Di bawah atau sama dengan batas minimum"
          icon={AlertTriangle}
          tone="danger"
          surface={(s.severe_stock_count ?? 0) > 0 ? 'soft-pink' : 'default'}
          active={stockStatus === 'severe'}
          onClick={() => toggleStatusCard('severe')}
        />
        <StatCard
          label={STOCK_STATUS_META['Out of Stock'].label}
          value={s.out_of_stock_count ?? 0}
          helper="Perlu segera restock"
          icon={PackageX}
          tone="neutral"
          active={stockStatus === 'out_of_stock'}
          onClick={() => toggleStatusCard('out_of_stock')}
        />
      </div>

      {/* Bilah Pencarian & Pilihan Filter */}
      <Card variant="neutral">
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pushFilters();
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-2 lg:col-span-6">
              <label
                htmlFor="inv-search"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Cari SKU / Produk
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="inv-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari SKU atau nama produk..."
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
                    title="Reset pencarian"
                    aria-label="Reset pencarian"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>

            <div className="lg:col-span-3">
              <Select
                label="Kategori"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  pushFilters({ categoryId: e.target.value });
                }}
                placeholder="Semua Kategori"
                options={categories.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                }))}
              />
            </div>

            <div className="lg:col-span-3">
              <Select
                label="Kondisi Stok"
                value={stockStatus}
                onChange={(e) => {
                  setStockStatus(e.target.value);
                  pushFilters({ stockStatus: e.target.value });
                }}
                placeholder="Semua Status"
                options={STOCK_STATUS_FILTER_OPTIONS}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {overview.items.length > 0 ? (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden md:table-cell">SKU</TableHead>
                <TableHead>Nama Produk</TableHead>
                <TableHead className="hidden md:table-cell">Kategori</TableHead>
                <TableHead>Stok Tersedia</TableHead>
                <TableHead className="hidden lg:table-cell">Min / Rendah</TableHead>
                <TableHead className="hidden lg:table-cell">Lokasi Rak</TableHead>
                <TableHead>Status Stok</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.items.map((item) => {
                const statusMeta = getStockStatusMeta(item.stock_status);
                const needsRestock = ['Out of Stock', 'Severe', 'Low'].includes(
                  item.stock_status
                );

                return (
                  <TableRow key={item.id}>
                    <TableCell className="hidden md:table-cell font-mono text-xs font-semibold text-[#3243DD] whitespace-nowrap">
                      <Link href={`/products/${item.id}`} className="hover:underline">
                        {item.sku}
                      </Link>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      <Link
                        href={`/products/${item.id}`}
                        className="hover:text-[#3243DD]"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-0.5 text-[11px] font-normal text-slate-500 md:hidden">
                        <span className="font-mono font-semibold text-[#3243DD]">{item.sku}</span>
                        {' • '}
                        {item.category_name}
                        {item.rack_location ? ` • Rak: ${item.rack_location}` : ''}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-slate-600">
                      {item.category_name}
                    </TableCell>
                    <TableCell className="font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      <span
                        className={
                          item.stock_status === 'Out of Stock'
                            ? 'text-slate-600'
                            : item.stock_status === 'Severe'
                            ? 'text-red-700'
                            : item.stock_status === 'Low'
                            ? 'text-amber-700'
                            : 'text-slate-900'
                        }
                      >
                        {item.stock}
                      </span>{' '}
                      <span className="text-xs font-normal text-slate-500">
                        {item.unit || ''}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-slate-600 tabular-nums">
                      {item.minimum_stock !== null ? item.minimum_stock : '—'}
                      {item.low_stock_threshold !== null &&
                      item.low_stock_threshold !== undefined
                        ? ` / ${item.low_stock_threshold}`
                        : ''}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-slate-600">
                      {item.rack_location || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/products/${item.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-[#3243DD] hover:text-[#3243DD] transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          Detail
                        </Link>
                        {canCreatePo && needsRestock && (
                          <Link
                            href={`/restock-orders?productId=${item.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#3243DD] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#2635BC] transition-colors"
                          >
                            Restock
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Pagination
            page={overview.page}
            totalPages={overview.totalPages}
            onPageChange={(nextPage) => pushFilters({ page: nextPage })}
          />
        </div>
      ) : (
        <EmptyState
          icon={Boxes}
          title={
            hasActiveFilters
              ? 'Tidak Ada Produk yang Cocok'
              : 'Belum Ada Data Persediaan'
          }
          description={
            hasActiveFilters
              ? 'Coba ubah status stok atau kata kunci pencarian Anda.'
              : 'Produk beserta jumlah stok gudang akan tampil di halaman ini.'
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
