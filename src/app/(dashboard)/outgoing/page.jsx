import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getOutgoingOverview } from '../../../modules/outgoing/outgoingService.js';
import {
  EXPORT_RESOURCES,
  canExportResource,
} from '../../../modules/export/exportService.js';
import OutgoingManager from '../../../components/outgoing/OutgoingManager.jsx';

export const dynamic = 'force-dynamic';

export default async function OutgoingPage({ searchParams }) {
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

  const overview = await getOutgoingOverview(user, filters);

  return (
    <OutgoingManager
      overview={overview}
      canCreate={canCreate}
      canExport={canExportResource(user, EXPORT_RESOURCES.OUTGOING)}
      initialFilters={filters}
    />
  );
}
