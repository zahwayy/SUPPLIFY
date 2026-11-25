import crypto from 'node:crypto';
import { withTransaction } from '../../lib/db/pool.js';
import { PERMISSIONS, requirePermission } from '../../lib/auth/rbac.js';
import {
  EVIDENCE_ENTITY_TYPES,
  TRANSACTION_STATUSES,
} from '../../lib/constants/statuses.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../lib/constants/errors.js';
import { findProductById, listActiveProductsSimple } from '../products/productRepo.js';
import { assertValidProductPrice } from '../products/productValidation.js';
import { applyStockChanges } from '../inventory/inventoryService.js';
import { lockProductsForUpdate } from '../inventory/inventoryRepo.js';
import { getEvidenceListForEntity } from '../files/evidenceService.js';
import { recordAuditEvent } from '../audit/auditService.js';
import {
  findTransactionItems,
  insertTransactionItem,
  updateTransactionReviewStatus,
} from '../incoming/incomingRepo.js';
import { validateTransactionRejectionInput } from '../incoming/incomingValidation.js';
import {
  validateCreateOutgoingInput,
  validateHandoverInput,
} from './outgoingValidation.js';
import {
  listOutgoingTransactions,
  findOutgoingById,
  insertOutgoingHeader,
  updateOutgoingHeader,
  deleteTransactionItems,
  deleteOutgoingTransactionById,
  insertHandoverDetails,
  markOutgoingShipped,
  markOutgoingDelivered,
} from './outgoingRepo.js';

function generateOutgoingCode() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `OUT-${datePart}-${randPart}`;
}

export async function getOutgoingOverview(user, filters = {}) {
  requirePermission(user, PERMISSIONS.TRANSACTIONS_READ);
  const [list, availableProducts] = await Promise.all([
    listOutgoingTransactions(filters),
    listActiveProductsSimple(),
  ]);
  return { ...list, availableProducts };
}

export async function getOutgoingDetail(user, txId) {
  requirePermission(user, PERMISSIONS.TRANSACTIONS_READ);
  const tx = await findOutgoingById(txId);
  if (!tx) {
    throw new NotFoundError('Transaksi Outgoing tidak ditemukan.');
  }

  const [items, evidence, availableProducts] = await Promise.all([
    findTransactionItems(tx.id),
    getEvidenceListForEntity(user, {
      entityType: EVIDENCE_ENTITY_TYPES.OUTGOING_HANDOVER,
      entityId: tx.id,
    }),
    tx.status === TRANSACTION_STATUSES.PENDING
      ? listActiveProductsSimple()
      : Promise.resolve([]),
  ]);

  return { tx, items, evidence, availableProducts };
}

export async function createOutgoingTransaction(staffUser, rawInput) {
  requirePermission(staffUser, PERMISSIONS.TRANSACTIONS_CREATE);
  const input = validateCreateOutgoingInput(rawInput);

  return withTransaction(async (client) => {
    const priceByProductId = new Map();
    for (const item of input.items) {
      const product = await findProductById(item.productId, client);
      if (!product || product.deleted_at) {
        throw new ValidationError(
          `Produk dengan ID ${item.productId} tidak ditemukan atau sedang diarsipkan.`
        );
      }
      if (item.quantity > Number(product.stock)) {
        throw new ConflictError(
          `Permintaan tidak dapat diproses karena jumlah "${product.name}" (${item.quantity}) melebihi stok yang tersedia (${product.stock}).`
        );
      }
      priceByProductId.set(item.productId, assertValidProductPrice(product));
    }

    const created = await insertOutgoingHeader(
      {
        transactionCode: generateOutgoingCode(),
        createdBy: staffUser.id,
        shipmentDate: input.shipmentDate,
        recipientName: input.recipientName,
        notes: input.notes,
      },
      client
    );

    for (const item of input.items) {
      await insertTransactionItem(
        {
          transactionId: created.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: priceByProductId.get(item.productId),
          notes: item.notes,
        },
        client
      );
    }

    await recordAuditEvent(
      {
        actorId: staffUser.id,
        actorRole: staffUser.role,
        action: 'OUTGOING_CREATED',
        entityType: 'transaction',
        entityId: created.id,
        newState: {
          transactionCode: created.transaction_code,
          status: created.status,
          shipmentDate: input.shipmentDate,
          recipientName: input.recipientName,
          itemCount: input.items.length,
        },
      },
      client
    );

    return created;
  });
}

