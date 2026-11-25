'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '../../lib/auth/session.js';
import { actionFailure, actionSuccess } from '../../lib/utils/response.js';
import {
  createPurchaseOrder,
  supplierConfirmPo,
  supplierRejectPo,
  supplierSubmitShipment,
  supplierConfirmArrival,
  managerNotifyStaffForInspection,
  managerCompletePo,
  managerCancelPo,
} from './poService.js';

function revalidatePoPaths(poId) {
  revalidatePath('/restock-orders');
  revalidatePath('/purchase-orders');
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath('/shipment');
  revalidatePath('/shipment-history');
  revalidatePath('/incoming');
  revalidatePath('/dashboard');
}

export async function createPoAction(payload) {
  try {
    const user = await getCurrentUser();
    const po = await createPurchaseOrder(user, payload);
    revalidatePoPaths(po.id);
    return actionSuccess(
      po,
      `Purchase Order ${po.po_code} berhasil dibuat dan menunggu konfirmasi Supplier.`
    );
  } catch (err) {
    return actionFailure(err, 'poActions.createPoAction');
  }
}

export async function confirmPoAction(poId) {
  try {
    const user = await getCurrentUser();
    const po = await supplierConfirmPo(user, Number(poId));
    revalidatePoPaths(po.id);
    return actionSuccess(
      po,
      `PO ${po.po_code} berhasil dikonfirmasi. Silakan persiapkan pengiriman barang.`
    );
  } catch (err) {
    return actionFailure(err, 'poActions.confirmPoAction');
  }
}

export async function rejectPoAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const poId = Number(formData.get('poId'));
    const po = await supplierRejectPo(user, poId, {
      rejectionReason: formData.get('rejectionReason'),
    });
    revalidatePoPaths(po.id);
    return actionSuccess(po, `PO ${po.po_code} telah ditolak.`);
  } catch (err) {
    return actionFailure(err, 'poActions.rejectPoAction');
  }
}

export async function submitShipmentAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const poId = Number(formData.get('poId'));
    const result = await supplierSubmitShipment(user, poId, {
      courierName: formData.get('courierName'),
      trackingNumber: formData.get('trackingNumber'),
      noTrackingReason: formData.get('noTrackingReason'),
      shippedAt: formData.get('shippedAt'),
      notes: formData.get('notes'),
    });
    revalidatePoPaths(poId);
    return actionSuccess(
      result,
      `Pengiriman untuk PO ${result.po.po_code} telah dikonfirmasi.`
    );
  } catch (err) {
    return actionFailure(err, 'poActions.submitShipmentAction');
  }
}

export async function confirmArrivalAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const poId = Number(formData.get('poId'));
    const po = await supplierConfirmArrival(user, poId, {
      arrivalNotes: formData.get('arrivalNotes'),
    });
    revalidatePoPaths(poId);
    return actionSuccess(
      po,
      `Konfirmasi kedatangan barang untuk PO ${po.po_code} telah dikirim ke Warehouse Manager.`
    );
  } catch (err) {
    return actionFailure(err, 'poActions.confirmArrivalAction');
  }
}

export async function notifyStaffForInspectionAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const poId = Number(formData.get('poId'));
    const po = await managerNotifyStaffForInspection(user, poId, {
      notes: formData.get('notes'),
    });
    revalidatePoPaths(poId);
    return actionSuccess(
      po,
      `Arahan pemeriksaan untuk PO ${po.po_code} telah dikirim. Warehouse Staff dapat mencatat hasil pemeriksaan fisik.`
    );
  } catch (err) {
    return actionFailure(err, 'poActions.notifyStaffForInspectionAction');
  }
}

export async function completePoAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const poId = Number(formData.get('poId'));
    const po = await managerCompletePo(user, poId, {
      completionNotes: formData.get('completionNotes'),
    });
    revalidatePoPaths(poId);
    return actionSuccess(po, `PO ${po.po_code} telah ditandai selesai.`);
  } catch (err) {
    return actionFailure(err, 'poActions.completePoAction');
  }
}

export async function cancelPoAction(poId) {
  try {
    const user = await getCurrentUser();
    const po = await managerCancelPo(user, Number(poId));
    revalidatePoPaths(po.id);
    return actionSuccess(po, `PO ${po.po_code} telah dibatalkan.`);
  } catch (err) {
    return actionFailure(err, 'poActions.cancelPoAction');
  }
}
