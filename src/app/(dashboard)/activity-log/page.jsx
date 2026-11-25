import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getAuditLogEntries } from '../../../modules/audit/auditService.js';
import ActivityLogView from '../../../components/audit/ActivityLogView.jsx';

export const dynamic = 'force-dynamic';

export default async function ActivityLogPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.AUDIT_READ)) {
    redirect('/unauthorized');
  }

  const params = await searchParams;
  const filters = {
    search: typeof params?.search === 'string' ? params.search.trim() : '',
    actorRole: typeof params?.actorRole === 'string' ? params.actorRole : '',
    entityType: typeof params?.entityType === 'string' ? params.entityType : '',
    page: params?.page ? Number(params.page) : 1,
  };

  const logs = await getAuditLogEntries(user, filters);

  return <ActivityLogView logs={logs} initialFilters={filters} />;
}
