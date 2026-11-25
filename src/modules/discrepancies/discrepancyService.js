import crypto from 'node:crypto';
import { query, withTransaction } from '../../lib/db/pool.js';
import { PERMISSIONS, requirePermission } from '../../lib/auth/rbac.js';
import { EVIDENCE_ENTITY_TYPES } from '../../lib/constants/statuses.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../lib/constants/errors.js';
import { findProductById, listActiveProductsSimple } from '../products/productRepo.js';
import { getEvidenceListForEntity } from '../files/evidenceService.js';
import { recordAuditEvent } from '../audit/auditService.js';
import {
  validateCreateDiscrepancyInput,
  validateResolveDiscrepancyInput,
  validateRefundClaimInput,
  validateRefundStatusUpdateInput,
} from './discrepancyValidation.js';
import {
  listDiscrepancies,
  findDiscrepancyById,
  insertDiscrepancy,
  updateDiscrepancyResolution,
  updateDiscrepancyRefundClaim,
} from './discrepancyRepo.js';

function generateIssueCode() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `DSC-${datePart}-${randPart}`;
}

export async function getDiscrepanciesOverview(user, filters = {}) {
  requirePermission(user, PERMISSIONS.DISCREPANCY_READ);

  const [list, products, recentTx, recentPos] = await Promise.all([
    listDiscrepancies(filters),
    listActiveProductsSimple(),
    query(
      `SELECT id, transaction_code, type, status
       FROM transactions
       ORDER BY transaction_date DESC
       LIMIT 30`
    ),
    query(
      `SELECT id, po_code, status
       FROM purchase_orders
       ORDER BY created_at DESC
       LIMIT 30`
    ),
  ]);

  return {
    ...list,
    products,
    recentTransactions: recentTx.rows,
    recentPos: recentPos.rows,
  };
}

export async function getDiscrepancyDetail(user, discrepancyId) {
  requirePermission(user, PERMISSIONS.DISCREPANCY_READ);
  const report = await findDiscrepancyById(discrepancyId);
  if (!report) {
    throw new NotFoundError('Laporan discrepancy tidak ditemukan.');
  }

  const evidence = await getEvidenceListForEntity(user, {
    entityType: EVIDENCE_ENTITY_TYPES.DISCREPANCY,
    entityId: report.id,
  });

  return { report, evidence };
}

export async function createDiscrepancyReport(actorUser, rawInput) {
  requirePermission(actorUser, PERMISSIONS.DISCREPANCY_REPORT);
  const input = validateCreateDiscrepancyInput(rawInput);

  return withTransaction(async (client) => {
    const product = await findProductById(input.productId, client);
    if (!product) {
      throw new ValidationError('Produk tidak ditemukan.');
    }

    let transactionId = null;
    let purchaseOrderId = null;

    if (input.sourceType === 'incoming' || input.sourceType === 'outgoing') {
      const txRes = await client.query(
        `SELECT id, type, purchase_order_id FROM transactions WHERE id = $1 LIMIT 1`,
        [input.sourceId]
      );
      if (txRes.rows.length === 0 || txRes.rows[0].type !== input.sourceType) {
        throw new ValidationError(`Transaksi ${input.sourceType} tidak ditemukan.`);
      }
      transactionId = txRes.rows[0].id;
      if (input.sourceType === 'incoming') {
        purchaseOrderId = txRes.rows[0].purchase_order_id || null;
      }
    } else if (input.sourceType === 'purchase_order') {
      const poRes = await client.query(
        `SELECT id FROM purchase_orders WHERE id = $1 LIMIT 1`,
        [input.sourceId]
      );
      if (poRes.rows.length === 0) {
        throw new ValidationError('Purchase Order referensi tidak ditemukan.');
      }
      purchaseOrderId = poRes.rows[0].id;
    }

    const created = await insertDiscrepancy(
      {
        issueCode: generateIssueCode(),
        issueType: input.issueType,
        sourceType: input.sourceType,
        transactionId,
        purchaseOrderId,
        productId: product.id,
        expectedQuantity: input.expectedQuantity,
        actualQuantity: input.actualQuantity,
        difference: input.difference,
        description: input.description,
        reportedBy: actorUser.id,
      },
      client
    );

    await recordAuditEvent(
      {
        actorId: actorUser.id,
        actorRole: actorUser.role,
        action: 'DISCREPANCY_REPORTED',
        entityType: 'discrepancy_report',
        entityId: created.id,
        newState: {
          issueCode: created.issue_code,
          issueType: created.issue_type,
          sourceType: created.source_type,
          productId: created.product_id,
        },
      },
      client
    );

    return created;
  });
}

