import { withTransaction } from '../../lib/db/pool.js';
import { PERMISSIONS, requirePermission } from '../../lib/auth/rbac.js';
import { ROLES, USER_STATUSES } from '../../lib/constants/roles.js';
import { SUPPLIER_APPEAL_STATUSES } from '../../lib/constants/statuses.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../lib/constants/errors.js';
import { recordAuditEvent } from '../audit/auditService.js';
import {
  createNotification,
  createNotificationsForRole,
  listNotificationsForUser,
} from '../notifications/notificationRepo.js';
import {
  validateSupplierRejectionInput,
  validateSupplierAppealInput,
  validateAppealReviewInput,
} from './supplierValidation.js';
import {
  listSuppliers,
  findSupplierById,
  findSupplierByUserId,
  updateSupplierVerification,
  createSupplierAppeal,
  updateOpenSupplierAppeal,
  findLatestAppealBySupplierId,
  listAppealsBySupplierId,
  findAppealById,
  updateSupplierAppealStatus,
  applyProposedSupplierUpdates,
} from './supplierRepo.js';

export async function getSuppliersOverview(user, filters = {}) {
  requirePermission(user, PERMISSIONS.SUPPLIERS_READ);
  return listSuppliers(filters);
}

export async function approveSupplierRegistration(adminUser, supplierId) {
  requirePermission(adminUser, PERMISSIONS.SUPPLIERS_VERIFY);

  return withTransaction(async (client) => {
    const supplier = await findSupplierById(supplierId, client);
    if (!supplier) {
      throw new NotFoundError('Data supplier tidak ditemukan.');
    }

    if (supplier.status !== USER_STATUSES.PENDING) {
      throw new ConflictError(
        `Supplier "${supplier.company_name}" berstatus ${supplier.status} dan tidak berada pada tahap menunggu verifikasi.`
      );
    }

    const updated = await updateSupplierVerification(
      {
        supplierId: supplier.id,
        userId: supplier.user_id,
        newStatus: USER_STATUSES.ACTIVE,
        adminUserId: adminUser.id,
        rejectionReason: null,
      },
      client
    );

    await recordAuditEvent(
      {
        actorId: adminUser.id,
        actorRole: adminUser.role,
        action: 'SUPPLIER_APPROVED',
        entityType: 'supplier',
        entityId: supplier.id,
        previousState: { status: USER_STATUSES.PENDING },
        newState: { status: USER_STATUSES.ACTIVE },
        metadata: { companyName: supplier.company_name },
      },
      client
    );

    return updated;
  });
}

export async function rejectSupplierRegistration(adminUser, supplierId, rawInput) {
  requirePermission(adminUser, PERMISSIONS.SUPPLIERS_VERIFY);
  const { rejectionReason } = validateSupplierRejectionInput(rawInput);

  return withTransaction(async (client) => {
    const supplier = await findSupplierById(supplierId, client);
    if (!supplier) {
      throw new NotFoundError('Data supplier tidak ditemukan.');
    }

    if (supplier.status !== USER_STATUSES.PENDING) {
      throw new ConflictError(
        `Supplier "${supplier.company_name}" berstatus ${supplier.status} dan tidak dapat ditolak dari status ini.`
      );
    }

    const updated = await updateSupplierVerification(
      {
        supplierId: supplier.id,
        userId: supplier.user_id,
        newStatus: USER_STATUSES.REJECTED,
        adminUserId: adminUser.id,
        rejectionReason,
      },
      client
    );

    await recordAuditEvent(
      {
        actorId: adminUser.id,
        actorRole: adminUser.role,
        action: 'SUPPLIER_REJECTED',
        entityType: 'supplier',
        entityId: supplier.id,
        previousState: { status: USER_STATUSES.PENDING },
        newState: { status: USER_STATUSES.REJECTED, rejectionReason },
        metadata: { companyName: supplier.company_name },
      },
      client
    );

    await createNotification(
      {
        recipientUserId: supplier.user_id,
        type: 'REGISTRATION_REJECTED',
        title: 'Registrasi Supplier Ditolak',
        message: `Pendaftaran perusahaan "${supplier.company_name}" ditolak Admin. Alasan: ${rejectionReason}`,
        entityType: 'supplier',
        entityId: supplier.id,
        href: '/rejected-account',
      },
      client
    );

    return updated;
  });
}