export async function updatePendingOutgoingTransaction(staffUser, txId, rawInput) {
  requirePermission(staffUser, PERMISSIONS.TRANSACTIONS_CREATE);
  const input = validateCreateOutgoingInput(rawInput);

  return withTransaction(async (client) => {
    const tx = await findOutgoingById(txId, client, { forUpdate: true });
    if (!tx) {
      throw new NotFoundError('Transaksi Outgoing tidak ditemukan.');
    }
    if (tx.status !== TRANSACTION_STATUSES.PENDING) {
      throw new ConflictError(
        `Transaksi ${tx.transaction_code} berstatus ${tx.status}; hanya pengajuan Pending yang dapat diubah.`
      );
    }
    if (Number(tx.created_by) !== Number(staffUser.id)) {
      throw new ForbiddenError(
        'Hanya pembuat pengajuan yang dapat mengubah transaksi Outgoing Pending ini.'
      );
    }

    const priceByProductId = new Map();
    for (const item of input.items) {
      const product = await findProductById(item.productId, client);
      if (!product || product.deleted_at) {
        throw new ValidationError(
          `Produk dengan ID ${item.productId} tidak ditemukan atau sedang diarsipkan.`
        );
      }
      if (item.quantity > Number(product.stock)) {
        throw new ConflictError(
          `Jumlah "${product.name}" (${item.quantity}) melebihi stok yang tersedia (${product.stock}).`
        );
      }
      priceByProductId.set(item.productId, assertValidProductPrice(product));
    }

    const updated = await updateOutgoingHeader(
      tx.id,
      {
        shipmentDate: input.shipmentDate,
        recipientName: input.recipientName,
        notes: input.notes,
      },
      client
    );

    await deleteTransactionItems(tx.id, client);
    for (const item of input.items) {
      await insertTransactionItem(
        {
          transactionId: tx.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: priceByProductId.get(item.productId),
          notes: item.notes,
        },
        client
      );
    }

    await recordAuditEvent(
      {
        actorId: staffUser.id,
        actorRole: staffUser.role,
        action: 'OUTGOING_UPDATED',
        entityType: 'transaction',
        entityId: tx.id,
        previousState: {
          shipmentDate: tx.shipment_date,
          recipientName: tx.planned_recipient_name || tx.recipient_name,
          notes: tx.notes,
        },
        newState: {
          shipmentDate: input.shipmentDate,
          recipientName: input.recipientName,
          itemCount: input.items.length,
        },
      },
      client
    );

    return updated;
  });
}

