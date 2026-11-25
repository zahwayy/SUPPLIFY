import crypto from 'node:crypto';
import { withTransaction } from '../../lib/db/pool.js';
import { PERMISSIONS, requirePermission } from '../../lib/auth/rbac.js';
import {
  EVIDENCE_ENTITY_TYPES,
  PO_STATUSES,
  TRANSACTION_STATUSES,
} from '../../lib/constants/statuses.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../lib/constants/errors.js';
import {
  findPoById,
  findPoItems,
  updatePurchaseOrderStatus,
  updatePoFollowupNotes,
} from '../purchase-orders/poRepo.js';
import { insertDiscrepancy } from '../discrepancies/discrepancyRepo.js';
import { applyStockChanges } from '../inventory/inventoryService.js';
import { assertValidProductPrice } from '../products/productValidation.js';
import { getEvidenceListForEntity } from '../files/evidenceService.js';
import { recordAuditEvent } from '../audit/auditService.js';
import {
  validateApproveIncomingInput,
  validateCreateIncomingInput,
  validateTransactionRejectionInput,
} from './incomingValidation.js';
import {
  listIncomingTransactions,
  listEligiblePosForIncoming,
  findIncomingById,
  findTransactionItems,
  insertIncomingHeader,
  insertTransactionItem,
  updateTransactionItemApproval,
  updateTransactionReviewStatus,
} from './incomingRepo.js';

function generateIncomingCode() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `INC-${datePart}-${randPart}`;
}

export async function getIncomingOverview(user, filters = {}) {
  requirePermission(user, PERMISSIONS.TRANSACTIONS_READ);
  const [list, eligiblePos] = await Promise.all([
    listIncomingTransactions(filters),
    listEligiblePosForIncoming(),
  ]);
  return { ...list, eligiblePos };
}

export async function getIncomingDetail(user, txId) {
  requirePermission(user, PERMISSIONS.TRANSACTIONS_READ);
  const tx = await findIncomingById(txId);
  if (!tx) {
    throw new NotFoundError('Transaksi Incoming tidak ditemukan.');
  }

  const [items, evidence, arrivalEvidence] = await Promise.all([
    findTransactionItems(tx.id),
    getEvidenceListForEntity(user, {
      entityType: EVIDENCE_ENTITY_TYPES.INCOMING_INSPECTION,
      entityId: tx.id,
    }),
    getEvidenceListForEntity(user, {
      entityType: EVIDENCE_ENTITY_TYPES.SUPPLIER_ARRIVAL,
      entityId: tx.purchase_order_id,
    }),
  ]);

  return { tx, items, evidence, arrivalEvidence };
}

/**
 * Tahap 6: Staff melakukan pemeriksaan fisik barang dan mengirim laporan Incoming.
 * - Strictly ONE non-Rejected (Pending or Approved) Incoming Transaction per PO.
 * - PO harus berada pada tahap Inspecting (atau Returned apabila Incoming sebelumnya ditolak).
 * - TIDAK menambah stok. Penambahan stok hanya terjadi setelah disetujui Manager.
 */
