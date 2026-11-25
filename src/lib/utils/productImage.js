/**
 * Resolves the browser image URL for a product.
 * Assets stored under `/public/images/...` resolve directly via public path,
 * while any legacy storage-root keys fall back to the protected image API route.
 */
export function getProductImageSrc(product) {
  if (!product?.image_path) return null;
  const raw = String(product.image_path).trim();
  if (!raw) return null;

  const versionSuffix = product.updated_at
    ? `?v=${encodeURIComponent(String(product.updated_at))}`
    : '';

  if (raw.startsWith('/images/')) {
    return `${raw}${versionSuffix}`;
  }
  if (raw.startsWith('images/')) {
    return `/${raw}${versionSuffix}`;
  }
  return `/api/products/${product.id}/image${versionSuffix}`;
}
