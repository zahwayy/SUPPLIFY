'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '../../lib/auth/session.js';
import { actionFailure, actionSuccess } from '../../lib/utils/response.js';
import { getStockStatusMeta } from '../../lib/utils/labels.js';
import {
  createStockAdjustmentRequest,
  approveStockAdjustment,
  rejectStockAdjustment,
} from './adjustmentService.js';

function revalidateAdjustmentPaths() {
  revalidatePath('/stock-adjustments');
  revalidatePath('/discrepancies');
  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/stock-movements');
  revalidatePath('/dashboard');
}

export async function createAdjustmentAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const created = await createStockAdjustmentRequest(user, {
      productId: formData.get('productId'),
      discrepancyId: formData.get('discrepancyId'),
      adjustmentType: formData.get('adjustmentType'),
      direction: formData.get('direction'),
      quantityDelta: formData.get('quantityDelta'),
      reason: formData.get('reason'),
    });
    revalidateAdjustmentPaths();
    return actionSuccess(
      created,
      `Pengajuan penyesuaian stok ${created.adjustment_code} berhasil dibuat (Pending).`
    );
  } catch (err) {
    return actionFailure(err, 'adjustmentActions.createAdjustmentAction');
  }
}

export async function approveAdjustmentAction(adjustmentId) {
  try {
    const user = await getCurrentUser();
    const approved = await approveStockAdjustment(user, Number(adjustmentId));
    revalidateAdjustmentPaths();
    const alertCount = approved.lowStockAlerts?.length || 0;
    const alertSuffix =
      alertCount > 0
        ? ` Perhatian: stok "${approved.lowStockAlerts[0].name}" kini berstatus ${getStockStatusMeta(approved.lowStockAlerts[0].stockStatusAfter).label}.`
        : '';
    return actionSuccess(
      approved,
      `Stock Adjustment ${approved.adjustment_code} disetujui dan stok diperbarui.${alertSuffix}`
    );
  } catch (err) {
    return actionFailure(err, 'adjustmentActions.approveAdjustmentAction');
  }
}

export async function rejectAdjustmentAction(prevStateOrId, maybeFormData) {
  try {
    const user = await getCurrentUser();
    let adjustmentId;
    let rejectionReason;
    if (maybeFormData && typeof maybeFormData.get === 'function') {
      adjustmentId = Number(maybeFormData.get('adjustmentId'));
      rejectionReason = maybeFormData.get('rejectionReason');
    } else {
      adjustmentId = Number(prevStateOrId);
      rejectionReason = maybeFormData?.rejectionReason;
    }

    const rejected = await rejectStockAdjustment(user, adjustmentId, {
      rejectionReason,
    });
    revalidateAdjustmentPaths();
    return actionSuccess(
      rejected,
      `Stock Adjustment ${rejected.adjustment_code} ditolak dengan alasan tercatat. Stok tidak berubah.`
    );
  } catch (err) {
    return actionFailure(err, 'adjustmentActions.rejectAdjustmentAction');
  }
}