export async function createIncomingTransaction(staffUser, rawInput) {
  requirePermission(staffUser, PERMISSIONS.TRANSACTIONS_CREATE);
  const input = validateCreateIncomingInput(rawInput);

  return withTransaction(async (client) => {
    const po = await findPoById(input.purchaseOrderId, client, { forUpdate: true });
    if (!po) {
      throw new NotFoundError('Purchase Order tidak ditemukan.');
    }

    const isEligible = [PO_STATUSES.INSPECTING, PO_STATUSES.RETURNED].includes(
      po.status
    );

    if (!isEligible) {
      if (
        [PO_STATUSES.RECEIVED, PO_STATUSES.COMPLETED].includes(po.status)
      ) {
        throw new ConflictError(
          `PO ${po.po_code} sudah berstatus ${po.status}. Tidak ada pengajuan Incoming lanjutan untuk PO yang sama; buat PO baru terpisah jika barang masih dibutuhkan.`
        );
      }
      if (po.status === PO_STATUSES.IN_TRANSIT) {
        throw new ConflictError(
          `PO ${po.po_code} masih berstatus In Transit. Menunggu Warehouse Manager menetapkan status Inspecting.`
        );
      }
      throw new ConflictError(
        `PO ${po.po_code} berstatus ${po.status}. Incoming hanya dapat dibuat untuk PO berstatus Inspecting.`
      );
    }

    // Aturan mutlak WMS Final: Satu PO hanya boleh memiliki SATU Incoming non-Rejected (Pending atau Approved)
    const activeIncomingCheck = await client.query(
      `SELECT id, transaction_code, status
       FROM transactions
       WHERE type = 'incoming'
         AND purchase_order_id = $1
         AND status IN ('pending', 'approved')
       LIMIT 1`,
      [po.id]
    );
    if (activeIncomingCheck.rows.length > 0) {
      const existingInc = activeIncomingCheck.rows[0];
      throw new ConflictError(
        `PO ${po.po_code} sudah memiliki transaksi Incoming aktif (${existingInc.transaction_code} • ${existingInc.status}). Satu PO hanya boleh memiliki satu Incoming Transaction non-Rejected.`
      );
    }

    const poItems = await findPoItems(po.id, client);
    const poItemMap = new Map(poItems.map((i) => [Number(i.product_id), i]));
    const resolvedPriceByProduct = new Map();
    for (const item of input.items) {
      const poItem = poItemMap.get(item.productId);
      if (!poItem) {
        throw new ValidationError(
          'Terdapat produk yang tidak tercantum pada Purchase Order referensi.'
        );
      }
      const snapshotOrMaster = poItem.unit_price ?? poItem.purchase_price;
      resolvedPriceByProduct.set(
        item.productId,
        assertValidProductPrice({
          name: poItem.product_name,
          sku: poItem.sku,
          purchase_price: snapshotOrMaster,
        })
      );
    }

    // Bila PO sebelumnya Returned karena Incoming ditolak dan Staff mengajukan pemeriksaan ulang, kembalikan status PO ke Inspecting
    if (po.status === PO_STATUSES.RETURNED) {
      await updatePurchaseOrderStatus(
        po.id,
        { status: PO_STATUSES.INSPECTING },
        client
      );
    }

    let created;
    try {
      created = await insertIncomingHeader(
        {
          transactionCode: generateIncomingCode(),
          createdBy: staffUser.id,
          purchaseOrderId: po.id,
          receivingDate: input.receivingDate,
          notes: input.notes,
        },
        client
      );
    } catch (err) {
      if (err?.code === '23505') {
        throw new ConflictError(
          `PO ${po.po_code} sudah memiliki transaksi Incoming aktif. Satu PO hanya boleh memiliki satu Incoming Transaction non-Rejected.`
        );
      }
      throw err;
    }

    for (const item of input.items) {
      await insertTransactionItem(
        {
          transactionId: created.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: resolvedPriceByProduct.get(item.productId),
          goodQuantity: item.goodQuantity,
          damagedQuantity: item.damagedQuantity,
          conditionStatus: item.conditionStatus,
          notes: item.notes,
        },
        client
      );
    }

    await recordAuditEvent(
      {
        actorId: staffUser.id,
        actorRole: staffUser.role,
        action: 'INCOMING_CREATED',
        entityType: 'transaction',
        entityId: created.id,
        newState: {
          transactionCode: created.transaction_code,
          purchaseOrderId: po.id,
          poCode: po.po_code,
          status: created.status,
        },
      },
      client
    );

    return created;
  });
}

/**
 * Tahap 7 & 8: Manager menentukan Accepted Quantity manual per produk dan menyetujui Incoming.
 * - Rumus: Stok akhir = Stok sebelumnya + Accepted Quantity yang ditetapkan Manager.
 * - Status Incoming menjadi Approved dan status PO otomatis menjadi Received dalam satu transaksi atomik.
 * - Barang yang tidak diterima / rusak dicatat sebagai Discrepancy (tanpa partial fulfillment atau PO otomatis).
 */