export async function updateDiscrepancyWorkflow(managerUser, discrepancyId, rawInput) {
  requirePermission(managerUser, PERMISSIONS.DISCREPANCY_RESOLVE);
  const input = validateResolveDiscrepancyInput(rawInput);

  return withTransaction(async (client) => {
    const existing = await findDiscrepancyById(discrepancyId, client, {
      forUpdate: true,
    });
    if (!existing) {
      throw new NotFoundError('Laporan discrepancy tidak ditemukan.');
    }
    if (existing.status === 'closed') {
      throw new ConflictError('Laporan discrepancy yang sudah Closed tidak dapat diubah.');
    }
    if (existing.status === 'resolved' && input.status === 'investigating') {
      throw new ConflictError('Laporan yang sudah Resolved tidak dapat dikembalikan ke Investigating.');
    }

    const updated = await updateDiscrepancyResolution(
      existing.id,
      {
        status: input.status,
        investigationNotes: input.investigationNotes,
        resolutionType: input.resolutionType,
        resolutionNotes: input.resolutionNotes,
        resolvedBy: managerUser.id,
      },
      client
    );

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'DISCREPANCY_UPDATED',
        entityType: 'discrepancy_report',
        entityId: existing.id,
        previousState: { status: existing.status },
        newState: { status: updated.status, resolutionType: updated.resolution_type },
      },
      client
    );

    return updated;
  });
}

/**
 * Manager mengajukan klaim refund manual kepada Supplier atas ketidaksesuaian barang.
 * - Tidak otomatis mengubah stok gudang.
 * - Tidak otomatis membuat PO baru atau menyelesaikan refund secara sepihak.
 */
export async function submitRefundClaim(managerUser, discrepancyId, rawInput) {
  requirePermission(managerUser, PERMISSIONS.DISCREPANCY_RESOLVE);
  const input = validateRefundClaimInput(rawInput);

  return withTransaction(async (client) => {
    const existing = await findDiscrepancyById(discrepancyId, client, {
      forUpdate: true,
    });
    if (!existing) {
      throw new NotFoundError('Laporan discrepancy tidak ditemukan.');
    }

    if (!['none', 'rejected'].includes(existing.refund_status || 'none')) {
      throw new ConflictError(
        `Klaim refund pada ${existing.issue_code} sudah berstatus ${existing.refund_status}.`
      );
    }

    const updated = await updateDiscrepancyRefundClaim(
      existing.id,
      {
        refundStatus: 'submitted',
        refundAmount: input.refundAmount,
        refundNotes: input.refundNotes,
        actorId: managerUser.id,
        isInitialRequest: true,
      },
      client
    );

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'DISCREPANCY_REFUND_CLAIMED',
        entityType: 'discrepancy_report',
        entityId: existing.id,
        previousState: { refundStatus: existing.refund_status },
        newState: {
          refundStatus: 'submitted',
          refundAmount: updated.refund_amount,
          refundNotes: updated.refund_notes,
        },
      },
      client
    );

    return updated;
  });
}

export async function updateRefundClaimStatus(managerUser, discrepancyId, rawInput) {
  requirePermission(managerUser, PERMISSIONS.DISCREPANCY_RESOLVE);
  const input = validateRefundStatusUpdateInput(rawInput);

  return withTransaction(async (client) => {
    const existing = await findDiscrepancyById(discrepancyId, client, {
      forUpdate: true,
    });
    if (!existing) {
      throw new NotFoundError('Laporan discrepancy tidak ditemukan.');
    }

    const curr = existing.refund_status || 'none';
    const validNext =
      curr === 'submitted'
        ? ['approved', 'rejected', 'completed']
        : curr === 'approved'
        ? ['completed', 'rejected']
        : [];

    if (!validNext.includes(input.refundStatus)) {
      throw new ConflictError(
        `Status klaim refund saat ini (${curr}) tidak dapat diubah ke ${input.refundStatus}.`
      );
    }

    const updated = await updateDiscrepancyRefundClaim(
      existing.id,
      {
        refundStatus: input.refundStatus,
        refundAmount: input.refundAmount,
        refundNotes: input.refundNotes,
        actorId: managerUser.id,
        isInitialRequest: false,
      },
      client
    );

    await recordAuditEvent(
      {
        actorId: managerUser.id,
        actorRole: managerUser.role,
        action: 'DISCREPANCY_REFUND_UPDATED',
        entityType: 'discrepancy_report',
        entityId: existing.id,
        previousState: { refundStatus: curr },
        newState: {
          refundStatus: updated.refund_status,
          refundAmount: updated.refund_amount,
          refundNotes: updated.refund_notes,
        },
      },
      client
    );

    return updated;
  });
}
