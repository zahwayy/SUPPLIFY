'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive } from 'lucide-react';
import { archiveProductAction } from '../../modules/products/productActions.js';
import Button from '../ui/Button.jsx';
import { useToast } from '../ui/ToastProvider.jsx';
import ArchiveProductDialog from './ArchiveProductDialog.jsx';

export default function ProductDetailArchiveButton({ product }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const res = await archiveProductAction(product.id);
      setOpen(false);
      if (res?.ok) {
        toast.success(
          res.message || `Produk "${product.name}" (${product.sku}) berhasil diarsipkan.`,
          { title: 'Produk Diarsipkan' }
        );
        router.refresh();
      } else {
        toast.error(
          res?.error || 'Gagal mengarsipkan produk. Silakan coba lagi.',
          { title: 'Gagal Mengarsipkan' }
        );
      }
    });
  }

  return (
    <>
      <Button
        variant="warning-outline"
        size="md"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        <Archive className="h-4 w-4" aria-hidden="true" />
        Arsipkan Produk
      </Button>

      <ArchiveProductDialog
        product={product}
        open={open}
        loading={isPending}
        onClose={() => {
          if (!isPending) setOpen(false);
        }}
        onConfirm={handleConfirm}
      />
    </>
  );
}
