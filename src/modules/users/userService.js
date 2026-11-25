import { withTransaction } from '../../lib/db/pool.js';
import { hashPassword } from '../../lib/auth/password.js';
import { revokeAllUserSessions } from '../../lib/auth/sessionStore.js';
import { PERMISSIONS, requireAuth, requirePermission } from '../../lib/auth/rbac.js';
import { ROLES, USER_STATUSES } from '../../lib/constants/roles.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../lib/constants/errors.js';
import { recordAuditEvent } from '../audit/auditService.js';
import {
  validateCreateInternalUserInput,
  validateUpdateOwnProfileInput,
} from './userValidation.js';
import {
  listUsers,
  findUserByEmail,
  findUserById,
  countActiveAdmins,
  createUser,
  updateUserStatus,
  updateUserOwnProfile,
  updateSupplierOwnContactProfile,
} from './userRepo.js';

export async function getUsersList(adminUser, filters = {}) {
  requirePermission(adminUser, PERMISSIONS.USERS_MANAGE);
  return listUsers(filters);
}

export async function createInternalAccount(adminUser, rawInput) {
  requirePermission(adminUser, PERMISSIONS.USERS_MANAGE);
  const input = validateCreateInternalUserInput(rawInput);
  const passwordHash = await hashPassword(input.password);

  return withTransaction(async (client) => {
    const existing = await findUserByEmail(input.email, client);
    if (existing) {
      throw new ConflictError('Email sudah digunakan akun lain.', {
        email: 'Email sudah terdaftar.',
      });
    }

    const created = await createUser(
      {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        status: USER_STATUSES.ACTIVE,
      },
      client
    );

    await recordAuditEvent(
      {
        actorId: adminUser.id,
        actorRole: adminUser.role,
        action: 'USER_CREATED',
        entityType: 'user',
        entityId: created.id,
        newState: {
          name: created.name,
          email: created.email,
          role: created.role,
          status: created.status,
        },
      },
      client
    );

    return created;
  });
}

export async function setUserAccountStatus(adminUser, targetUserId, nextStatus) {
  requirePermission(adminUser, PERMISSIONS.USERS_MANAGE);

  if (![USER_STATUSES.ACTIVE, USER_STATUSES.INACTIVE].includes(nextStatus)) {
    throw new ForbiddenError('Status akun hanya dapat diubah ke active atau inactive.');
  }

  return withTransaction(async (client) => {
    const target = await findUserById(targetUserId, client);
    if (!target) {
      throw new NotFoundError('Akun pengguna tidak ditemukan.');
    }

    if (
      target.role === ROLES.SUPPLIER &&
      (target.status === USER_STATUSES.PENDING || target.status === USER_STATUSES.REJECTED)
    ) {
      throw new ConflictError(
        'Akun supplier yang masih pending atau rejected harus diproses melalui halaman Supplier Verification.'
      );
    }

    if (Number(target.id) === Number(adminUser.id) && nextStatus === USER_STATUSES.INACTIVE) {
      throw new ForbiddenError('Anda tidak dapat menonaktifkan akun Admin Anda sendiri.');
    }

    if (
      target.role === ROLES.ADMIN &&
      target.status === USER_STATUSES.ACTIVE &&
      nextStatus === USER_STATUSES.INACTIVE
    ) {
      const activeAdmins = await countActiveAdmins(client);
      if (activeAdmins <= 1) {
        throw new ConflictError(
          'Tidak dapat menonaktifkan satu-satunya akun Admin aktif di sistem.'
        );
      }
    }

    if (target.status === nextStatus) {
      throw new ConflictError(`Akun sudah berstatus ${nextStatus}.`);
    }

    const updated = await updateUserStatus(target.id, nextStatus, client);

    if (nextStatus === USER_STATUSES.INACTIVE) {
      await revokeAllUserSessions(target.id, client);
    }

    await recordAuditEvent(
      {
        actorId: adminUser.id,
        actorRole: adminUser.role,
        action: nextStatus === USER_STATUSES.INACTIVE ? 'USER_DEACTIVATED' : 'USER_ACTIVATED',
        entityType: 'user',
        entityId: target.id,
        previousState: { status: target.status },
        newState: { status: updated.status },
      },
      client
    );

    return updated;
  });
}

const RESTRICTED_PROFILE_KEYS = ['role', 'status', 'email', 'companyName', 'id', 'userId'];

export async function getOwnProfile(currentUser) {
  requireAuth(currentUser);
  const profile = await findUserById(currentUser.id);
  if (!profile) {
    throw new NotFoundError('Profil pengguna tidak ditemukan.');
  }
  return profile;
}

export async function updateOwnProfile(currentUser, rawInput) {
  requireAuth(currentUser);

  if (rawInput && typeof rawInput === 'object') {
    for (const forbiddenKey of RESTRICTED_PROFILE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(rawInput, forbiddenKey) && rawInput[forbiddenKey] !== undefined) {
        throw new ForbiddenError(
          'Perubahan email, peran, status akun, atau nama perusahaan tidak diizinkan melalui pembaruan profil.'
        );
      }
    }
  }

  return withTransaction(async (client) => {
    const existing = await findUserById(currentUser.id, client);
    if (!existing) {
      throw new NotFoundError('Profil pengguna tidak ditemukan.');
    }

    const input = validateUpdateOwnProfileInput(rawInput, { role: existing.role });
    const isSupplier = existing.role === ROLES.SUPPLIER && Boolean(existing.supplier_id);

    const previousState = {
      name: existing.name,
      phone: existing.phone || null,
      ...(isSupplier
        ? {
            contactName: existing.supplier_contact_name || null,
            supplierPhone: existing.supplier_phone || null,
            address: existing.supplier_address || null,
          }
        : {}),
    };

    await updateUserOwnProfile(
      existing.id,
      { name: input.name, phone: input.phone },
      client
    );

    if (isSupplier) {
      await updateSupplierOwnContactProfile(
        existing.id,
        {
          contactName: input.contactName,
          phone: input.phone,
          address: input.address,
        },
        client
      );
    }

    const updated = await findUserById(existing.id, client);

    await recordAuditEvent(
      {
        actorId: existing.id,
        actorRole: existing.role,
        action: 'PROFILE_UPDATED',
        entityType: 'user',
        entityId: existing.id,
        previousState,
        newState: {
          name: updated.name,
          phone: updated.phone || null,
          ...(isSupplier
            ? {
                contactName: updated.supplier_contact_name || null,
                supplierPhone: updated.supplier_phone || null,
                address: updated.supplier_address || null,
              }
            : {}),
        },
      },
      client
    );

    return updated;
  });
}
