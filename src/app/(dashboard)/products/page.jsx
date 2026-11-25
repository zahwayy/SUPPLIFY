import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getCategoriesList } from '../../../modules/categories/categoryService.js';
import { getProductsCatalog } from '../../../modules/products/productService.js';
import {
  EXPORT_RESOURCES,
  canExportResource,
} from '../../../modules/export/exportService.js';
import ProductsManager from '../../../components/products/ProductsManager.jsx';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.PRODUCTS_READ)) {
    redirect('/unauthorized');
  }

  const canManage = hasPermission(user, PERMISSIONS.PRODUCTS_MANAGE);
  const canArchive = hasPermission(user, PERMISSIONS.PRODUCTS_ARCHIVE);
  const canDelete = hasPermission(user, PERMISSIONS.PRODUCTS_DELETE);
  const params = await searchParams;

  const filters = {
    search: typeof params?.search === 'string' ? params.search.trim() : '',
    categoryId: params?.categoryId ? Number(params.categoryId) : '',
    stockStatus: typeof params?.stockStatus === 'string' ? params.stockStatus : '',
    sortBy: typeof params?.sortBy === 'string' ? params.sortBy : 'sku',
    page: params?.page ? Number(params.page) : 1,
  };

  const [catalog, categories] = await Promise.all([
    getProductsCatalog(user, filters),
    getCategoriesList(user),
  ]);

  return (
    <ProductsManager
      catalog={catalog}
      categories={categories}
      canManage={canManage}
      canArchive={canArchive}
      canDelete={canDelete}
      canExport={canExportResource(user, EXPORT_RESOURCES.PRODUCTS)}
      initialFilters={filters}
    />
  );
}
