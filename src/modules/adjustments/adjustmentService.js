import crypto from 'node:crypto';
import { withTransaction } from '../../lib/db/pool.js';
import { PERMISSIONS, requirePermission } from '../../lib/auth/rbac.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../lib/constants/errors.js';
import { findProductById, listActiveProductsSimple } from '../products/productRepo.js';
import {
  findDiscrepancyById,
  listOpenDiscrepanciesSimple,
} from '../discrepancies/discrepancyRepo.js';
import { applyStockChanges } from '../inventory/inventoryService.js';
import { recordAuditEvent } from '../audit/auditService.js';
import {
  validateCreateAdjustmentInput,
  validateAdjustmentRejectionInput,
} from './adjustmentValidation.js';
import {
  listStockAdjustments,
  findAdjustmentById,
  insertStockAdjustment,
  updateAdjustmentReviewStatus,
} from './adjustmentRepo.js';

function generateAdjustmentCode() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `ADJ-${datePart}-${randPart}`;
}

export async function getAdjustmentsOverview(user, filters = {}) {
  requirePermission(user, PERMISSIONS.ADJUSTMENT_READ);

  const [list, products, discrepancies] = await Promise.all([
    listStockAdjustments(filters),
    listActiveProductsSimple(),
    listOpenDiscrepanciesSimple(),
  ]);

  return { ...list, products, discrepancies };
}

export async function createStockAdjustmentRequest(actorUser, rawInput) {
  requirePermission(actorUser, PERMISSIONS.ADJUSTMENT_REQUEST);
  const input = validateCreateAdjustmentInput(rawInput);

  return withTransaction(async (client) => {
    const product = await findProductById(input.productId, client);
    if (!product) {
      throw new ValidationError('Produk tidak ditemukan.');
    }
    if (Number(product.stock) + input.quantityDelta < 0) {
      throw new ConflictError(
        `Penyesuaian (${input.quantityDelta}) akan membuat stok "${product.name}" menjadi negatif (stok saat ini: ${product.stock}).`
      );
    }

    if (input.discrepancyId) {
      const disc = await findDiscrepancyById(input.discrepancyId, client);
      if (!disc) {
        throw new ValidationError('Laporan discrepancy referensi tidak ditemukan.');
      }
    }

    const created = await insertStockAdjustment(
      {
        adjustmentCode: generateAdjustmentCode(),
        productId: product.id,
        discrepancyId: input.discrepancyId,
        adjustmentType: input.adjustmentType,
        quantityDelta: input.quantityDelta,
        reason: input.reason,
        requestedBy: actorUser.id,
      },
      client
    );

    await recordAuditEvent(
      {
        actorId: actorUser.id,
        actorRole: actorUser.role,
        action: 'ADJUSTMENT_REQUESTED',
        entityType: 'stock_adjustment',
        entityId: created.id,
        newState: {
          adjustmentCode: created.adjustment_code,
          productId: created.product_id,
          quantityDelta: created.quantity_delta,
          status: 'pending',
        },
      },
      client
    );

    return created;
  });
}

export async function approveStockAdjustment(managerUser, adjustmentId) {
  requirePermission(managerUser, PERMISSIONS.ADJUSTMENT_APPROVE);

  return withTransaction(async (client) => {
    const adj = await findAdjustmentById(adjustmentId, client, { forUpdate: true });
    if (!adj) {
      throw new NotFoundError('Pengajuan Stock Adjustment tidak ditemukan.');
    }
    if (adj.status !== 'pending') {
      throw new ConflictError(
        `Adjustment ${adj.adjustment_code} berstatus ${adj.status} dan tidak dapat diproses ulang.`
      );
    }
    if (Number(adj.requested_by) === Number(managerUser.id)) {
      throw new ForbiddenError(
        'Pengaju penyesuaian stok tidak diperbolehkan menyetujui pengajuannya sendiri.'
      );
    }

    const movements = await applyStockChanges(
      {
        items: [{ productId: adj.product_id, quantityDelta: adj.quantity_delta }],
        sourceType: 'adjustment',
        stockAdjustmentId: adj.id,
        actorId: managerUser.id,
        notes: `${adj.adjustment_type}: ${adj.reason}`,
      },
      client
    );

    const updated = await updateAdjustmentReviewStatus(
      adj.id,
      { status: 'approved', reviewedBy: managerUser.id },
      client
    );

    const lowStockAlerts = movements.filter((m) =>
      ['Out of Stock', 'Severe', 'Low'].includes(m.stockStatusAfter)
    );

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'ADJUSTMENT_APPROVED',
        entityType: 'stock_adjustment',
        entityId: adj.id,
        previousState: { status: 'pending' },
        newState: { status: 'approved', movements },
      },
      client
    );

    return { ...updated, movements, lowStockAlerts };
  });
}

export async function rejectStockAdjustment(managerUser, adjustmentId, rawInput) {
  requirePermission(managerUser, PERMISSIONS.ADJUSTMENT_APPROVE);
  const { rejectionReason } = validateAdjustmentRejectionInput(rawInput);

  return withTransaction(async (client) => {
    const adj = await findAdjustmentById(adjustmentId, client, { forUpdate: true });
    if (!adj) {
      throw new NotFoundError('Pengajuan Stock Adjustment tidak ditemukan.');
    }
    if (adj.status !== 'pending') {
      throw new ConflictError(`Adjustment ${adj.adjustment_code} berstatus ${adj.status}.`);
    }
    if (Number(adj.requested_by) === Number(managerUser.id)) {
      throw new ForbiddenError(
        'Pengaju penyesuaian stok tidak diperbolehkan mereview pengajuannya sendiri.'
      );
    }

    const updated = await updateAdjustmentReviewStatus(
      adj.id,
      { status: 'rejected', reviewedBy: managerUser.id, rejectionReason },
      client
    );

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'ADJUSTMENT_REJECTED',
        entityType: 'stock_adjustment',
        entityId: adj.id,
        previousState: { status: 'pending' },
        newState: { status: 'rejected', rejectionReason },
      },
      client
    );

    return updated;
  });
}
