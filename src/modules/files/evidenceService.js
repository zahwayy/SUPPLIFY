import { query } from '../../lib/db/pool.js';
import {
  assertSupplierOwnership,
  hasPermission,
  PERMISSIONS,
  requireAuth,
} from '../../lib/auth/rbac.js';
import { ROLES } from '../../lib/constants/roles.js';
import { EVIDENCE_ENTITY_TYPES } from '../../lib/constants/statuses.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../lib/constants/errors.js';
import {
  deleteFile,
  readFile,
  saveFile,
} from '../../lib/storage/index.js';
import { recordAuditEvent } from '../audit/auditService.js';
import {
  deleteEvidenceById,
  findEvidenceWithContextById,
  insertEvidenceFile,
  listEvidenceForEntity,
} from './evidenceRepo.js';

const VALID_TYPES = new Set(Object.values(EVIDENCE_ENTITY_TYPES));

async function verifyEntityTargetAndAccess(user, { entityType, entityId, mode }) {
  requireAuth(user);
  if (!VALID_TYPES.has(entityType)) {
    throw new ValidationError('Tipe entitas bukti tidak valid.');
  }
  if (!Number.isInteger(Number(entityId)) || Number(entityId) <= 0) {
    throw new ValidationError('ID entitas bukti tidak valid.');
  }

  if (entityType === EVIDENCE_ENTITY_TYPES.INCOMING_INSPECTION) {
    if (user.role === ROLES.SUPPLIER) {
      throw new ForbiddenError('Supplier tidak dapat mengakses bukti inspeksi gudang.');
    }
    if (mode === 'read' && !hasPermission(user, PERMISSIONS.TRANSACTIONS_READ)) {
      throw new ForbiddenError();
    }
    if (mode === 'upload' && !hasPermission(user, PERMISSIONS.TRANSACTIONS_CREATE)) {
      throw new ForbiddenError('Hanya Warehouse Staff yang dapat mengunggah bukti pemeriksaan fisik Incoming.');
    }
    const { rows } = await query(
      `SELECT id, type, status FROM transactions WHERE id = $1 LIMIT 1`,
      [entityId]
    );
    const tx = rows[0];
    if (!tx || tx.type !== 'incoming') {
      throw new NotFoundError('Transaksi Incoming tidak ditemukan.');
    }
    if (mode === 'upload' && !['pending'].includes(tx.status)) {
      throw new ConflictError('Bukti inspeksi hanya dapat ditambahkan saat Incoming masih Pending.');
    }
    return { transactionId: tx.id, purchaseOrderId: null, discrepancyId: null };
  }

  if (entityType === EVIDENCE_ENTITY_TYPES.OUTGOING_HANDOVER) {
    if (user.role === ROLES.SUPPLIER) {
      throw new ForbiddenError('Supplier tidak dapat mengakses bukti serah terima gudang.');
    }
    if (mode === 'read' && !hasPermission(user, PERMISSIONS.TRANSACTIONS_READ)) {
      throw new ForbiddenError();
    }
    if (mode === 'upload' && !hasPermission(user, PERMISSIONS.TRANSACTIONS_HANDOVER)) {
      throw new ForbiddenError('Hanya Warehouse Staff yang dapat mengunggah bukti serah terima Outgoing.');
    }
    const { rows } = await query(
      `SELECT id, type, status FROM transactions WHERE id = $1 LIMIT 1`,
      [entityId]
    );
    const tx = rows[0];
    if (!tx || tx.type !== 'outgoing') {
      throw new NotFoundError('Transaksi Outgoing tidak ditemukan.');
    }
    if (mode === 'upload' && !['approved', 'shipped'].includes(tx.status)) {
      throw new ConflictError(
        'Bukti serah terima hanya dapat diunggah setelah Outgoing disetujui.'
      );
    }
    return { transactionId: tx.id, purchaseOrderId: null, discrepancyId: null };
  }

  if (
    entityType === EVIDENCE_ENTITY_TYPES.SUPPLIER_SHIPMENT ||
    entityType === EVIDENCE_ENTITY_TYPES.SUPPLIER_ARRIVAL
  ) {
    const { rows } = await query(
      `SELECT id, supplier_id, status FROM purchase_orders WHERE id = $1 LIMIT 1`,
      [entityId]
    );
    const po = rows[0];
    if (!po) {
      throw new NotFoundError('Purchase Order tidak ditemukan.');
    }

    if (user.role === ROLES.SUPPLIER) {
      assertSupplierOwnership(user, po.supplier_id);
      if (mode === 'upload' && !hasPermission(user, PERMISSIONS.SHIPMENT_MANAGE_OWN)) {
        throw new ForbiddenError();
      }
    } else {
      if (mode === 'upload') {
        throw new ForbiddenError('Hanya Supplier pemilik PO yang dapat mengunggah bukti pengiriman atau kedatangan.');
      }
      if (!hasPermission(user, PERMISSIONS.PO_READ_ALL)) {
        throw new ForbiddenError();
      }
    }

    const allowedUploadStatuses =
      entityType === EVIDENCE_ENTITY_TYPES.SUPPLIER_ARRIVAL
        ? ['in_transit', 'inspecting', 'delivered']
        : ['processing', 'confirmed', 'preparing', 'in_transit', 'inspecting', 'delivered'];

    if (mode === 'upload' && !allowedUploadStatuses.includes(po.status)) {
      throw new ConflictError(
        entityType === EVIDENCE_ENTITY_TYPES.SUPPLIER_ARRIVAL
          ? 'Bukti kedatangan barang hanya dapat diunggah ketika PO berstatus In Transit.'
          : 'Bukti pengiriman tidak dapat diunggah untuk status PO saat ini.'
      );
    }
    return { transactionId: null, purchaseOrderId: po.id, discrepancyId: null };
  }

  // Discrepancy evidence
  if (user.role === ROLES.SUPPLIER) {
    throw new ForbiddenError('Supplier tidak dapat mengakses bukti internal discrepancy.');
  }
  if (mode === 'read' && !hasPermission(user, PERMISSIONS.DISCREPANCY_READ)) {
    throw new ForbiddenError();
  }
  if (mode === 'upload' && !hasPermission(user, PERMISSIONS.DISCREPANCY_REPORT)) {
    throw new ForbiddenError('Hanya Warehouse Staff pelapor yang dapat mengunggah bukti discrepancy.');
  }
  const { rows } = await query(
    `SELECT id, status FROM discrepancy_reports WHERE id = $1 LIMIT 1`,
    [entityId]
  );
  const disc = rows[0];
  if (!disc) {
    throw new NotFoundError('Laporan discrepancy tidak ditemukan.');
  }
  if (mode === 'upload' && ['closed'].includes(disc.status)) {
    throw new ConflictError('Laporan discrepancy sudah ditutup.');
  }
  return { transactionId: null, purchaseOrderId: null, discrepancyId: disc.id };
}