export async function approveIncomingTransaction(managerUser, txId, rawReviewInput = null) {
  requirePermission(managerUser, PERMISSIONS.TRANSACTIONS_APPROVE);

  return withTransaction(async (client) => {
    const tx = await findIncomingById(txId, client, { forUpdate: true });
    if (!tx) {
      throw new NotFoundError('Transaksi Incoming tidak ditemukan.');
    }
    if (tx.status !== TRANSACTION_STATUSES.PENDING) {
      throw new ConflictError(
        `Transaksi ${tx.transaction_code} sudah berstatus ${tx.status} dan tidak dapat disetujui ulang.`
      );
    }
    if (Number(tx.created_by) === Number(managerUser.id)) {
      throw new ForbiddenError('Pembuat transaksi tidak boleh menyetujui transaksinya sendiri.');
    }

    const po = await findPoById(tx.purchase_order_id, client, { forUpdate: true });
    if (!po) {
      throw new NotFoundError('Purchase Order referensi tidak ditemukan.');
    }
    if (
      ![PO_STATUSES.INSPECTING, PO_STATUSES.IN_TRANSIT, PO_STATUSES.DELIVERED].includes(
        po.status
      )
    ) {
      throw new ConflictError(
        `PO ${po.po_code} berstatus ${po.status} dan tidak dapat diselesaikan melalui persetujuan Incoming.`
      );
    }

    const existingMovementRes = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM stock_movements
       WHERE transaction_id = $1 AND source_type = 'incoming'`,
      [tx.id]
    );
    if ((existingMovementRes.rows[0]?.total ?? 0) > 0) {
      throw new ConflictError(
        `Pergerakan stok untuk ${tx.transaction_code} sudah pernah dicatat.`
      );
    }

    const items = await findTransactionItems(tx.id, client);
    if (items.length === 0) {
      throw new ValidationError('Transaksi Incoming tidak memiliki item produk.');
    }

    const { decisions, supplierFollowupNotes } = validateApproveIncomingInput(
      rawReviewInput,
      items
    );

    for (const d of decisions) {
      await updateTransactionItemApproval(
        {
          transactionId: tx.id,
          productId: d.productId,
          approvedQuantity: d.approvedQuantity,
          discrepancyAction: d.discrepancyAction,
          managerNotes: d.managerNotes,
        },
        client
      );
    }

    // Hanya Accepted Quantity yang disetujui Manager (> 0) yang menambah stok & dicatat pada Stock Movement
    const stockItemsToApply = decisions
      .filter((d) => d.approvedQuantity > 0)
      .map((d) => ({
        productId: d.productId,
        quantityDelta: d.approvedQuantity,
      }));

    const movements = await applyStockChanges(
      {
        items: stockItemsToApply,
        sourceType: 'incoming',
        transactionId: tx.id,
        actorId: managerUser.id,
        notes: `Incoming approved (${tx.transaction_code} • ${tx.po_code})`,
      },
      client
    );

    const updated = await updateTransactionReviewStatus(
      tx.id,
      { status: TRANSACTION_STATUSES.APPROVED, processedBy: managerUser.id },
      client
    );

    if (supplierFollowupNotes) {
      await updatePoFollowupNotes(po.id, supplierFollowupNotes, client);
    }

    // Status PO otomatis berubah menjadi Received secara atomik (tanpa multi-incoming / auto partial fulfillment)
    await updatePurchaseOrderStatus(
      po.id,
      { status: PO_STATUSES.RECEIVED, setReceivedAt: true },
      client
    );

    // Catat Discrepancy secara eksplisit bila Accepted Quantity < PO Qty atau ada barang rusak
    const itemById = new Map(items.map((it) => [Number(it.product_id), it]));
    const createdDiscrepancies = [];
    for (const d of decisions) {
      const hasShortage = d.discrepancyQuantity > 0;
      const hasDamage = d.damagedQty > 0;
      if (!hasShortage && !hasDamage) continue;

      const srcItem = itemById.get(d.productId);
      const issueCode = `DSC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const issueType = hasDamage ? 'damaged' : 'shortage';
      const descParts = [
        `Ketidaksesuaian penerimaan ${tx.transaction_code} (PO ${po.po_code}) pada ${srcItem?.sku || `produk #${d.productId}`}.`,
        `Dipesan: ${d.orderedQty}, Diperiksa fisik: ${d.receivedQty} (Rusak: ${d.damagedQty}), Accepted: ${d.approvedQuantity}, Discrepancy: ${d.discrepancyQuantity}.`,
      ];
      if (d.managerNotes) descParts.push(`Catatan Manager: ${d.managerNotes}`);

      const disc = await insertDiscrepancy(
        {
          issueCode,
          issueType,
          sourceType: 'incoming',
          transactionId: tx.id,
          purchaseOrderId: po.id,
          productId: d.productId,
          expectedQuantity: d.orderedQty,
          inspectedQuantity: d.receivedQty,
          acceptedQuantity: d.approvedQuantity,
          actualQuantity: d.approvedQuantity,
          difference: d.approvedQuantity - d.orderedQty,
          description: descParts.join(' '),
          reportedBy: managerUser.id,
        },
        client
      );
      createdDiscrepancies.push(disc);
    }

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'PO_RECEIVED',
        entityType: 'purchase_order',
        entityId: po.id,
        previousState: { status: po.status },
        newState: {
          status: PO_STATUSES.RECEIVED,
          triggeredByIncoming: tx.transaction_code,
        },
      },
      client
    );

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'INCOMING_APPROVED',
        entityType: 'transaction',
        entityId: tx.id,
        previousState: { status: TRANSACTION_STATUSES.PENDING },
        newState: {
          status: TRANSACTION_STATUSES.APPROVED,
          poCode: po.po_code,
          poStatus: PO_STATUSES.RECEIVED,
          movements,
          discrepancyCount: createdDiscrepancies.length,
        },
      },
      client
    );

    return {
      ...updated,
      poStatus: PO_STATUSES.RECEIVED,
      poCompleted: true,
      movements,
      createdDiscrepancies,
    };
  });
}

