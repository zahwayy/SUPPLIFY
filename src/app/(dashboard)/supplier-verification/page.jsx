import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getSuppliersOverview } from '../../../modules/suppliers/supplierService.js';
import {
  EXPORT_RESOURCES,
  canExportResource,
} from '../../../modules/export/exportService.js';
import SupplierVerificationManager from '../../../components/suppliers/SupplierVerificationManager.jsx';

export const dynamic = 'force-dynamic';

export default async function SupplierVerificationPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.SUPPLIERS_VERIFY)) {
    redirect('/unauthorized');
  }

  const params = await searchParams;
  const filters = {
    search: typeof params?.search === 'string' ? params.search.trim() : '',
    status: typeof params?.status === 'string' ? params.status : '',
  };

  const suppliers = await getSuppliersOverview(user, filters);

  return (
    <SupplierVerificationManager
      suppliers={suppliers}
      initialFilters={filters}
      canExport={canExportResource(user, EXPORT_RESOURCES.SUPPLIERS)}
    />
  );
}