function normalizeEffectiveUpdates(proposedUpdates, supplier) {
  const effective = {};
  if (proposedUpdates.companyName && proposedUpdates.companyName !== supplier.company_name) {
    effective.companyName = proposedUpdates.companyName;
  }
  if (proposedUpdates.contactName && proposedUpdates.contactName !== supplier.contact_name) {
    effective.contactName = proposedUpdates.contactName;
  }
  if (proposedUpdates.phone && proposedUpdates.phone !== supplier.phone) {
    effective.phone = proposedUpdates.phone;
  }
  if (proposedUpdates.address && proposedUpdates.address !== supplier.address) {
    effective.address = proposedUpdates.address;
  }
  if (proposedUpdates.additionalNotes) {
    effective.additionalNotes = proposedUpdates.additionalNotes;
  }
  return effective;
}

export async function getRejectedSupplierAppealContext(userId) {
  if (!userId) return { eligible: false };
  const supplier = await findSupplierByUserId(userId);
  if (
    !supplier ||
    supplier.role !== ROLES.SUPPLIER ||
    supplier.status !== USER_STATUSES.REJECTED
  ) {
    return { eligible: false, accountStatus: supplier?.status || null };
  }

  const [appeals, notifRes] = await Promise.all([
    listAppealsBySupplierId(supplier.id),
    listNotificationsForUser(userId, { limit: 15 }),
  ]);

  return {
    eligible: true,
    supplier,
    latestAppeal: appeals[0] || null,
    appeals,
    maxAppeals: 1,
    appealCount: appeals.length,
    hasUsedAppeal: appeals.length > 0,
    isAppealExhausted: Boolean(
      appeals[0] && appeals[0].status === SUPPLIER_APPEAL_STATUSES.REJECTED
    ),
    notifications: notifRes.items,
    unreadNotificationCount: notifRes.unreadCount,
  };
}

export async function submitSupplierAppeal(supplierUserId, rawInput) {
  const input = validateSupplierAppealInput(rawInput);

  return withTransaction(async (client) => {
    const supplier = await findSupplierByUserId(supplierUserId, client);
    if (!supplier) {
      throw new NotFoundError('Data registrasi supplier tidak ditemukan.');
    }

    if (supplier.role !== ROLES.SUPPLIER || supplier.status !== USER_STATUSES.REJECTED) {
      throw new ForbiddenError(
        'Hanya akun Supplier dengan status registrasi ditolak yang dapat mengajukan banding.'
      );
    }

    const existingAppeals = await listAppealsBySupplierId(supplier.id, client);
    if (existingAppeals.length > 0) {
      const latestAppeal = existingAppeals[0];
      if (
        [SUPPLIER_APPEAL_STATUSES.SUBMITTED, SUPPLIER_APPEAL_STATUSES.UNDER_REVIEW].includes(
          latestAppeal.status
        )
      ) {
        throw new ConflictError(
          'Anda sudah memiliki pengajuan banding aktif yang sedang menunggu atau ditinjau Admin.'
        );
      }
      throw new ConflictError(
        'Mohon maaf, kesempatan pengajuan banding maksimal 1 kali untuk akun ini sudah digunakan. Silakan mendaftar ulang melalui halaman registrasi.'
      );
    }

    const effectiveUpdates = normalizeEffectiveUpdates(input.proposedUpdates, supplier);

    let createdAppeal;
    try {
      createdAppeal = await createSupplierAppeal(
        {
          supplierId: supplier.id,
          submittedByUserId: supplier.user_id,
          rejectionReasonSnapshot: supplier.rejection_reason,
          appealReason: input.appealReason,
          proposedUpdates: effectiveUpdates,
        },
        client
      );
    } catch (err) {
      if (err?.code === '23505') {
        throw new ConflictError(
          'Mohon maaf, pengajuan banding hanya dapat dilakukan maksimal 1 kali per akun. Silakan mendaftar ulang melalui halaman registrasi.'
        );
      }
      throw err;
    }

    await recordAuditEvent(
      {
        actorId: supplier.user_id,
        actorRole: ROLES.SUPPLIER,
        action: 'SUPPLIER_APPEAL_SUBMITTED',
        entityType: 'supplier_appeal',
        entityId: createdAppeal.id,
        newState: {
          status: createdAppeal.status,
          companyName: supplier.company_name,
        },
      },
      client
    );

    await createNotification(
      {
        recipientUserId: supplier.user_id,
        type: 'APPEAL_SUBMITTED',
        title: 'Banding Berhasil Dikirim',
        message:
          'Pengajuan banding registrasi Anda telah dikirim dan menunggu peninjauan Admin.',
        entityType: 'supplier_appeal',
        entityId: createdAppeal.id,
        href: '/rejected-account',
      },
      client
    );

    await createNotificationsForRole(
      ROLES.ADMIN,
      {
        type: 'APPEAL_SUBMITTED',
        title: 'Banding Registrasi Supplier Baru',
        message: `${supplier.company_name} mengajukan banding atas penolakan registrasi dan menunggu peninjauan.`,
        entityType: 'supplier_appeal',
        entityId: createdAppeal.id,
        href: '/supplier-verification?status=appeals',
      },
      client
    );

    return createdAppeal;
  });
}

