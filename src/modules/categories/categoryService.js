import { withTransaction } from '../../lib/db/pool.js';
import { PERMISSIONS, requirePermission } from '../../lib/auth/rbac.js';
import { ConflictError, NotFoundError } from '../../lib/constants/errors.js';
import { recordAuditEvent } from '../audit/auditService.js';
import { validateCategoryInput } from './categoryValidation.js';
import {
  listCategories,
  findCategoryById,
  findCategoryConflict,
  createCategory,
  updateCategory,
  deleteCategory,
} from './categoryRepo.js';

export async function getCategoriesList(user, filters = {}) {
  requirePermission(user, PERMISSIONS.CATEGORIES_READ);
  return listCategories(filters);
}

export async function createCategoryItem(user, rawInput) {
  requirePermission(user, PERMISSIONS.CATEGORIES_MANAGE);
  const input = validateCategoryInput(rawInput);

  return withTransaction(async (client) => {
    const conflict = await findCategoryConflict(
      { name: input.name, code: input.code },
      client
    );
    if (conflict) {
      const fieldErrors = {};
      if (conflict.name.toLowerCase() === input.name.toLowerCase()) {
        fieldErrors.name = 'Nama kategori sudah digunakan.';
      }
      if (input.code && conflict.code && conflict.code.toUpperCase() === input.code) {
        fieldErrors.code = 'Kode kategori sudah digunakan.';
      }
      throw new ConflictError('Kategori dengan nama atau kode tersebut sudah ada.', fieldErrors);
    }

    const created = await createCategory(input, client);

    await recordAuditEvent(
      {
        actorId: user.id,
        actorRole: user.role,
        action: 'CATEGORY_CREATED',
        entityType: 'category',
        entityId: created.id,
        newState: created,
      },
      client
    );

    return created;
  });
}

export async function updateCategoryItem(user, categoryId, rawInput) {
  requirePermission(user, PERMISSIONS.CATEGORIES_MANAGE);
  const input = validateCategoryInput(rawInput);

  return withTransaction(async (client) => {
    const existing = await findCategoryById(categoryId, client);
    if (!existing) {
      throw new NotFoundError('Kategori tidak ditemukan.');
    }

    const conflict = await findCategoryConflict(
      { name: input.name, code: input.code, excludeId: categoryId },
      client
    );
    if (conflict) {
      const fieldErrors = {};
      if (conflict.name.toLowerCase() === input.name.toLowerCase()) {
        fieldErrors.name = 'Nama kategori sudah digunakan.';
      }
      if (input.code && conflict.code && conflict.code.toUpperCase() === input.code) {
        fieldErrors.code = 'Kode kategori sudah digunakan.';
      }
      throw new ConflictError('Kategori dengan nama atau kode tersebut sudah ada.', fieldErrors);
    }

    const updated = await updateCategory(categoryId, input, client);

    await recordAuditEvent(
      {
        actorId: user.id,
        actorRole: user.role,
        action: 'CATEGORY_UPDATED',
        entityType: 'category',
        entityId: updated.id,
        previousState: { code: existing.code, name: existing.name, description: existing.description },
        newState: updated,
      },
      client
    );

    return updated;
  });
}

export async function deleteCategoryItem(user, categoryId) {
  requirePermission(user, PERMISSIONS.CATEGORIES_MANAGE);

  return withTransaction(async (client) => {
    const existing = await findCategoryById(categoryId, client);
    if (!existing) {
      throw new NotFoundError('Kategori tidak ditemukan.');
    }

    const productCount = Number(existing.total_product_count || 0);
    const supplierCount = Number(existing.supplier_count || 0);

    if (productCount > 0 || supplierCount > 0) {
      const relationParts = [];
      if (productCount > 0) {
        relationParts.push(`${productCount} produk`);
      }
      if (supplierCount > 0) {
        relationParts.push(`${supplierCount} supplier`);
      }
      throw new ConflictError(
        `Kategori "${existing.name}" tidak dapat dihapus karena masih digunakan oleh produk atau supplier (${relationParts.join(' dan ')}). Periksa data yang terhubung sebelum melakukan penghapusan.`
      );
    }

    try {
      await deleteCategory(categoryId, client);
    } catch (err) {
      if (err?.code === '23503') {
        throw new ConflictError(
          `Kategori "${existing.name}" tidak dapat dihapus karena masih digunakan oleh produk atau supplier. Periksa data yang terhubung sebelum melakukan penghapusan.`
        );
      }
      throw err;
    }

    await recordAuditEvent(
      {
        actorId: user.id,
        actorRole: user.role,
        action: 'CATEGORY_DELETED',
        entityType: 'category',
        entityId: existing.id,
        previousState: { code: existing.code, name: existing.name },
      },
      client
    );

    return { id: existing.id, name: existing.name };
  });
}
