'use client';

import { AlertTriangle, Archive, Trash2 } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Dialog from '../ui/Dialog.jsx';

export default function DeleteProductDialog({
  product,
  open,
  loading = false,
  error = null,
  onClose,
  onConfirm,
  onSwitchToArchive = null,
}) {
  const hasStock = product?.stock !== null && product?.stock !== undefined;
  const numericStock = Number(product?.stock || 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Hapus Produk?"
      confirmLabel="Hapus Produk"
      cancelLabel="Batal"
      confirmVariant="danger"
      loading={loading}
      confirmDisabled={Boolean(error)}
    >
      <div className="space-y-3.5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-200/80 flex items-center justify-center shrink-0">
            <Trash2 className="h-5 w-5 text-red-600" aria-hidden="true" />
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.
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

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3.5 space-y-2.5 text-xs text-red-800 leading-relaxed"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p>{error}</p>
            </div>
            {onSwitchToArchive && !product?.deleted_at && (
              <Button
                type="button"
                variant="warning-outline"
                size="sm"
                onClick={() => onSwitchToArchive(product)}
                disabled={loading}
              >
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                Arsipkan Produk Sebagai Alternatif
              </Button>
            )}
          </div>
        ) : numericStock > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 leading-relaxed">
            <strong>Perhatian:</strong> Produk ini masih memiliki stok sebanyak{' '}
            <strong>
              {product.stock} {product.unit || 'unit'}
            </strong>
            . Produk dengan stok aktif atau riwayat transaksi akan ditolak untuk penghapusan
            permanen demi menjaga integritas data gudang.
          </div>
        ) : (
          <p className="text-xs text-slate-500 leading-relaxed">
            Penghapusan permanen hanya diizinkan jika produk belum pernah digunakan pada
            Purchase Order, transaksi gudang, atau pergerakan stok.
          </p>
        )}
      </div>
    </Dialog>
  );
}
