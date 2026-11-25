import crypto from 'node:crypto';
import { withTransaction } from '../../lib/db/pool.js';
import {
  assertSupplierOwnership,
  PERMISSIONS,
  requireAuth,
  requirePermission,
} from '../../lib/auth/rbac.js';
import { ROLES } from '../../lib/constants/roles.js';
import { PO_STATUSES, EVIDENCE_ENTITY_TYPES } from '../../lib/constants/statuses.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../lib/constants/errors.js';
import { findSupplierById } from '../suppliers/supplierRepo.js';
import { findProductById } from '../products/productRepo.js';
import { assertValidProductPrice } from '../products/productValidation.js';
import { getEvidenceListForEntity } from '../files/evidenceService.js';
import { recordAuditEvent } from '../audit/auditService.js';
import {
  validateCreatePoInput,
  validatePoRejectionInput,
  validateShipmentInput,
  validateSupplierArrivalInput,
  validateInspectionRequestInput,
  validateCompletePoInput,
} from './poValidation.js';
import {
  listPurchaseOrders,
  findPoById,
  findPoItems,
  findIncomingsForPo,
  listShipments,
  insertPurchaseOrder,
  insertPurchaseOrderItem,
  updatePurchaseOrderStatus,
  recordSupplierArrivalConfirmation,
  recordManagerInspectionRequest,
  markPurchaseOrderCompleted,
  upsertShipmentDetails,
} from './poRepo.js';

function generatePoCode() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `PO-${datePart}-${randPart}`;
}

export async function getPurchaseOrdersList(user, filters = {}) {
  requireAuth(user);
  if (user.role === ROLES.SUPPLIER) {
    requirePermission(user, PERMISSIONS.PO_RESPOND_OWN);
    return listPurchaseOrders({ ...filters, supplierIdScope: user.supplierId });
  }
  requirePermission(user, PERMISSIONS.PO_READ_ALL);
  return listPurchaseOrders(filters);
}

export async function getPurchaseOrderDetail(user, poId) {
  requireAuth(user);
  const po = await findPoById(poId);
  if (!po) {
    throw new NotFoundError('Purchase Order tidak ditemukan.');
  }

  if (user.role === ROLES.SUPPLIER) {
    requirePermission(user, PERMISSIONS.PO_RESPOND_OWN);
    assertSupplierOwnership(user, po.supplier_id);
  } else {
    requirePermission(user, PERMISSIONS.PO_READ_ALL);
  }

  const [items, evidence, arrivalEvidence, incomings] = await Promise.all([
    findPoItems(po.id),
    getEvidenceListForEntity(user, {
      entityType: EVIDENCE_ENTITY_TYPES.SUPPLIER_SHIPMENT,
      entityId: po.id,
    }),
    getEvidenceListForEntity(user, {
      entityType: EVIDENCE_ENTITY_TYPES.SUPPLIER_ARRIVAL,
      entityId: po.id,
    }),
    user.role === ROLES.SUPPLIER ? Promise.resolve([]) : findIncomingsForPo(po.id),
  ]);

  return { po, items, evidence, arrivalEvidence, incomings };
}

export async function getShipmentsForUser(user, filters = {}) {
  requireAuth(user);
  if (user.role === ROLES.SUPPLIER) {
    requirePermission(user, PERMISSIONS.SHIPMENT_READ_OWN);
    return listShipments({ ...filters, supplierIdScope: user.supplierId });
  }
  requirePermission(user, PERMISSIONS.PO_READ_ALL);
  return listShipments(filters);
}

