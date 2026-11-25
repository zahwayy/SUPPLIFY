import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getDiscrepanciesOverview } from '../../../modules/discrepancies/discrepancyService.js';
import DiscrepanciesManager from '../../../components/discrepancies/DiscrepanciesManager.jsx';

export const dynamic = 'force-dynamic';

export default async function DiscrepanciesPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.DISCREPANCY_READ)) {
    redirect('/unauthorized');
  }

  const params = await searchParams;
  const filters = {
    search: typeof params?.search === 'string' ? params.search.trim() : '',
    status: typeof params?.status === 'string' ? params.status : '',
    page: params?.page ? Number(params.page) : 1,
  };

  const overview = await getDiscrepanciesOverview(user, filters);

  return (
    <DiscrepanciesManager
      overview={overview}
      canReport={hasPermission(user, PERMISSIONS.DISCREPANCY_REPORT)}
      initialFilters={filters}
    />
  );
}
