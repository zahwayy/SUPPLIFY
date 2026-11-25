import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getCategoriesList } from '../../../modules/categories/categoryService.js';
import {
  EXPORT_RESOURCES,
  canExportResource,
} from '../../../modules/export/exportService.js';
import CategoriesManager from '../../../components/categories/CategoriesManager.jsx';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.CATEGORIES_MANAGE)) {
    redirect('/unauthorized');
  }

  const params = await searchParams;
  const search = typeof params?.search === 'string' ? params.search.trim() : '';

  const categories = await getCategoriesList(user, { search });

  return (
    <CategoriesManager
      categories={categories}
      initialSearch={search}
      canExport={canExportResource(user, EXPORT_RESOURCES.CATEGORIES)}
    />
  );
}