export async function createPurchaseOrder(managerUser, rawInput) {
  requirePermission(managerUser, PERMISSIONS.PO_CREATE);
  const input = validateCreatePoInput(rawInput);

  return withTransaction(async (client) => {
    const supplier = await findSupplierById(input.supplierId, client);
    if (!supplier || supplier.status !== 'active') {
      throw new ValidationError('Supplier harus berstatus aktif dan terverifikasi Admin.', {
        supplierId: 'Pilih supplier aktif yang telah diverifikasi.',
      });
    }

    const priceByProductId = new Map();
    for (const item of input.items) {
      const product = await findProductById(item.productId, client);
      if (!product || product.deleted_at) {
        throw new ValidationError(
          `Produk dengan ID ${item.productId} tidak ditemukan atau sedang diarsipkan.`
        );
      }
      priceByProductId.set(item.productId, assertValidProductPrice(product));
    }

    if (input.referencePoId) {
      const refPo = await findPoById(input.referencePoId, client);
      if (!refPo) {
        throw new ValidationError('Purchase Order referensi tidak ditemukan.');
      }
    }

    if (input.sourceDiscrepancyId) {
      const discRes = await client.query(
        `SELECT id FROM discrepancy_reports WHERE id = $1 LIMIT 1`,
        [input.sourceDiscrepancyId]
      );
      if (discRes.rows.length === 0) {
        throw new ValidationError('Laporan discrepancy referensi tidak ditemukan.');
      }
    }

    const po = await insertPurchaseOrder(
      {
        poCode: generatePoCode(),
        supplierId: input.supplierId,
        createdBy: managerUser.id,
        orderDate: input.orderDate,
        expectedArrival: input.expectedArrival,
        notes: input.notes,
        referencePoId: input.referencePoId,
        sourceDiscrepancyId: input.sourceDiscrepancyId,
      },
      client
    );

    if (input.sourceDiscrepancyId) {
      await client.query(
        `UPDATE discrepancy_reports
         SET follow_up_po_id = $2
         WHERE id = $1 AND follow_up_po_id IS NULL`,
        [input.sourceDiscrepancyId, po.id]
      );
    }

    for (const item of input.items) {
      await insertPurchaseOrderItem(
        {
          purchaseOrderId: po.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: priceByProductId.get(item.productId),
        },
        client
      );
    }

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'PO_CREATED',
        entityType: 'purchase_order',
        entityId: po.id,
        newState: {
          poCode: po.po_code,
          supplierId: po.supplier_id,
          status: po.status,
          itemCount: input.items.length,
        },
      },
      client
    );

    return po;
  });
}

/**
 * Tahap 2A: Supplier mengonfirmasi pesanan.
 * Status PO berubah dari Pending -> Processing (bukan In Transit, stok belum berubah).
 */
export async function supplierConfirmPo(supplierUser, poId) {
  requirePermission(supplierUser, PERMISSIONS.PO_RESPOND_OWN);

  return withTransaction(async (client) => {
    const po = await findPoById(poId, client, { forUpdate: true });
    if (!po) throw new NotFoundError('Purchase Order tidak ditemukan.');
    assertSupplierOwnership(supplierUser, po.supplier_id);

    if (po.status !== PO_STATUSES.PENDING) {
      throw new ConflictError(`PO ${po.po_code} berstatus ${po.status} dan tidak dapat dikonfirmasi.`);
    }

    const updated = await updatePurchaseOrderStatus(
      po.id,
      { status: PO_STATUSES.CONFIRMED, setConfirmedAt: true },
      client
    );

    await recordAuditEvent(
      {
        actorId: supplierUser.id,
        actorRole: supplierUser.role,
        action: 'PO_CONFIRMED',
        entityType: 'purchase_order',
        entityId: po.id,
        previousState: { status: po.status },
        newState: { status: updated.status },
      },
      client
    );

    return updated;
  });
}

/**
 * Tahap 2B: Supplier menolak pesanan beserta alasan penolakan.
 */
export async function supplierRejectPo(supplierUser, poId, rawInput) {
  requirePermission(supplierUser, PERMISSIONS.PO_RESPOND_OWN);
  const { rejectionReason } = validatePoRejectionInput(rawInput);

  return withTransaction(async (client) => {
    const po = await findPoById(poId, client, { forUpdate: true });
    if (!po) throw new NotFoundError('Purchase Order tidak ditemukan.');
    assertSupplierOwnership(supplierUser, po.supplier_id);

    if (po.status !== PO_STATUSES.PENDING) {
      throw new ConflictError(`PO ${po.po_code} berstatus ${po.status} dan tidak dapat ditolak.`);
    }

    const updated = await updatePurchaseOrderStatus(
      po.id,
      { status: PO_STATUSES.REJECTED, rejectionReason },
      client
    );

    await recordAuditEvent(
      {
        actorId: supplierUser.id,
        actorRole: supplierUser.role,
        action: 'PO_REJECTED',
        entityType: 'purchase_order',
        entityId: po.id,
        previousState: { status: po.status },
        newState: { status: updated.status, rejectionReason },
      },
      client
    );

    return updated;
  });
}

