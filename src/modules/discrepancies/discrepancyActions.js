'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '../../lib/auth/session.js';
import { actionFailure, actionSuccess } from '../../lib/utils/response.js';
import {
  createDiscrepancyReport,
  updateDiscrepancyWorkflow,
  submitRefundClaim,
  updateRefundClaimStatus,
} from './discrepancyService.js';

export async function createDiscrepancyAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const created = await createDiscrepancyReport(user, {
      issueType: formData.get('issueType'),
      sourceType: formData.get('sourceType'),
      sourceId: formData.get('sourceId'),
      productId: formData.get('productId'),
      expectedQuantity: formData.get('expectedQuantity'),
      actualQuantity: formData.get('actualQuantity'),
      description: formData.get('description'),
    });
    revalidatePath('/discrepancies');
    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return actionSuccess(
      created,
      `Laporan discrepancy ${created.issue_code} berhasil dibuat. Stok belum berubah sebelum penyesuaian resmi disetujui.`
    );
  } catch (err) {
    return actionFailure(err, 'discrepancyActions.createDiscrepancyAction');
  }
}

export async function updateDiscrepancyAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const discrepancyId = Number(formData.get('discrepancyId'));
    const updated = await updateDiscrepancyWorkflow(user, discrepancyId, {
      status: formData.get('status'),
      investigationNotes: formData.get('investigationNotes'),
      resolutionType: formData.get('resolutionType'),
      resolutionNotes: formData.get('resolutionNotes'),
    });
    revalidatePath('/discrepancies');
    revalidatePath(`/discrepancies/${discrepancyId}`);
    revalidatePath('/inventory');
    revalidatePath('/purchase-orders');
    revalidatePath('/restock-orders');
    revalidatePath('/dashboard');
    return actionSuccess(
      updated,
      `Status discrepancy ${updated.issue_code} berhasil diperbarui ke ${updated.status}.`
    );
  } catch (err) {
    return actionFailure(err, 'discrepancyActions.updateDiscrepancyAction');
  }
}

export async function submitRefundClaimAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const discrepancyId = Number(formData.get('discrepancyId'));
    const updated = await submitRefundClaim(user, discrepancyId, {
      refundAmount: formData.get('refundAmount'),
      refundNotes: formData.get('refundNotes'),
    });
    revalidatePath('/discrepancies');
    revalidatePath(`/discrepancies/${discrepancyId}`);
    revalidatePath('/inventory');
    revalidatePath('/purchase-orders');
    revalidatePath('/restock-orders');
    return actionSuccess(
      updated,
      `Klaim refund untuk ${updated.issue_code} berhasil diajukan ke Supplier (status: Diajukan). Stok tidak berubah.`
    );
  } catch (err) {
    return actionFailure(err, 'discrepancyActions.submitRefundClaimAction');
  }
}

export async function updateRefundClaimStatusAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const discrepancyId = Number(formData.get('discrepancyId'));
    const updated = await updateRefundClaimStatus(user, discrepancyId, {
      refundStatus: formData.get('refundStatus'),
      refundAmount: formData.get('refundAmount'),
      refundNotes: formData.get('refundNotes'),
    });
    revalidatePath('/discrepancies');
    revalidatePath(`/discrepancies/${discrepancyId}`);
    revalidatePath('/inventory');
    return actionSuccess(
      updated,
      `Status klaim refund untuk ${updated.issue_code} diperbarui menjadi ${updated.refund_status}.`
    );
  } catch (err) {
    return actionFailure(err, 'discrepancyActions.updateRefundClaimStatusAction');
  }
}
