import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getIncomingOverview } from '../../../modules/incoming/incomingService.js';
import { findPoItems } from '../../../modules/purchase-orders/poRepo.js';
import {
  EXPORT_RESOURCES,
  canExportResource,
} from '../../../modules/export/exportService.js';
import IncomingManager from '../../../components/incoming/IncomingManager.jsx';

export const dynamic = 'force-dynamic';

export default async function IncomingPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.TRANSACTIONS_READ)) {
    redirect('/unauthorized');
  }

  const canCreate = hasPermission(user, PERMISSIONS.TRANSACTIONS_CREATE);
  const params = await searchParams;

  const filters = {
    search: typeof params?.search === 'string' ? params.search.trim() : '',
    status: typeof params?.status === 'string' ? params.status : '',
    page: params?.page ? Number(params.page) : 1,
  };
  const preselectedPoId = typeof params?.poId === 'string' ? params.poId : '';

  const overview = await getIncomingOverview(user, filters);

  // Hydrate PO items for eligible Received POs so Staff can pre-fill actual quantities immediately
  const eligiblePosWithItems = canCreate
    ? await Promise.all(
        (overview.eligiblePos || []).map(async (po) => ({
          ...po,
          items: await findPoItems(po.id),
        }))
      )
    : [];

  return (
    <IncomingManager
      overview={{ ...overview, eligiblePos: eligiblePosWithItems }}
      canCreate={canCreate}
      canExport={canExportResource(user, EXPORT_RESOURCES.INCOMING)}
      preselectedPoId={preselectedPoId}
      initialFilters={filters}
    />
  );
}
