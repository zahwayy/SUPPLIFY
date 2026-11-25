'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Truck, Eye, Search, X } from 'lucide-react';
import { formatDate, formatDateTime } from '../../lib/utils/format.js';
import PageHeader from '../shared/PageHeader.jsx';
import StatusPill from '../shared/StatusPill.jsx';
import Button from '../ui/Button.jsx';
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

export default function ShipmentManager({
  title,
  description,
  shipments = [],
  emptyTitle = 'Belum Ada Data Pengiriman',
  emptyDescription = 'Purchase Order terkonfirmasi atau dalam pengiriman akan tampil di sini.',
}) {
  const [search, setSearch] = useState('');

  const normalizedQuery = search.trim().toLowerCase();
  const filtered = normalizedQuery
    ? shipments.filter((s) =>
        [s.po_code, s.courier_name, s.tracking_number, s.no_tracking_reason]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(normalizedQuery))
      )
    : shipments;

  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} />

      {shipments.length > 0 && (
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode PO, kurir, atau nomor resi..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearch('')}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Reset
                </Button>
              )}
              <span className="tabular-nums font-medium">
                Menampilkan {filtered.length} dari {shipments.length} pengiriman
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {filtered.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode PO</TableHead>
              <TableHead>Status PO</TableHead>
              <TableHead>Kurir / Ekspedisi</TableHead>
              <TableHead>Nomor Resi / Keterangan</TableHead>
              <TableHead>Waktu Kirim</TableHead>
              <TableHead>Estimasi Tiba</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => {
              const needsShipmentInfo =
                !s.shipment_id &&
                ['processing', 'confirmed', 'preparing'].includes(s.po_status);
              return (
                <TableRow key={s.po_id}>
                  <TableCell className="font-mono text-xs font-semibold text-[#3243DD] whitespace-nowrap">
                    <Link
                      href={`/purchase-orders/${s.po_id}`}
                      className="hover:underline"
                    >
                      {s.po_code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={s.po_status} />
                  </TableCell>
                  <TableCell className="text-xs font-medium text-slate-800">
                    {s.courier_name || (
                      <span className="text-amber-700 font-semibold">Belum diisi</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-700">
                    {s.tracking_number || s.no_tracking_reason || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {formatDateTime(s.shipped_at)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {formatDate(s.expected_arrival)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Link
                      href={`/purchase-orders/${s.po_id}`}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        needsShipmentInfo
                          ? 'bg-[#3243DD] text-white hover:bg-[#2635BC]'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-[#3243DD] hover:text-[#3243DD]'
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      {needsShipmentInfo ? 'Isi Pengiriman' : 'Detail PO'}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={Truck}
          title={search ? 'Pengiriman Tidak Ditemukan' : emptyTitle}
          description={
            search
              ? 'Tidak ada data pengiriman yang cocok dengan kata kunci pencarian.'
              : emptyDescription
          }
          action={
            search && (
              <Button variant="secondary" onClick={() => setSearch('')}>
                Reset Pencarian
              </Button>
            )
          }
        />
      )}
    </div>
  );
}
