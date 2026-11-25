import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth/session.js';
import { getUserNotifications } from '../../modules/notifications/notificationService.js';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';

export const dynamic = 'force-dynamic';

export default async function ProtectedDashboardLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?expired=1');
  }

  let notifData = { items: [], unreadCount: 0 };
  try {
    notifData = await getUserNotifications(user, { limit: 15 });
  } catch {
    notifData = { items: [], unreadCount: 0 };
  }

  return (
    <DashboardLayout
      user={user}
      notifications={notifData.items}
      unreadNotificationCount={notifData.unreadCount}
    >
      {children}
    </DashboardLayout>
  );
}