export async function deletePendingOutgoingTransaction(staffUser, txId) {
  requirePermission(staffUser, PERMISSIONS.TRANSACTIONS_CREATE);

  return withTransaction(async (client) => {
    const tx = await findOutgoingById(txId, client, { forUpdate: true });
    if (!tx) {
      throw new NotFoundError('Transaksi Outgoing tidak ditemukan.');
    }
    if (tx.status !== TRANSACTION_STATUSES.PENDING) {
      throw new ConflictError(
        `Transaksi ${tx.transaction_code} berstatus ${tx.status}; hanya pengajuan Pending yang dapat dihapus.`
      );
    }
    if (Number(tx.created_by) !== Number(staffUser.id)) {
      throw new ForbiddenError(
        'Hanya pembuat pengajuan yang dapat menghapus transaksi Outgoing Pending ini.'
      );
    }

    const cntRes = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM stock_movements WHERE transaction_id = $1) AS mov_cnt,
         (SELECT COUNT(*)::int FROM discrepancy_reports WHERE transaction_id = $1) AS disc_cnt,
         (SELECT COUNT(*)::int FROM evidence_files WHERE transaction_id = $1) AS ev_cnt`,
      [tx.id]
    );
    const { mov_cnt, disc_cnt, ev_cnt } = cntRes.rows[0] || {};
    if ((mov_cnt ?? 0) > 0 || (disc_cnt ?? 0) > 0 || (ev_cnt ?? 0) > 0) {
      throw new ConflictError(
        `Transaksi ${tx.transaction_code} tidak dapat dihapus karena sudah memiliki catatan pergerakan stok, discrepancy, atau lampiran bukti.`
      );
    }

    await deleteTransactionItems(tx.id, client);
    await deleteOutgoingTransactionById(tx.id, client);

    await recordAuditEvent(
      {
        actorId: staffUser.id,
        actorRole: staffUser.role,
        action: 'OUTGOING_DELETED',
        entityType: 'transaction',
        entityId: tx.id,
        previousState: {
          transactionCode: tx.transaction_code,
          status: tx.status,
        },
      },
      client
    );

    return { id: tx.id, transaction_code: tx.transaction_code };
  });
}

export async function approveOutgoingTransaction(managerUser, txId) {
  requirePermission(managerUser, PERMISSIONS.TRANSACTIONS_APPROVE);

  return withTransaction(async (client) => {
    const tx = await findOutgoingById(txId, client, { forUpdate: true });
    if (!tx) {
      throw new NotFoundError('Transaksi Outgoing tidak ditemukan.');
    }
    if (tx.status !== TRANSACTION_STATUSES.PENDING) {
      throw new ConflictError(
        `Transaksi ${tx.transaction_code} berstatus ${tx.status} dan tidak dapat disetujui ulang.`
      );
    }
    if (Number(tx.created_by) === Number(managerUser.id)) {
      throw new ForbiddenError('Pembuat transaksi tidak boleh menyetujui transaksinya sendiri.');
    }

    const items = await findTransactionItems(tx.id, client);
    if (items.length === 0) {
      throw new ValidationError('Transaksi Outgoing tidak memiliki item produk.');
    }

    // Cek ketersediaan stok terkini (tanpa mengurangi stok — stok baru berkurang saat Staff Shipped)
    const productIds = items.map((i) => Number(i.product_id));
    const lockedProducts = await lockProductsForUpdate(productIds, client);
    const productMap = new Map(lockedProducts.map((p) => [Number(p.id), p]));

    for (const item of items) {
      const product = productMap.get(Number(item.product_id));
      if (!product || product.deleted_at) {
        throw new ValidationError(
          `Produk "${item.product_name || item.sku}" tidak ditemukan atau sedang diarsipkan.`
        );
      }
      if (Number(item.quantity) > Number(product.stock)) {
        throw new ConflictError(
          `Stok "${product.name}" (${product.sku}) tidak mencukupi. Tersedia: ${product.stock}, diminta: ${item.quantity}.`
        );
      }
    }

    const updated = await updateTransactionReviewStatus(
      tx.id,
      { status: TRANSACTION_STATUSES.APPROVED, processedBy: managerUser.id },
      client
    );

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'OUTGOING_APPROVED',
        entityType: 'transaction',
        entityId: tx.id,
        previousState: { status: TRANSACTION_STATUSES.PENDING },
        newState: {
          status: TRANSACTION_STATUSES.APPROVED,
          note: 'Stok belum berkurang hingga Staff menandai Shipped',
        },
      },
      client
    );

    return updated;
  });
}

export async function rejectOutgoingTransaction(managerUser, txId, rawInput) {
  requirePermission(managerUser, PERMISSIONS.TRANSACTIONS_APPROVE);
  const { rejectionReason } = validateTransactionRejectionInput(rawInput);

  return withTransaction(async (client) => {
    const tx = await findOutgoingById(txId, client, { forUpdate: true });
    if (!tx) throw new NotFoundError('Transaksi Outgoing tidak ditemukan.');
    if (tx.status !== TRANSACTION_STATUSES.PENDING) {
      throw new ConflictError(
        `Transaksi ${tx.transaction_code} berstatus ${tx.status} dan tidak dapat ditolak.`
      );
    }

    const updated = await updateTransactionReviewStatus(
      tx.id,
      {
        status: TRANSACTION_STATUSES.REJECTED,
        processedBy: managerUser.id,
        rejectionReason,
      },
      client
    );

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'OUTGOING_REJECTED',
        entityType: 'transaction',
        entityId: tx.id,
        previousState: { status: TRANSACTION_STATUSES.PENDING },
        newState: { status: TRANSACTION_STATUSES.REJECTED, rejectionReason },
      },
      client
    );

    return updated;
  });
}

export async function cancelOutgoingTransaction(staffUser, txId) {
  requirePermission(staffUser, PERMISSIONS.TRANSACTIONS_CREATE);

  return withTransaction(async (client) => {
    const tx = await findOutgoingById(txId, client, { forUpdate: true });
    if (!tx) throw new NotFoundError('Transaksi Outgoing tidak ditemukan.');
    if (Number(tx.created_by) !== Number(staffUser.id)) {
      throw new ForbiddenError('Anda hanya dapat membatalkan pengajuan Outgoing milik Anda sendiri.');
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
        action: 'OUTGOING_CANCELLED',
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

export async function recordOutgoingHandover(actorUser, txId, rawInput = {}) {
  requirePermission(actorUser, PERMISSIONS.TRANSACTIONS_HANDOVER);

  return withTransaction(async (client) => {
    const tx = await findOutgoingById(txId, client, { forUpdate: true });
    if (!tx) throw new NotFoundError('Transaksi Outgoing tidak ditemukan.');
    if (tx.status !== TRANSACTION_STATUSES.APPROVED) {
      throw new ConflictError(
        'Pengiriman (Shipped) hanya dapat dicatat pada Outgoing berstatus Approved.'
      );
    }

    const input = validateHandoverInput(rawInput, {
      fallbackRecipientName: tx.planned_recipient_name || tx.recipient_name || '',
    });

    // Guard idempoten agar tidak pernah terjadi double deduction pada Stock Movement
    const existingMovementRes = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM stock_movements
       WHERE transaction_id = $1 AND source_type = 'outgoing'`,
      [tx.id]
    );
    if ((existingMovementRes.rows[0]?.total ?? 0) > 0) {
      throw new ConflictError(
        `Pergerakan stok keluar untuk ${tx.transaction_code} sudah pernah dicatat.`
      );
    }

    const items = await findTransactionItems(tx.id, client);
    if (items.length === 0) {
      throw new ValidationError('Transaksi Outgoing tidak memiliki item produk.');
    }

    // Stok berkurang SEKALI secara atomik saat Staff menandai Outgoing Shipped
    const movements = await applyStockChanges(
      {
        items: items.map((i) => ({
          productId: i.product_id,
          quantityDelta: -Number(i.quantity),
        })),
        sourceType: 'outgoing',
        transactionId: tx.id,
        actorId: actorUser.id,
        notes: `Outgoing shipped (${tx.transaction_code})`,
      },
      client
    );

    const lowStockAlerts = movements.filter((m) =>
      ['Out of Stock', 'Severe', 'Low'].includes(m.stockStatusAfter)
    );

    const handover = await insertHandoverDetails(
      {
        transactionId: tx.id,
        recipientName: input.recipientName,
        recipientType: input.recipientType,
        recipientContact: input.recipientContact,
        handoverMethod: input.handoverMethod,
        handedOverBy: actorUser.id,
        courierName: input.courierName,
        trackingNumber: input.trackingNumber,
        notes: input.notes,
      },
      client
    );

    const updated = await markOutgoingShipped(tx.id, client);

    await recordAuditEvent(
      {
        actorId: actorUser.id,
        actorRole: actorUser.role,
        action: 'OUTGOING_SHIPPED',
        entityType: 'transaction',
        entityId: tx.id,
        previousState: { status: TRANSACTION_STATUSES.APPROVED },
        newState: {
          status: TRANSACTION_STATUSES.SHIPPED,
          recipientName: handover.recipient_name,
          handoverMethod: handover.handover_method,
          movements,
        },
      },
      client
    );

    return { tx: updated, handover, movements, lowStockAlerts };
  });
}

export const shipOutgoingTransaction = recordOutgoingHandover;

export async function confirmOutgoingDelivery(actorUser, txId) {
  requirePermission(actorUser, PERMISSIONS.TRANSACTIONS_HANDOVER);

  return withTransaction(async (client) => {
    const tx = await findOutgoingById(txId, client, { forUpdate: true });
    if (!tx) throw new NotFoundError('Transaksi Outgoing tidak ditemukan.');
    if (tx.status !== TRANSACTION_STATUSES.SHIPPED) {
      throw new ConflictError(
        'Konfirmasi diterima hanya dapat dilakukan pada Outgoing berstatus Shipped.'
      );
    }

    const updated = await markOutgoingDelivered(tx.id, client);

    await recordAuditEvent(
      {
        actorId: actorUser.id,
        actorRole: actorUser.role,
        action: 'OUTGOING_DELIVERED',
        entityType: 'transaction',
        entityId: tx.id,
        previousState: { status: TRANSACTION_STATUSES.SHIPPED },
        newState: { status: TRANSACTION_STATUSES.DELIVERED },
      },
      client
    );

    return updated;
  });
}
