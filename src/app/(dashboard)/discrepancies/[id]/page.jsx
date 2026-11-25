import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '../../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../../lib/auth/rbac.js';
import { ForbiddenError, NotFoundError } from '../../../../lib/constants/errors.js';
import { getDiscrepancyDetail } from '../../../../modules/discrepancies/discrepancyService.js';
import DiscrepancyDetailView from '../../../../components/discrepancies/DiscrepancyDetailView.jsx';

export const dynamic = 'force-dynamic';

export default async function DiscrepancyDetailPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.DISCREPANCY_READ)) {
    redirect('/unauthorized');
  }

  const resolved = await params;
  const discrepancyId = Number(resolved?.id);
  if (!Number.isInteger(discrepancyId) || discrepancyId <= 0) {
    notFound();
  }

  let detail;
  try {
    detail = await getDiscrepancyDetail(user, discrepancyId);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      redirect('/unauthorized');
    }
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  return (
    <DiscrepancyDetailView
      report={detail.report}
      evidence={detail.evidence}
      canReport={hasPermission(user, PERMISSIONS.DISCREPANCY_REPORT)}
      canResolve={hasPermission(user, PERMISSIONS.DISCREPANCY_RESOLVE)}
      canRequestAdjustment={hasPermission(user, PERMISSIONS.ADJUSTMENT_REQUEST)}
    />
  );
}
