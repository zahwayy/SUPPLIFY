import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getUsersList } from '../../../modules/users/userService.js';
import UsersManager from '../../../components/users/UsersManager.jsx';

export const dynamic = 'force-dynamic';

export default async function UsersPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.USERS_MANAGE)) {
    redirect('/unauthorized');
  }

  const params = await searchParams;
  const filters = {
    search: typeof params?.search === 'string' ? params.search.trim() : '',
    role: typeof params?.role === 'string' ? params.role : '',
    status: typeof params?.status === 'string' ? params.status : '',
  };

  const users = await getUsersList(user, filters);

  return (
    <UsersManager
      users={users}
      currentUserId={user.id}
      initialFilters={filters}
    />
  );
}