/**
 * Tahap 3: Supplier mengonfirmasi pengiriman barang -> status berubah menjadi In Transit.
 * Status tidak pernah menjadi In Transit sebelum konfirmasi pengiriman ini dilakukan.
 */
export async function supplierSubmitShipment(supplierUser, poId, rawInput) {
  requirePermission(supplierUser, PERMISSIONS.SHIPMENT_MANAGE_OWN);
  const input = validateShipmentInput(rawInput);

  return withTransaction(async (client) => {
    const po = await findPoById(poId, client, { forUpdate: true });
    if (!po) throw new NotFoundError('Purchase Order tidak ditemukan.');
    assertSupplierOwnership(supplierUser, po.supplier_id);

    if (
      ![
        PO_STATUSES.PROCESSING,
        PO_STATUSES.CONFIRMED,
        PO_STATUSES.PREPARING,
        PO_STATUSES.IN_TRANSIT,
      ].includes(po.status)
    ) {
      throw new ConflictError(
        `Data pengiriman tidak dapat disimpan pada PO berstatus ${po.status}.`
      );
    }

    const shipment = await upsertShipmentDetails(
      {
        purchaseOrderId: po.id,
        shippedAt: input.shippedAt,
        courierName: input.courierName,
        trackingNumber: input.trackingNumber,
        noTrackingReason: input.noTrackingReason,
        notes: input.notes,
        submittedBy: supplierUser.id,
      },
      client
    );

    const updatedPo =
      po.status === PO_STATUSES.IN_TRANSIT
        ? po
        : await updatePurchaseOrderStatus(
            po.id,
            { status: PO_STATUSES.IN_TRANSIT },
            client
          );

    await recordAuditEvent(
      {
        actorId: supplierUser.id,
        actorRole: supplierUser.role,
        action: 'PO_SHIPMENT_SUBMITTED',
        entityType: 'purchase_order',
        entityId: po.id,
        previousState: { status: po.status },
        newState: {
          status: updatedPo.status,
          courierName: shipment.courier_name,
          trackingNumber: shipment.tracking_number,
        },
      },
      client
    );

    return { po: updatedPo, shipment };
  });
}

/**
 * Tahap 4: Supplier mengonfirmasi kedatangan barang ke gudang (dapat disertai foto bukti).
 * Informasi ini hanya menjadi informasi awal untuk Manager; tidak mengubah stok dan tidak menyelesaikan PO.
 */
export async function supplierConfirmArrival(supplierUser, poId, rawInput = {}) {
  requirePermission(supplierUser, PERMISSIONS.SHIPMENT_MANAGE_OWN);
  const input = validateSupplierArrivalInput(rawInput);

  return withTransaction(async (client) => {
    const po = await findPoById(poId, client, { forUpdate: true });
    if (!po) throw new NotFoundError('Purchase Order tidak ditemukan.');
    assertSupplierOwnership(supplierUser, po.supplier_id);

    if (po.status !== PO_STATUSES.IN_TRANSIT) {
      throw new ConflictError(
        `Konfirmasi kedatangan hanya dapat dilakukan saat PO berstatus In Transit (saat ini: ${po.status}).`
      );
    }

    const updated = await recordSupplierArrivalConfirmation(
      po.id,
      { userId: supplierUser.id, arrivalNotes: input.arrivalNotes },
      client
    );

    await recordAuditEvent(
      {
        actorId: supplierUser.id,
        actorRole: supplierUser.role,
        action: 'PO_ARRIVAL_CONFIRMED',
        entityType: 'purchase_order',
        entityId: po.id,
        previousState: { status: po.status, arrivalConfirmedAt: po.arrival_confirmed_at },
        newState: {
          status: updated.status,
          arrivalConfirmedAt: updated.arrival_confirmed_at,
          arrivalNotes: updated.arrival_notes,
        },
      },
      client
    );

    return updated;
  });
}