export async function getEvidenceListForEntity(user, { entityType, entityId }) {
  await verifyEntityTargetAndAccess(user, { entityType, entityId, mode: 'read' });
  return listEvidenceForEntity({ entityType, entityId });
}

export async function uploadEvidenceFile(
  user,
  { entityType, entityId, buffer, originalName, mimeType, description = null }
) {
  const fkTarget = await verifyEntityTargetAndAccess(user, {
    entityType,
    entityId,
    mode: 'upload',
  });

  const saved = await saveFile({
    buffer,
    scopeFolder: entityType,
    mimeType,
    originalName,
  });

  try {
    const record = await insertEvidenceFile({
      entityType,
      ...fkTarget,
      storageKey: saved.storageKey,
      originalName: String(originalName).slice(0, 255),
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      description: description ? String(description).trim().slice(0, 500) : null,
      uploadedBy: user.id,
    });

    await recordAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      action: 'EVIDENCE_UPLOADED',
      entityType: 'evidence_file',
      entityId: record.id,
      newState: {
        entityType,
        targetId: Number(entityId),
        originalName: record.original_name,
      },
    });

    return record;
  } catch (err) {
    await deleteFile(saved.storageKey);
    throw err;
  }
}

export async function getAuthorizedEvidenceDownload(user, evidenceId) {
  requireAuth(user);
  const file = await findEvidenceWithContextById(evidenceId);
  if (!file) {
    throw new NotFoundError('File bukti tidak ditemukan.');
  }

  if (user.role === ROLES.SUPPLIER) {
    if (
      file.entity_type !== EVIDENCE_ENTITY_TYPES.SUPPLIER_SHIPMENT &&
      file.entity_type !== EVIDENCE_ENTITY_TYPES.SUPPLIER_ARRIVAL
    ) {
      throw new ForbiddenError('Anda tidak memiliki izin mengunduh bukti ini.');
    }
    assertSupplierOwnership(user, file.po_supplier_id);
  } else if (file.entity_type === EVIDENCE_ENTITY_TYPES.DISCREPANCY) {
    if (!hasPermission(user, PERMISSIONS.DISCREPANCY_READ)) {
      throw new ForbiddenError('Anda tidak memiliki izin mengunduh bukti ini.');
    }
  } else if (
    file.entity_type === EVIDENCE_ENTITY_TYPES.INCOMING_INSPECTION ||
    file.entity_type === EVIDENCE_ENTITY_TYPES.OUTGOING_HANDOVER
  ) {
    if (!hasPermission(user, PERMISSIONS.TRANSACTIONS_READ)) {
      throw new ForbiddenError('Anda tidak memiliki izin mengunduh bukti ini.');
    }
  } else if (!hasPermission(user, PERMISSIONS.PO_READ_ALL)) {
    throw new ForbiddenError('Anda tidak memiliki izin mengunduh bukti ini.');
  }

  const buffer = await readFile(file.storage_key);
  return { file, buffer };
}

