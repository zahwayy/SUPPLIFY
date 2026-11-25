import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getCategoriesList } from '../../../modules/categories/categoryService.js';
import {
  getInventoryOverview,
  getStockMovementLedger,
} from '../../../modules/inventory/inventoryService.js';
import { getDiscrepanciesOverview } from '../../../modules/discrepancies/discrepancyService.js';
import { getAdjustmentsOverview } from '../../../modules/adjustments/adjustmentService.js';
import InventoryHub from '../../../components/inventory/InventoryHub.jsx';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.INVENTORY_READ)) {
    redirect('/unauthorized');
  }

  const allowedTabs = ['summary'];
  if (hasPermission(user, PERMISSIONS.AUDIT_READ)) {
    allowedTabs.push('movements');
  }
  if (hasPermission(user, PERMISSIONS.DISCREPANCY_READ)) {
    allowedTabs.push('discrepancies');
  }
  if (hasPermission(user, PERMISSIONS.ADJUSTMENT_READ)) {
    allowedTabs.push('adjustments');
  }

  const params = await searchParams;
  const requestedTab = typeof params?.tab === 'string' ? params.tab.trim() : 'summary';
  const activeTab = allowedTabs.includes(requestedTab) ? requestedTab : 'summary';

  const baseFilters = {
    search: typeof params?.search === 'string' ? params.search.trim() : '',
    page: params?.page ? Number(params.page) : 1,
  };

  if (activeTab === 'movements') {
    const filters = {
      ...baseFilters,
      movementType:
        typeof params?.movementType === 'string' ? params.movementType : '',
    };
    const ledger = await getStockMovementLedger(user, filters);
    return (
      <InventoryHub
        activeTab="movements"
        allowedTabs={allowedTabs}
        movementsProps={{
          ledger,
          initialFilters: filters,
        }}
      />
    );
  }

  if (activeTab === 'discrepancies') {
    const filters = {
      ...baseFilters,
      status: typeof params?.status === 'string' ? params.status : '',
    };
    const overview = await getDiscrepanciesOverview(user, filters);
    return (
      <InventoryHub
        activeTab="discrepancies"
        allowedTabs={allowedTabs}
        discrepanciesProps={{
          overview,
          canReport: hasPermission(user, PERMISSIONS.DISCREPANCY_REPORT),
          initialFilters: filters,
        }}
      />
    );
  }

  if (activeTab === 'adjustments') {
    const filters = {
      ...baseFilters,
      status: typeof params?.status === 'string' ? params.status : '',
    };
    const overview = await getAdjustmentsOverview(user, filters);
    return (
      <InventoryHub
        activeTab="adjustments"
        allowedTabs={allowedTabs}
        adjustmentsProps={{
          overview,
          currentUserId: user.id,
          canRequest: hasPermission(user, PERMISSIONS.ADJUSTMENT_REQUEST),
          canApprove: hasPermission(user, PERMISSIONS.ADJUSTMENT_APPROVE),
          initialFilters: filters,
        }}
      />
    );
  }

  const summaryFilters = {
    ...baseFilters,
    categoryId: params?.categoryId ? Number(params.categoryId) : '',
    stockStatus: typeof params?.stockStatus === 'string' ? params.stockStatus : '',
  };

  const [overview, categories] = await Promise.all([
    getInventoryOverview(user, summaryFilters),
    getCategoriesList(user),
  ]);

  return (
    <InventoryHub
      activeTab="summary"
      allowedTabs={allowedTabs}
      summaryProps={{
        overview,
        categories,
        initialFilters: summaryFilters,
        canCreatePo: hasPermission(user, PERMISSIONS.PO_CREATE),
      }}
    />
  );
}
