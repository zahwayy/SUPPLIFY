import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '../../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../../lib/auth/rbac.js';
import { ForbiddenError, NotFoundError } from '../../../../lib/constants/errors.js';
import { getIncomingDetail } from '../../../../modules/incoming/incomingService.js';
import IncomingDetailView from '../../../../components/incoming/IncomingDetailView.jsx';

export const dynamic = 'force-dynamic';

export default async function IncomingDetailPage({ params }) {
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
    detail = await getIncomingDetail(user, txId);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      redirect('/unauthorized');
    }
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  const canApprove = hasPermission(user, PERMISSIONS.TRANSACTIONS_APPROVE);
  const canUploadEvidence = hasPermission(user, PERMISSIONS.TRANSACTIONS_CREATE);

  return (
    <IncomingDetailView
      tx={detail.tx}
      items={detail.items}
      evidence={detail.evidence}
      arrivalEvidence={detail.arrivalEvidence}
      canApprove={canApprove}
      canUploadEvidence={canUploadEvidence}
      isCreator={Number(detail.tx.created_by) === Number(user.id)}
    />
  );
}