export async function removeEvidenceFile(user, evidenceId) {
  requireAuth(user);
  const file = await findEvidenceWithContextById(evidenceId);
  if (!file) {
    throw new NotFoundError('File bukti tidak ditemukan.');
  }

  const isSupplierFile =
    file.entity_type === EVIDENCE_ENTITY_TYPES.SUPPLIER_SHIPMENT ||
    file.entity_type === EVIDENCE_ENTITY_TYPES.SUPPLIER_ARRIVAL;

  if (user.role === ROLES.SUPPLIER) {
    if (!isSupplierFile) {
      throw new ForbiddenError();
    }
    assertSupplierOwnership(user, file.po_supplier_id);
  } else if (isSupplierFile) {
    if (user.role !== ROLES.ADMIN) {
      throw new ForbiddenError('Hanya Supplier pemilik PO atau Admin yang dapat menghapus bukti pengiriman Supplier.');
    }
  } else if (
    user.role !== ROLES.ADMIN &&
    Number(file.uploaded_by) !== Number(user.id)
  ) {
    throw new ForbiddenError('Hanya pengunggah atau Admin yang dapat menghapus bukti ini.');
  }

  // Prevent removing evidence from finalized transactions or POs
  if (file.tx_status && ['approved', 'shipped', 'delivered'].includes(file.tx_status)) {
    throw new ConflictError('Bukti transaksi yang sudah disetujui/diproses tidak dapat dihapus.');
  }
  if (['received', 'returned', 'completed', 'cancelled'].includes(file.po_status)) {
    throw new ConflictError('Bukti pada PO yang sudah selesai atau dibatalkan tidak dapat dihapus.');
  }
  if (file.discrepancy_status && ['resolved', 'closed'].includes(file.discrepancy_status)) {
    throw new ConflictError('Bukti pada discrepancy yang sudah selesai tidak dapat dihapus.');
  }

  await deleteEvidenceById(file.id);
  await deleteFile(file.storage_key);

  await recordAuditEvent({
    actorId: user.id,
    actorRole: user.role,
    action: 'EVIDENCE_DELETED',
    entityType: 'evidence_file',
    entityId: file.id,
    previousState: { originalName: file.original_name, entityType: file.entity_type },
  });

  return { id: file.id };
}
