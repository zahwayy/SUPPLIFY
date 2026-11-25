import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '../../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../../lib/auth/rbac.js';
import { ForbiddenError, NotFoundError } from '../../../../lib/constants/errors.js';
import { getOutgoingDetail } from '../../../../modules/outgoing/outgoingService.js';
import OutgoingDetailView from '../../../../components/outgoing/OutgoingDetailView.jsx';

export const dynamic = 'force-dynamic';

export default async function OutgoingDetailPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.TRANSACTIONS_READ)) {
    redirect('/unauthorized');
  }

  const resolved = await params;
  const txId = Number(resolved?.id);
  if (!Number.isInteger(txId) || txId <= 0) {
    notFound();
  }

  let detail;
  try {
    detail = await getOutgoingDetail(user, txId);
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
    <OutgoingDetailView
      tx={detail.tx}
      items={detail.items}
      evidence={detail.evidence}
      availableProducts={detail.availableProducts || []}
      canApprove={hasPermission(user, PERMISSIONS.TRANSACTIONS_APPROVE)}
      canHandover={hasPermission(user, PERMISSIONS.TRANSACTIONS_HANDOVER)}
      isCreator={Number(detail.tx.created_by) === Number(user.id)}
    />
  );
}
