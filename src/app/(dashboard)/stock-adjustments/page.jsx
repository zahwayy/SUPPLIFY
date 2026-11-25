import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getAdjustmentsOverview } from '../../../modules/adjustments/adjustmentService.js';
import AdjustmentsManager from '../../../components/adjustments/AdjustmentsManager.jsx';

export const dynamic = 'force-dynamic';

export default async function StockAdjustmentsPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.ADJUSTMENT_READ)) {
    redirect('/unauthorized');
  }

  const params = await searchParams;
  const filters = {
    search: typeof params?.search === 'string' ? params.search.trim() : '',
    status: typeof params?.status === 'string' ? params.status : '',
    page: params?.page ? Number(params.page) : 1,
  };

  const overview = await getAdjustmentsOverview(user, filters);

  return (
    <AdjustmentsManager
      overview={overview}
      currentUserId={user.id}
      canRequest={hasPermission(user, PERMISSIONS.ADJUSTMENT_REQUEST)}
      canApprove={hasPermission(user, PERMISSIONS.ADJUSTMENT_APPROVE)}
      initialFilters={filters}
    />
  );
}
