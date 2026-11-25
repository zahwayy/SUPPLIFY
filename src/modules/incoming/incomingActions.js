'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '../../lib/auth/session.js';
import { actionFailure, actionSuccess } from '../../lib/utils/response.js';
import {
  createIncomingTransaction,
  approveIncomingTransaction,
  rejectIncomingTransaction,
  cancelIncomingTransaction,
} from './incomingService.js';

function revalidateIncomingPaths(txId, poId = null) {
  revalidatePath('/incoming');
  if (txId) revalidatePath(`/incoming/${txId}`);
  revalidatePath('/purchase-orders');
  if (poId) revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath('/restock-orders');
  revalidatePath('/discrepancies');
  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/stock-movements');
  revalidatePath('/dashboard');
}

export async function createIncomingAction(payload) {
  try {
    const user = await getCurrentUser();
    const created = await createIncomingTransaction(user, payload);
    revalidateIncomingPaths(created.id, created.purchase_order_id);
    return actionSuccess(
      created,
      `Hasil pemeriksaan ${created.transaction_code} telah dikirim untuk ditinjau Manager.`
    );
  } catch (err) {
    return actionFailure(err, 'incomingActions.createIncomingAction');
  }
}

export async function approveIncomingAction(txId, reviewPayload = null) {
  try {
    const user = await getCurrentUser();
    const approved = await approveIncomingTransaction(user, Number(txId), reviewPayload);
    revalidateIncomingPaths(approved.id, approved.purchase_order_id);
    const totalAdded = (approved.movements || []).reduce(
      (sum, m) => sum + Number(m.quantityDelta || 0),
      0
    );
    const discCount = approved.createdDiscrepancies?.length || 0;
    const discSuffix =
      discCount > 0
        ? ` ${discCount} ketidaksesuaian tercatat untuk tindak lanjut.`
        : '';
    return actionSuccess(
      approved,
      `Penerimaan ${approved.transaction_code} disetujui. ${totalAdded} unit telah ditambahkan ke stok gudang.${discSuffix}`
    );
  } catch (err) {
    return actionFailure(err, 'incomingActions.approveIncomingAction');
  }
}

export async function rejectIncomingAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const txId = Number(formData.get('txId'));
    const rejected = await rejectIncomingTransaction(user, txId, {
      rejectionReason: formData.get('rejectionReason'),
    });
    revalidateIncomingPaths(txId, rejected.purchase_order_id);
    return actionSuccess(
      rejected,
      `Penerimaan ${rejected.transaction_code} ditolak. Status PO dikembalikan dan stok tidak berubah.`
    );
  } catch (err) {
    return actionFailure(err, 'incomingActions.rejectIncomingAction');
  }
}

export async function cancelIncomingAction(txId) {
  try {
    const user = await getCurrentUser();
    const cancelled = await cancelIncomingTransaction(user, Number(txId));
    revalidateIncomingPaths(cancelled.id, cancelled.purchase_order_id);
    return actionSuccess(
      cancelled,
      `Laporan pemeriksaan ${cancelled.transaction_code} telah dibatalkan.`
    );
  } catch (err) {
    return actionFailure(err, 'incomingActions.cancelIncomingAction');
  }
}
