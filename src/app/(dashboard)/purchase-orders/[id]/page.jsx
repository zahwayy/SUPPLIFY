import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '../../../../lib/auth/session.js';
import { ForbiddenError, NotFoundError } from '../../../../lib/constants/errors.js';
import { getPurchaseOrderDetail } from '../../../../modules/purchase-orders/poService.js';
import PurchaseOrderDetailView from '../../../../components/purchase-orders/PurchaseOrderDetailView.jsx';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrderDetailPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');

  const resolved = await params;
  const poId = Number(resolved?.id);
  if (!Number.isInteger(poId) || poId <= 0) {
    notFound();
  }

  let detail;
  try {
    detail = await getPurchaseOrderDetail(user, poId);
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
    <PurchaseOrderDetailView
      po={detail.po}
      items={detail.items}
      evidence={detail.evidence}
      arrivalEvidence={detail.arrivalEvidence}
      incomings={detail.incomings}
      user={user}
    />
  );
}
