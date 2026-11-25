'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '../../lib/auth/session.js';
import { actionFailure, actionSuccess } from '../../lib/utils/response.js';
import {
  createProductItem,
  updateProductItem,
  archiveProductItem,
  deleteProductItem,
} from './productService.js';

async function extractUploadedImage(formData) {
  const file = formData.get('image');
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) {
    return null;
  }
  const arrayBuffer = await file.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    originalName: file.name || 'product-image',
    mimeType: file.type || 'application/octet-stream',
  };
}

export async function createProductAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const imageFile = await extractUploadedImage(formData);
    const created = await createProductItem(
      user,
      {
        sku: formData.get('sku'),
        name: formData.get('name'),
        categoryId: formData.get('categoryId'),
        description: formData.get('description'),
        purchasePrice: formData.get('purchasePrice'),
        sellingPrice: formData.get('sellingPrice'),
        minimumStock: formData.get('minimumStock'),
        lowStockThreshold: formData.get('lowStockThreshold'),
        unit: formData.get('unit'),
        rackLocation: formData.get('rackLocation'),
      },
      { imageFile, requirePrices: true, requireUnit: true }
    );
    revalidatePath('/products');
    revalidatePath('/inventory');
    revalidatePath('/categories');
    return actionSuccess(created, `Produk "${created.name}" (${created.sku}) berhasil ditambahkan.`);
  } catch (err) {
    return actionFailure(err, 'productActions.createProductAction');
  }
}

export async function updateProductAction(prevState, formData) {
  try {
    const user = await getCurrentUser();
    const productId = Number(formData.get('id'));
    const imageFile = await extractUploadedImage(formData);
    const removeImage = formData.get('removeImage') === '1';

    const updated = await updateProductItem(
      user,
      productId,
      {
        sku: formData.get('sku'),
        name: formData.get('name'),
        categoryId: formData.get('categoryId'),
        description: formData.get('description'),
        purchasePrice: formData.get('purchasePrice'),
        sellingPrice: formData.get('sellingPrice'),
        minimumStock: formData.get('minimumStock'),
        lowStockThreshold: formData.get('lowStockThreshold'),
        unit: formData.get('unit'),
        rackLocation: formData.get('rackLocation'),
      },
      { imageFile, removeImage, requirePrices: true, requireUnit: true }
    );
    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);
    revalidatePath('/inventory');
    revalidatePath('/categories');
    return actionSuccess(updated, `Produk "${updated.name}" berhasil diperbarui.`);
  } catch (err) {
    return actionFailure(err, 'productActions.updateProductAction');
  }
}

export async function archiveProductAction(productId) {
  try {
    const user = await getCurrentUser();
    const archived = await archiveProductItem(user, Number(productId));
    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);
    revalidatePath('/inventory');
    revalidatePath('/categories');
    revalidatePath('/dashboard');
    return actionSuccess(
      archived,
      `Produk "${archived.name}" (${archived.sku}) berhasil diarsipkan.`
    );
  } catch (err) {
    return actionFailure(err, 'productActions.archiveProductAction');
  }
}

export async function deleteProductAction(productId) {
  try {
    const user = await getCurrentUser();
    const deleted = await deleteProductItem(user, Number(productId));
    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);
    revalidatePath('/inventory');
    revalidatePath('/categories');
    return actionSuccess(
      deleted,
      `Produk "${deleted.name}" (${deleted.sku}) berhasil dihapus secara permanen.`
    );
  } catch (err) {
    return actionFailure(err, 'productActions.deleteProductAction');
  }
}
