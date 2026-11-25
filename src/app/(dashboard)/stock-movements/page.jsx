import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getStockMovementLedger } from '../../../modules/inventory/inventoryService.js';
import StockMovementsView from '../../../components/inventory/StockMovementsView.jsx';

export const dynamic = 'force-dynamic';

export default async function StockMovementsPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (
    !hasPermission(user, PERMISSIONS.INVENTORY_READ) ||
    !hasPermission(user, PERMISSIONS.AUDIT_READ)
  ) {
    redirect('/unauthorized');
  }

  const params = await searchParams;
  const filters = {
    search: typeof params?.search === 'string' ? params.search.trim() : '',
    movementType: typeof params?.movementType === 'string' ? params.movementType : '',
    page: params?.page ? Number(params.page) : 1,
  };

  const ledger = await getStockMovementLedger(user, filters);

  return (
    <StockMovementsView
      ledger={ledger}
      initialFilters={filters}
    />
  );
}
