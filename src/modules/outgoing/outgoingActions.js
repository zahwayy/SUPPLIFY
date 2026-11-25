'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '../../lib/auth/session.js';
import { actionFailure, actionSuccess } from '../../lib/utils/response.js';
import {
  createOutgoingTransaction,
  updatePendingOutgoingTransaction,
  deletePendingOutgoingTransaction,
  approveOutgoingTransaction,
  rejectOutgoingTransaction,
  cancelOutgoingTransaction,
  recordOutgoingHandover,
  confirmOutgoingDelivery,
} from './outgoingService.js';

function revalidateOutgoingPaths(txId) {
  revalidatePath('/outgoing');
  if (txId) revalidatePath(`/outgoing/${txId}`);
  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/stock-movements');
  revalidatePath('/dashboard');
}

export async function createOutgoingAction(payload) {
  try {
    const user = await getCurrentUser();
    const created = await createOutgoingTransaction(user, payload);
    revalidateOutgoingPaths(created.id);
    return actionSuccess(
      created,
      `Pengajuan pengeluaran ${created.transaction_code} telah dikirim untuk ditinjau Manager.`
    );
  } catch (err) {
    return actionFailure(err, 'outgoingActions.createOutgoingAction');
  }
}

export async function updateOutgoingAction(txId, payload) {
  try {
    const user = await getCurrentUser();
    const updated = await updatePendingOutgoingTransaction(user, Number(txId), payload);
    revalidateOutgoingPaths(updated.id);
    return actionSuccess(
      updated,
      `Pengajuan pengeluaran ${updated.transaction_code} berhasil diperbarui.`
    );
  } catch (err) {
    return actionFailure(err, 'outgoingActions.updateOutgoingAction');
  }
}

export async function deleteOutgoingAction(txId) {
  try {
    const user = await getCurrentUser();
    const deleted = await deletePendingOutgoingTransaction(user, Number(txId));
    revalidateOutgoingPaths(deleted.id);
    return actionSuccess(
      deleted,
      `Pengajuan pengeluaran ${deleted.transaction_code} telah dihapus.`
    );
  } catch (err) {
    return actionFailure(err, 'outgoingActions.deleteOutgoingAction');
  }
}

export async function approveOutgoingAction(txId) {
  try {
    const user = await getCurrentUser();
    const approved = await approveOutgoingTransaction(user, Number(txId));
    revalidateOutgoingPaths(approved.id);
    return actionSuccess(
      approved,
      `Pengeluaran ${approved.transaction_code} disetujui. Staff dapat menyiapkan barang dan mencatat pengiriman.`
    );
  } catch (err) {
    return actionFailure(err, 'outgoingActions.approveOutgoingAction');
  }
}

export async function rejectOutgoingAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const txId = Number(formData.get('txId'));
    const rejected = await rejectOutgoingTransaction(user, txId, {
      rejectionReason: formData.get('rejectionReason'),
    });
    revalidateOutgoingPaths(txId);
    return actionSuccess(
      rejected,
      `Pengajuan pengeluaran ${rejected.transaction_code} ditolak. Stok gudang tidak berubah.`
    );
  } catch (err) {
    return actionFailure(err, 'outgoingActions.rejectOutgoingAction');
  }
}

export async function cancelOutgoingAction(txId) {
  try {
    const user = await getCurrentUser();
    const cancelled = await cancelOutgoingTransaction(user, Number(txId));
    revalidateOutgoingPaths(cancelled.id);
    return actionSuccess(
      cancelled,
      `Pengajuan pengeluaran ${cancelled.transaction_code} telah dibatalkan.`
    );
  } catch (err) {
    return actionFailure(err, 'outgoingActions.cancelOutgoingAction');
  }
}

export async function recordHandoverAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    let txId;
    let payload;
    if (formData && typeof formData.get === 'function') {
      txId = Number(formData.get('txId'));
      payload = {
        recipientName: formData.get('recipientName'),
        recipientType: formData.get('recipientType'),
        recipientContact: formData.get('recipientContact'),
        handoverMethod: formData.get('handoverMethod'),
        courierName: formData.get('courierName'),
        trackingNumber: formData.get('trackingNumber'),
        notes: formData.get('notes'),
      };
    } else {
      txId = Number(prevState);
      payload = formData || {};
    }

    const result = await recordOutgoingHandover(user, txId, payload);
    revalidateOutgoingPaths(txId);
    const alertCount = result.lowStockAlerts?.length || 0;
    const alertSuffix =
      alertCount > 0
        ? ` Perhatian: ${alertCount} produk berada pada status stok menipis, kritis, atau habis.`
        : '';
    return actionSuccess(
      result,
      `Pengiriman ${result.tx.transaction_code} telah dicatat dan stok gudang diperbarui.${alertSuffix}`
    );
  } catch (err) {
    return actionFailure(err, 'outgoingActions.recordHandoverAction');
  }
}

export const shipOutgoingAction = recordHandoverAction;

export async function confirmDeliveryAction(txId) {
  try {
    const user = await getCurrentUser();
    const delivered = await confirmOutgoingDelivery(user, Number(txId));
    revalidateOutgoingPaths(delivered.id);
    return actionSuccess(
      delivered,
      `Pengiriman ${delivered.transaction_code} telah dikonfirmasi diterima.`
    );
  } catch (err) {
    return actionFailure(err, 'outgoingActions.confirmDeliveryAction');
  }
}
