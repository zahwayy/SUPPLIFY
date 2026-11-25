/**
 * Normalizes search text and checks whether a product matches the query by
 * product name, SKU, or category name.
 */
export function filterProductOptions(products, query = '') {
  const list = Array.isArray(products) ? products : [];
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return list;

  return list.filter((product) => {
    const name = String(product?.name || '').toLowerCase();
    const sku = String(product?.sku || '').toLowerCase();
    const category = String(product?.category_name || '').toLowerCase();
    return (
      name.includes(normalized) ||
      sku.includes(normalized) ||
      category.includes(normalized)
    );
  });
}

/**
 * Formats primary product display label consistently while keeping full list
 * fallback so filtered options never hide the currently selected item label.
 */
export function findSelectedProductOption(products, selectedId) {
  if (selectedId === null || selectedId === undefined || selectedId === '') {
    return null;
  }
  const target = String(selectedId);
  const list = Array.isArray(products) ? products : [];
  return list.find((item) => String(item?.id) === target) || null;
}