export async function rejectIncomingTransaction(managerUser, txId, rawInput) {
  requirePermission(managerUser, PERMISSIONS.TRANSACTIONS_APPROVE);
  const { rejectionReason } = validateTransactionRejectionInput(rawInput);

  return withTransaction(async (client) => {
    const tx = await findIncomingById(txId, client, { forUpdate: true });
    if (!tx) {
      throw new NotFoundError('Transaksi Incoming tidak ditemukan.');
    }
    if (tx.status !== TRANSACTION_STATUSES.PENDING) {
      throw new ConflictError(
        `Transaksi ${tx.transaction_code} berstatus ${tx.status} dan tidak dapat ditolak.`
      );
    }

    const po = await findPoById(tx.purchase_order_id, client, { forUpdate: true });

    const updated = await updateTransactionReviewStatus(
      tx.id,
      {
        status: TRANSACTION_STATUSES.REJECTED,
        processedBy: managerUser.id,
        rejectionReason,
      },
      client
    );

    if (po) {
      await updatePurchaseOrderStatus(
        po.id,
        { status: PO_STATUSES.RETURNED, rejectionReason },
        client
      );

      await recordAuditEvent(
        {
          actorId: managerUser.id,
          actorRole: managerUser.role,
          action: 'PO_RETURNED',
          entityType: 'purchase_order',
          entityId: po.id,
          previousState: { status: po.status },
          newState: {
            status: PO_STATUSES.RETURNED,
            triggeredByIncoming: tx.transaction_code,
            rejectionReason,
          },
        },
        client
      );
    }

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'INCOMING_REJECTED',
        entityType: 'transaction',
        entityId: tx.id,
        previousState: { status: TRANSACTION_STATUSES.PENDING },
        newState: {
          status: TRANSACTION_STATUSES.REJECTED,
          poStatus: PO_STATUSES.RETURNED,
          rejectionReason,
        },
      },
      client
    );

    return updated;
  });
}

export async function cancelIncomingTransaction(staffUser, txId) {
  requirePermission(staffUser, PERMISSIONS.TRANSACTIONS_CREATE);

  return withTransaction(async (client) => {
    const tx = await findIncomingById(txId, client, { forUpdate: true });
    if (!tx) throw new NotFoundError('Transaksi Incoming tidak ditemukan.');
    if (Number(tx.created_by) !== Number(staffUser.id)) {
      throw new ForbiddenError('Anda hanya dapat membatalkan pengajuan Incoming milik Anda sendiri.');
    }
    if (tx.status !== TRANSACTION_STATUSES.PENDING) {
      throw new ConflictError('Hanya transaksi Pending yang dapat dibatalkan.');
    }

    const updated = await updateTransactionReviewStatus(
      tx.id,
      { status: TRANSACTION_STATUSES.CANCELLED },
      client
    );

    await recordAuditEvent(
      {
        actorId: staffUser.id,
        actorRole: staffUser.role,
        action: 'INCOMING_CANCELLED',
        entityType: 'transaction',
        entityId: tx.id,
        previousState: { status: TRANSACTION_STATUSES.PENDING },
        newState: { status: TRANSACTION_STATUSES.CANCELLED },
      },
      client
    );

    return updated;
  });
}