export async function updateSubmittedSupplierAppeal(supplierUserId, appealId, rawInput) {
  const input = validateSupplierAppealInput(rawInput);

  return withTransaction(async (client) => {
    const appeal = await findAppealById(appealId, client);
    if (!appeal) {
      throw new NotFoundError('Pengajuan banding tidak ditemukan.');
    }

    if (Number(appeal.supplier_user_id) !== Number(supplierUserId)) {
      throw new ForbiddenError('Anda tidak memiliki akses untuk mengubah banding milik pihak lain.');
    }

    if (
      appeal.user_role !== ROLES.SUPPLIER ||
      appeal.user_status !== USER_STATUSES.REJECTED
    ) {
      throw new ForbiddenError(
        'Perubahan banding hanya berlaku bagi akun Supplier berstatus registrasi ditolak.'
      );
    }

    if (appeal.status !== SUPPLIER_APPEAL_STATUSES.SUBMITTED) {
      throw new ConflictError(
        'Informasi banding tidak dapat diubah karena sudah ditinjau atau diputuskan Admin.'
      );
    }

    const supplier = await findSupplierByUserId(supplierUserId, client);
    const effectiveUpdates = normalizeEffectiveUpdates(input.proposedUpdates, supplier);

    const updatedAppeal = await updateOpenSupplierAppeal(
      {
        appealId: appeal.id,
        appealReason: input.appealReason,
        proposedUpdates: effectiveUpdates,
      },
      client
    );

    if (!updatedAppeal) {
      throw new ConflictError('Pengajuan banding tidak lagi berada pada status dapat diubah.');
    }

    await recordAuditEvent(
      {
        actorId: supplier.user_id,
        actorRole: ROLES.SUPPLIER,
        action: 'SUPPLIER_APPEAL_UPDATED',
        entityType: 'supplier_appeal',
        entityId: updatedAppeal.id,
        previousState: { appealReason: appeal.appeal_reason },
        newState: { appealReason: updatedAppeal.appeal_reason },
        metadata: { companyName: supplier.company_name },
      },
      client
    );

    await createNotification(
      {
        recipientUserId: supplier.user_id,
        type: 'APPEAL_UPDATED',
        title: 'Informasi Banding Diperbarui',
        message: 'Pembaruan informasi pengajuan banding Anda berhasil disimpan.',
        entityType: 'supplier_appeal',
        entityId: updatedAppeal.id,
        href: '/rejected-account',
      },
      client
    );

    await createNotificationsForRole(
      ROLES.ADMIN,
      {
        type: 'APPEAL_UPDATED',
        title: 'Informasi Banding Diperbarui',
        message: `${supplier.company_name} memperbarui penjelasan atau data pada pengajuan bandingnya.`,
        entityType: 'supplier_appeal',
        entityId: updatedAppeal.id,
        href: '/supplier-verification?status=appeals',
      },
      client
    );

    return updatedAppeal;
  });
}

