'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '../../lib/auth/session.js';
import { actionFailure, actionSuccess } from '../../lib/utils/response.js';
import {
  createCategoryItem,
  updateCategoryItem,
  deleteCategoryItem,
} from './categoryService.js';

export async function createCategoryAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const created = await createCategoryItem(user, {
      code: formData.get('code'),
      name: formData.get('name'),
      description: formData.get('description'),
    });
    revalidatePath('/categories');
    revalidatePath('/products');
    revalidatePath('/inventory');
    revalidatePath('/register');
    revalidatePath('/supplier-verification');
    return actionSuccess(created, `Kategori "${created.name}" berhasil ditambahkan.`);
  } catch (err) {
    return actionFailure(err, 'categoryActions.createCategoryAction');
  }
}

export async function updateCategoryAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const categoryId = Number(formData.get('id'));
    const updated = await updateCategoryItem(user, categoryId, {
      code: formData.get('code'),
      name: formData.get('name'),
      description: formData.get('description'),
    });
    revalidatePath('/categories');
    revalidatePath('/products');
    revalidatePath('/inventory');
    revalidatePath('/register');
    revalidatePath('/supplier-verification');
    return actionSuccess(updated, `Kategori "${updated.name}" berhasil diperbarui.`);
  } catch (err) {
    return actionFailure(err, 'categoryActions.updateCategoryAction');
  }
}

export async function deleteCategoryAction(categoryId) {
  try {
    const user = await getCurrentUser();
    const deleted = await deleteCategoryItem(user, Number(categoryId));
    revalidatePath('/categories');
    revalidatePath('/products');
    revalidatePath('/inventory');
    revalidatePath('/register');
    revalidatePath('/supplier-verification');
    return actionSuccess(deleted, `Kategori "${deleted.name}" berhasil dihapus.`);
  } catch (err) {
    return actionFailure(err, 'categoryActions.deleteCategoryAction');
  }
}
