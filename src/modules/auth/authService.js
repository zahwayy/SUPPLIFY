import { withTransaction } from '../../lib/db/pool.js';
import { hashPassword, verifyPassword } from '../../lib/auth/password.js';
import { ROLES, USER_STATUSES } from '../../lib/constants/roles.js';
import {
  AccountStatusError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../lib/constants/errors.js';
import { findCategoriesByIds } from '../categories/categoryRepo.js';
import {
  findUserByEmail,
  findUserById,
  createUser,
} from '../users/userRepo.js';
import {
  createSupplierProfile,
  replaceSupplierCategories,
} from '../suppliers/supplierRepo.js';
import { recordAuditEvent } from '../audit/auditService.js';
import {
  validateLoginInput,
  validateSupplierRegistrationInput,
} from './authValidation.js';

export async function loginWithCredentials(rawInput) {
  const { email, password } = validateLoginInput(rawInput);

  const user = await findUserByEmail(email);
  if (!user) {
    await recordAuditEvent({
      action: 'AUTH_LOGIN_FAILED',
      entityType: 'user',
      metadata: { email, reason: 'user_not_found' },
    });
    throw new UnauthorizedError('Email atau password salah.');
  }

  const isPasswordValid = await verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    await recordAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      action: 'AUTH_LOGIN_FAILED',
      entityType: 'user',
      entityId: user.id,
      metadata: { reason: 'invalid_password' },
    });
    throw new UnauthorizedError('Email atau password salah.');
  }

  if (user.status === USER_STATUSES.PENDING) {
    throw new AccountStatusError(
      'Akun Anda masih menunggu verifikasi Admin sebelum dapat mengakses sistem.',
      { userId: user.id, accountStatus: USER_STATUSES.PENDING }
    );
  }

  if (user.status === USER_STATUSES.REJECTED) {
    const reasonText = user.supplier_rejection_reason
      ? ` Alasan: ${user.supplier_rejection_reason}`
      : '';
    throw new AccountStatusError(
      `Pendaftaran akun Anda ditolak oleh Admin.${reasonText}`,
      {
        userId: user.id,
        accountStatus: USER_STATUSES.REJECTED,
        rejectionReason: user.supplier_rejection_reason || null,
      }
    );
  }

  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new ForbiddenError('Akun Anda tidak aktif. Hubungi Admin.');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    supplierId: user.supplier_id || null,
    supplierCompanyName: user.supplier_company_name || null,
  };
}

export async function registerSupplier(rawInput) {
  const input = validateSupplierRegistrationInput(rawInput);
  const passwordHash = await hashPassword(input.password);

  return withTransaction(async (client) => {
    const existing = await findUserByEmail(input.email, client);
    if (existing) {
      if (existing.role === ROLES.SUPPLIER && existing.status === USER_STATUSES.REJECTED) {
        throw new ConflictError(
          'Email ini terdaftar pada pengajuan supplier yang telah ditolak Admin. Silakan gunakan alamat email lain untuk mendaftar ulang.',
          {
            email: 'Gunakan alamat email berbeda untuk mendaftar ulang.',
          }
        );
      }
      throw new ConflictError('Email sudah terdaftar dalam sistem.', {
        email: 'Email ini sudah digunakan.',
      });
    }

    const validCategories = await findCategoriesByIds(input.categoryIds, client);
    if (validCategories.length !== input.categoryIds.length) {
      throw new ValidationError(
        'Kategori yang dipilih tidak valid atau sudah tidak tersedia. Silakan muat ulang halaman dan pilih kategori yang tersedia.',
        {
          categoryIds: 'Terdapat kategori yang tidak ditemukan atau sudah dihapus.',
        }
      );
    }

    // Security rule: registration ALWAYS creates role='supplier' and status='pending'
    const user = await createUser(
      {
        name: input.name,
        email: input.email,
        passwordHash,
        role: ROLES.SUPPLIER,
        status: USER_STATUSES.PENDING,
      },
      client
    );

    const supplier = await createSupplierProfile(
      {
        userId: user.id,
        companyName: input.companyName,
        contactName: input.contactName,
        phone: input.phone,
        address: input.address,
      },
      client
    );

    await replaceSupplierCategories(supplier.id, input.categoryIds, client);

    await recordAuditEvent(
      {
        actorId: user.id,
        actorRole: ROLES.SUPPLIER,
        action: 'SUPPLIER_REGISTERED',
        entityType: 'supplier',
        entityId: supplier.id,
        newState: {
          userStatus: USER_STATUSES.PENDING,
          companyName: supplier.company_name,
          categoryIds: input.categoryIds,
        },
      },
      client
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      supplier: {
        ...supplier,
        categories: validCategories,
      },
    };
  });
}

export async function verifyAccountStatusFromNotice(notice) {
  if (!notice?.userId) return { verified: false };
  const user = await findUserById(notice.userId);
  if (!user) return { verified: false };

  return {
    verified: true,
    userId: user.id,
    accountStatus: user.status,
    role: user.role,
    companyName: user.supplier_company_name || null,
    rejectionReason: user.supplier_rejection_reason || null,
  };
}