export async function reviewSupplierAppeal(adminUser, appealId, rawInput) {
  requirePermission(adminUser, PERMISSIONS.SUPPLIERS_VERIFY);
  const { decision, adminDecisionNotes } = validateAppealReviewInput(rawInput);

  return withTransaction(async (client) => {
    const appeal = await findAppealById(appealId, client);
    if (!appeal) {
      throw new NotFoundError('Pengajuan banding tidak ditemukan.');
    }

    if (appeal.user_status !== USER_STATUSES.REJECTED) {
      throw new ConflictError(
        `Akun supplier "${appeal.company_name}" saat ini berstatus ${appeal.user_status} dan tidak berada dalam status ditolak.`
      );
    }

    if (
      [SUPPLIER_APPEAL_STATUSES.APPROVED, SUPPLIER_APPEAL_STATUSES.REJECTED].includes(
        appeal.status
      )
    ) {
      throw new ConflictError('Pengajuan banding ini sudah memiliki keputusan akhir.');
    }

    if (
      decision === SUPPLIER_APPEAL_STATUSES.UNDER_REVIEW &&
      appeal.status === SUPPLIER_APPEAL_STATUSES.UNDER_REVIEW
    ) {
      throw new ConflictError('Pengajuan banding sudah berstatus sedang ditinjau Admin.');
    }

    const updatedAppeal = await updateSupplierAppealStatus(
      {
        appealId: appeal.id,
        status: decision,
        adminUserId: adminUser.id,
        adminDecisionNotes,
      },
      client
    );

    if (decision === SUPPLIER_APPEAL_STATUSES.UNDER_REVIEW) {
      await recordAuditEvent(
        {
          actorId: adminUser.id,
          actorRole: adminUser.role,
          action: 'SUPPLIER_APPEAL_UNDER_REVIEW',
          entityType: 'supplier_appeal',
          entityId: appeal.id,
          previousState: { status: appeal.status },
          newState: { status: SUPPLIER_APPEAL_STATUSES.UNDER_REVIEW },
          metadata: { companyName: appeal.company_name },
        },
        client
      );

      await createNotification(
        {
          recipientUserId: appeal.supplier_user_id,
          type: 'APPEAL_UNDER_REVIEW',
          title: 'Banding Sedang Ditinjau',
          message:
            'Admin sedang meninjau pengajuan banding registrasi perusahaan Anda. Hasil peninjauan akan diinformasikan setelah selesai.',
          entityType: 'supplier_appeal',
          entityId: appeal.id,
          href: '/rejected-account',
        },
        client
      );

      return {
        appeal: { ...updatedAppeal, company_name: appeal.company_name },
        supplierStatus: USER_STATUSES.REJECTED,
      };
    }

    if (decision === SUPPLIER_APPEAL_STATUSES.APPROVED) {
      if (appeal.proposed_updates && typeof appeal.proposed_updates === 'object') {
        await applyProposedSupplierUpdates(
          {
            supplierId: appeal.supplier_id,
            userId: appeal.supplier_user_id,
            proposedUpdates: appeal.proposed_updates,
          },
          client
        );
      }

      await updateSupplierVerification(
        {
          supplierId: appeal.supplier_id,
          userId: appeal.supplier_user_id,
          newStatus: USER_STATUSES.ACTIVE,
          adminUserId: adminUser.id,
          rejectionReason: null,
        },
        client
      );

      await recordAuditEvent(
        {
          actorId: adminUser.id,
          actorRole: adminUser.role,
          action: 'SUPPLIER_APPEAL_APPROVED',
          entityType: 'supplier_appeal',
          entityId: appeal.id,
          previousState: {
            appealStatus: appeal.status,
            accountStatus: USER_STATUSES.REJECTED,
          },
          newState: {
            appealStatus: SUPPLIER_APPEAL_STATUSES.APPROVED,
            accountStatus: USER_STATUSES.ACTIVE,
            adminDecisionNotes,
          },
          metadata: { companyName: appeal.company_name },
        },
        client
      );

      await createNotification(
        {
          recipientUserId: appeal.supplier_user_id,
          type: 'APPEAL_APPROVED',
          title: 'Banding Disetujui, Registrasi Aktif',
          message: `Hasil peninjauan banding telah tersedia: pengajuan "${appeal.company_name}" disetujui Admin dan akun Anda kini aktif.${
            adminDecisionNotes ? ` Catatan: ${adminDecisionNotes}` : ''
          }`,
          entityType: 'supplier_appeal',
          entityId: appeal.id,
          href: '/dashboard',
        },
        client
      );

      return {
        appeal: { ...updatedAppeal, company_name: appeal.company_name },
        supplierStatus: USER_STATUSES.ACTIVE,
      };
    }

    // decision === SUPPLIER_APPEAL_STATUSES.REJECTED
    await recordAuditEvent(
      {
        actorId: adminUser.id,
        actorRole: adminUser.role,
        action: 'SUPPLIER_APPEAL_REJECTED',
        entityType: 'supplier_appeal',
        entityId: appeal.id,
        previousState: { appealStatus: appeal.status },
        newState: {
          appealStatus: SUPPLIER_APPEAL_STATUSES.REJECTED,
          adminDecisionNotes,
        },
        metadata: { companyName: appeal.company_name },
      },
      client
    );

    await createNotification(
      {
        recipientUserId: appeal.supplier_user_id,
        type: 'APPEAL_REJECTED',
        title: 'Banding Tidak Disetujui',
        message: `Mohon maaf, pengajuan banding "${appeal.company_name}" kembali tidak disetujui oleh Admin. Batas pengajuan banding (maksimal 1 kali) telah tercapai. Silakan mendaftar ulang melalui halaman registrasi. Catatan Admin: ${adminDecisionNotes}`,
        entityType: 'supplier_appeal',
        entityId: appeal.id,
        href: '/rejected-account',
      },
      client
    );

    return {
      appeal: { ...updatedAppeal, company_name: appeal.company_name },
      supplierStatus: USER_STATUSES.REJECTED,
    };
  });
}
