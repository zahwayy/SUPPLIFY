'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Search, X } from 'lucide-react';
import { formatDateTime } from '../../lib/utils/format.js';
import {
  formatAuditSummary,
  getAuditActionMeta,
  getAuditEntityLabel,
} from '../../lib/utils/labels.js';
import PageHeader from '../shared/PageHeader.jsx';
import RoleBadge from '../ui/RoleBadge.jsx';
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

export default function ActivityLogView({ logs, initialFilters }) {
  const router = useRouter();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [actorRole, setActorRole] = useState(initialFilters.actorRole || '');
  const [entityType, setEntityType] = useState(initialFilters.entityType || '');

  const hasActiveFilters = Boolean(
    initialFilters.search || initialFilters.actorRole || initialFilters.entityType
  );

  function pushFilters(overrides = {}) {
    const next = { search, actorRole, entityType, page: 1, ...overrides };
    const params = new URLSearchParams();
    if (next.search?.trim()) params.set('search', next.search.trim());
    if (next.actorRole) params.set('actorRole', next.actorRole);
    if (next.entityType) params.set('entityType', next.entityType);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    router.push(`/activity-log${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function resetFilters() {
    setSearch('');
    setActorRole('');
    setEntityType('');
    router.push('/activity-log');
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Log Aktivitas"
        description="Catatan riwayat aktivitas operasional, pengelolaan akun, verifikasi supplier, perubahan katalog, transaksi, dan persetujuan."
      />

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
                htmlFor="audit-search"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Cari Aksi / Aktor / Kata Kunci
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="audit-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama pengguna atau jenis aktivitas..."
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
              </div>
            </div>

            <div className="lg:col-span-3">
              <Select
                label="Peran Aktor"
                value={actorRole}
                onChange={(e) => {
                  setActorRole(e.target.value);
                  pushFilters({ actorRole: e.target.value });
                }}
                placeholder="Semua Peran"
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'manager', label: 'Warehouse Manager' },
                  { value: 'staff', label: 'Warehouse Staff' },
                  { value: 'supplier', label: 'Supplier' },
                ]}
              />
            </div>

            <div className="lg:col-span-3">
              <Select
                label="Modul"
                value={entityType}
                onChange={(e) => {
                  setEntityType(e.target.value);
                  pushFilters({ entityType: e.target.value });
                }}
                placeholder="Semua Modul"
                options={[
                  { value: 'user', label: 'Akun Pengguna' },
                  { value: 'supplier', label: 'Mitra Supplier' },
                  { value: 'category', label: 'Kategori' },
                  { value: 'product', label: 'Produk' },
                  { value: 'purchase_order', label: 'Pesanan Pembelian (PO)' },
                  { value: 'transaction', label: 'Barang Masuk / Keluar' },
                  { value: 'discrepancy_report', label: 'Selisih Stok' },
                  { value: 'stock_adjustment', label: 'Penyesuaian Stok' },
                  { value: 'evidence_file', label: 'Lampiran Bukti' },
                ]}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {logs.items.length > 0 ? (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden lg:table-cell">Waktu</TableHead>
                <TableHead>Aktor</TableHead>
                <TableHead className="hidden lg:table-cell">Peran</TableHead>
                <TableHead>Aktivitas</TableHead>
                <TableHead className="hidden md:table-cell">Modul</TableHead>
                <TableHead className="hidden sm:table-cell">Ringkasan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.items.map((log) => {
                const actionMeta = getAuditActionMeta(log.action);
                const summary = formatAuditSummary(log.new_state, log.metadata);

                return (
                  <TableRow key={log.id}>
                    <TableCell className="hidden lg:table-cell text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-900">
                      <span>{log.actor_name || 'Sistem'}</span>
                      <p className="mt-0.5 text-[11px] font-normal text-slate-500 lg:hidden">
                        {formatDateTime(log.created_at)}
                        <span className="md:hidden"> • {getAuditEntityLabel(log.entity_type)}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] font-normal text-slate-600 line-clamp-2 sm:hidden">
                        {summary}
                      </p>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {log.actor_role ? <RoleBadge role={log.actor_role} /> : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge tone={actionMeta.tone}>{actionMeta.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-medium text-slate-700 whitespace-nowrap">
                      {getAuditEntityLabel(log.entity_type)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-slate-600 max-w-md">
                      <span className="line-clamp-2">{summary}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Pagination
            page={logs.page}
            totalPages={logs.totalPages}
            onPageChange={(nextPage) => pushFilters({ page: nextPage })}
          />
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title={
            hasActiveFilters
              ? 'Tidak Ada Catatan Aktivitas yang Cocok'
              : 'Belum Ada Catatan Aktivitas'
          }
          description={
            hasActiveFilters
              ? 'Ubah pilihan peran, modul, atau kata kunci pencarian.'
              : 'Seluruh aktivitas pengelolaan akun, master data, dan transaksi operasional akan terekam otomatis di sini.'
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