/**
 * Tahap 5: Manager menginstruksikan kepada Staff agar melakukan pemeriksaan fisik.
 * Status PO berpindah menjadi Inspecting (Pending -> Confirmed -> In Transit -> Inspecting).
 */
export async function managerNotifyStaffForInspection(managerUser, poId, rawInput = {}) {
  requirePermission(managerUser, PERMISSIONS.PO_FINALIZE_RECEIVE);
  const input = validateInspectionRequestInput(rawInput);

  return withTransaction(async (client) => {
    const po = await findPoById(poId, client, { forUpdate: true });
    if (!po) throw new NotFoundError('Purchase Order tidak ditemukan.');

    if (
      ![
        PO_STATUSES.IN_TRANSIT,
        PO_STATUSES.INSPECTING,
        PO_STATUSES.RETURNED,
        PO_STATUSES.DELIVERED,
      ].includes(po.status)
    ) {
      throw new ConflictError(
        `PO ${po.po_code} berstatus ${po.status}. Pemeriksaan hanya dapat diinstruksikan pada PO berstatus In Transit atau Returned (pemeriksaan ulang).`
      );
    }

    const activeIncRes = await client.query(
      `SELECT id, transaction_code, status
       FROM transactions
       WHERE purchase_order_id = $1
         AND type = 'incoming'
         AND status IN ('pending', 'approved')
       LIMIT 1`,
      [po.id]
    );
    if (activeIncRes.rows.length > 0) {
      throw new ConflictError(
        `PO ${po.po_code} sudah memiliki transaksi Incoming aktif (${activeIncRes.rows[0].transaction_code} • ${activeIncRes.rows[0].status}).`
      );
    }

    const updated = await recordManagerInspectionRequest(
      po.id,
      { userId: managerUser.id, notes: input.notes },
      client
    );

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'PO_INSPECTING',
        entityType: 'purchase_order',
        entityId: po.id,
        previousState: {
          status: po.status,
          inspectionRequestedAt: po.inspection_requested_at,
        },
        newState: {
          status: updated.status,
          inspectionRequestedAt: updated.inspection_requested_at,
          notes: updated.inspection_request_notes,
        },
      },
      client
    );

    return updated;
  });
}

/**
 * Legacy completion endpoint — deprecated under Final WMS rules where PO terminates
 * atomically at Received (on Incoming Approve) or Returned (on Incoming Reject).
 */
export async function managerCompletePo(managerUser, poId, rawInput = {}) {
  requirePermission(managerUser, PERMISSIONS.PO_FINALIZE_RECEIVE);
  void rawInput;
  const po = await findPoById(poId);
  if (!po) throw new NotFoundError('Purchase Order tidak ditemukan.');
  throw new ConflictError(
    `PO ${po.po_code} tidak diselesaikan secara terpisah. Status PO otomatis berubah menjadi Received saat Incoming disetujui Manager atau Returned saat Incoming ditolak.`
  );
}

export async function managerCancelPo(managerUser, poId) {
  requirePermission(managerUser, PERMISSIONS.PO_CREATE);

  return withTransaction(async (client) => {
    const po = await findPoById(poId, client, { forUpdate: true });
    if (!po) throw new NotFoundError('Purchase Order tidak ditemukan.');

    if (
      ![PO_STATUSES.PENDING, PO_STATUSES.PROCESSING, PO_STATUSES.CONFIRMED].includes(
        po.status
      )
    ) {
      throw new ConflictError(
        `PO berstatus ${po.status} tidak dapat dibatalkan secara langsung.`
      );
    }

    const incCheck = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM transactions
       WHERE purchase_order_id = $1
         AND type = 'incoming'
         AND status IN ('pending', 'approved')`,
      [po.id]
    );
    if ((incCheck.rows[0]?.total ?? 0) > 0) {
      throw new ConflictError(
        'PO yang sudah memiliki transaksi Incoming tidak dapat dibatalkan.'
      );
    }

    const updated = await updatePurchaseOrderStatus(
      po.id,
      { status: PO_STATUSES.CANCELLED },
      client
    );

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'PO_CANCELLED',
        entityType: 'purchase_order',
        entityId: po.id,
        previousState: { status: po.status },
        newState: { status: updated.status },
      },
      client
    );

    return updated;
  });
}
