import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { ROLES } from '../../../lib/constants/roles.js';
import { getPurchaseOrdersList } from '../../../modules/purchase-orders/poService.js';
import {
  EXPORT_RESOURCES,
  canExportResource,
} from '../../../modules/export/exportService.js';
import PurchaseOrdersManager from '../../../components/purchase-orders/PurchaseOrdersManager.jsx';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrdersPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');

  const isSupplier = user.role === ROLES.SUPPLIER;
  const canReadAll = hasPermission(user, PERMISSIONS.PO_READ_ALL);
  const canRespondOwn = hasPermission(user, PERMISSIONS.PO_RESPOND_OWN);
  if (!canReadAll && !canRespondOwn) redirect('/unauthorized');

  const params = await searchParams;
  const filters = {
    search: typeof params?.search === 'string' ? params.search.trim() : '',
    status: typeof params?.status === 'string' ? params.status : '',
    page: params?.page ? Number(params.page) : 1,
  };

  const catalog = await getPurchaseOrdersList(user, filters);
  const canExport = canExportResource(user, EXPORT_RESOURCES.PURCHASE_ORDERS);

  return (
    <PurchaseOrdersManager
      catalog={catalog}
      canExport={canExport}
      isSupplier={isSupplier}
      basePath="/purchase-orders"
      title="Pesanan Pembelian (PO)"
      description={
        isSupplier
          ? 'Daftar Purchase Order yang ditujukan ke perusahaan Anda untuk dikonfirmasi, dikirim, dan dikonfirmasi kedatangannya.'
          : 'Pantau pesanan pengadaan, konfirmasi kedatangan barang, dan lanjutkan pemeriksaan Incoming.'
      }
      initialFilters={filters}
    />
  );
}
