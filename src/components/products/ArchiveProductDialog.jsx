'use client';

import { Archive } from 'lucide-react';
import Dialog from '../ui/Dialog.jsx';

export default function ArchiveProductDialog({
  product,
  open,
  loading = false,
  onClose,
  onConfirm,
}) {
  const hasStock = product?.stock !== null && product?.stock !== undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Arsipkan Produk?"
      confirmLabel="Arsipkan Produk"
      cancelLabel="Batal"
      confirmVariant="warning"
      loading={loading}
    >
      <div className="space-y-3.5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
            <Archive className="h-5 w-5 text-amber-700" aria-hidden="true" />
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Produk ini akan diarsipkan dan tidak lagi ditampilkan pada daftar produk aktif,
            serta tidak dapat dipilih pada pesanan restock (PO) atau barang keluar baru.
            Histori transaksi dan pergerakan stok yang sudah tercatat tetap tersimpan.
          </p>
        </div>

        {product && (
          <div className="rounded-xl border border-slate-200/80 bg-[#F4F5F8] p-3.5 space-y-1.5">
            <p className="text-sm font-semibold text-slate-900 break-words">
              {product.name}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              {product.sku && (
                <span className="font-mono font-semibold text-[#3243DD]">
                  {product.sku}
                </span>
              )}
              {product.category_name && (
                <span className="text-slate-600">
                  Kategori: {product.category_name}
                </span>
              )}
              {hasStock && (
                <span className="tabular-nums text-slate-700 font-medium">
                  Stok: {product.stock} {product.unit || 'unit'}
                </span>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500 leading-relaxed">
          Anda dapat melanjutkan jika ingin mengarsipkan produk ini.
        </p>
      </div>
    </Dialog>
  );
}
