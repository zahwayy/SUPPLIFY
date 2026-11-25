import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { listActiveSuppliersSimple } from '../../../modules/suppliers/supplierRepo.js';
import { listActiveProductsSimple } from '../../../modules/products/productRepo.js';
import { getPurchaseOrdersList } from '../../../modules/purchase-orders/poService.js';
import { findPoById } from '../../../modules/purchase-orders/poRepo.js';
import { findDiscrepancyById } from '../../../modules/discrepancies/discrepancyRepo.js';
import {
  EXPORT_RESOURCES,
  canExportResource,
} from '../../../modules/export/exportService.js';
import PurchaseOrdersManager from '../../../components/purchase-orders/PurchaseOrdersManager.jsx';

export const dynamic = 'force-dynamic';

export default async function RestockOrdersPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.PO_CREATE)) redirect('/unauthorized');

  const params = await searchParams;
  const filters = {
    search: typeof params?.search === 'string' ? params.search.trim() : '',
    status: typeof params?.status === 'string' ? params.status : '',
    page: params?.page ? Number(params.page) : 1,
  };
  const preselectedProductId =
    typeof params?.productId === 'string' ? params.productId : '';
  const referencePoId = params?.referencePoId ? Number(params.referencePoId) : null;
  const sourceDiscrepancyId = params?.sourceDiscrepancyId
    ? Number(params.sourceDiscrepancyId)
    : null;
  const preselectedSupplierId =
    typeof params?.supplierId === 'string' ? params.supplierId : '';
  const preselectedQty = typeof params?.qty === 'string' ? params.qty : '';

  const [catalog, suppliers, products, refPo, srcDisc] = await Promise.all([
    getPurchaseOrdersList(user, filters),
    listActiveSuppliersSimple(),
    listActiveProductsSimple(),
    referencePoId && Number.isInteger(referencePoId) && referencePoId > 0
      ? findPoById(referencePoId)
      : Promise.resolve(null),
    sourceDiscrepancyId &&
    Number.isInteger(sourceDiscrepancyId) &&
    sourceDiscrepancyId > 0
      ? findDiscrepancyById(sourceDiscrepancyId)
      : Promise.resolve(null),
  ]);

  const prefillContext =
    preselectedProductId || refPo || srcDisc || preselectedSupplierId
      ? {
          referencePoId: refPo ? refPo.id : null,
          referencePoCode: refPo ? refPo.po_code : null,
          sourceDiscrepancyId: srcDisc ? srcDisc.id : null,
          sourceDiscrepancyCode: srcDisc ? srcDisc.issue_code : null,
          supplierId: preselectedSupplierId || (refPo ? String(refPo.supplier_id) : ''),
          productId: preselectedProductId || (srcDisc ? String(srcDisc.product_id) : ''),
          quantity: preselectedQty || '',
        }
      : null;

  return (
    <PurchaseOrdersManager
      catalog={catalog}
      suppliers={suppliers}
      products={products}
      canCreate
      canExport={canExportResource(user, EXPORT_RESOURCES.PURCHASE_ORDERS)}
      preselectedProductId={preselectedProductId}
      prefillContext={prefillContext}
      basePath="/restock-orders"
      title="Pesanan Restock (PO)"
      description="Buat Purchase Order kepada supplier terverifikasi dan pantau konfirmasi, pengiriman, pemeriksaan fisik, hingga selesai diterima atau dikembalikan."
      initialFilters={filters}
    />
  );
}
