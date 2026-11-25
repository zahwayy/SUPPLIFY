import { query } from '../../lib/db/pool.js';

const SORT_COLUMNS = {
  name: 'p.name',
  sku: 'p.sku',
  stock: 'p.stock',
  category: 'c.name',
  updated_at: 'p.updated_at',
};

export async function listProducts(
  {
    search = '',
    categoryId = null,
    stockStatus = '',
    sortBy = 'sku',
    sortDir = 'asc',
    page = 1,
    pageSize = 15,
  } = {},
  client = null
) {
  const executor = client || { query };
  const conditions = ['p.deleted_at IS NULL'];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(p.sku ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
  }

  if (categoryId) {
    params.push(Number(categoryId));
    conditions.push(`p.category_id = $${params.length}`);
  }

  if (stockStatus === 'out_of_stock') {
    conditions.push('p.stock = 0');
  } else if (stockStatus === 'severe') {
    conditions.push('p.stock > 0 AND p.minimum_stock IS NOT NULL AND p.stock <= p.minimum_stock');
  } else if (stockStatus === 'low') {
    conditions.push(
      'p.stock > 0 AND p.minimum_stock IS NOT NULL AND p.low_stock_threshold IS NOT NULL AND p.stock > p.minimum_stock AND p.stock <= p.low_stock_threshold'
    );
  } else if (stockStatus === 'normal') {
    conditions.push(
      'p.stock > 0 AND p.minimum_stock IS NOT NULL AND ((p.low_stock_threshold IS NOT NULL AND p.stock > p.low_stock_threshold) OR (p.low_stock_threshold IS NULL AND p.stock > p.minimum_stock))'
    );
  } else if (stockStatus === 'unconfigured') {
    conditions.push('p.stock > 0 AND p.minimum_stock IS NULL');
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderCol = SORT_COLUMNS[sortBy] || 'p.sku';
  const orderDirection = String(sortDir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 15));
  const offset = (safePage - 1) * safePageSize;

  const countRes = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM products p
     INNER JOIN categories c ON c.id = p.category_id
     ${whereSql}`,
    params
  );
  const totalCount = countRes.rows[0]?.total ?? 0;

  const listParams = [...params, safePageSize, offset];
  const { rows } = await executor.query(
    `SELECT
       p.id,
       p.category_id,
       c.code AS category_code,
       c.name AS category_name,
       p.sku,
       p.name,
       p.description,
       p.purchase_price,
       p.selling_price,
       p.stock,
       p.minimum_stock,
       p.low_stock_threshold,
       p.unit,
       p.rack_location,
       p.image_path,
       p.deleted_at,
       p.created_at,
       p.updated_at
     FROM products p
     INNER JOIN categories c ON c.id = p.category_id
     ${whereSql}
     ORDER BY ${orderCol} ${orderDirection}, p.id ASC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return {
    items: rows,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / safePageSize)),
  };
}

export async function listActiveProductsSimple(client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       p.id, p.sku, p.name, p.stock, p.unit, p.minimum_stock,
       p.low_stock_threshold, p.rack_location, p.purchase_price, p.selling_price,
       c.name AS category_name
     FROM products p
     INNER JOIN categories c ON c.id = p.category_id
     WHERE p.deleted_at IS NULL
     ORDER BY p.sku ASC`
  );
  return rows;
}

export async function findProductById(id, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       p.id,
       p.category_id,
       c.code AS category_code,
       c.name AS category_name,
       p.sku,
       p.name,
       p.description,
       p.purchase_price,
       p.selling_price,
       p.stock,
       p.minimum_stock,
       p.low_stock_threshold,
       p.unit,
       p.rack_location,
       p.image_path,
       p.deleted_at,
       p.created_at,
       p.updated_at
     FROM products p
     INNER JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function findProductBySku(sku, excludeId = null, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT id, sku
     FROM products
     WHERE UPPER(sku) = UPPER($1)
       AND ($2::bigint IS NULL OR id <> $2)
     LIMIT 1`,
    [sku, excludeId]
  );
  return rows[0] || null;
}

export async function createProduct(
  {
    categoryId,
    sku,
    name,
    description,
    purchasePrice,
    sellingPrice = null,
    minimumStock,
    lowStockThreshold = null,
    unit,
    rackLocation,
    imagePath = null,
  },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `INSERT INTO products (
       category_id, sku, name, description, purchase_price, selling_price,
       stock, minimum_stock, low_stock_threshold, unit, rack_location, image_path
     )
     VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9, $10, $11)
     RETURNING id, category_id, sku, name, description, purchase_price, selling_price, stock, minimum_stock, low_stock_threshold, unit, rack_location, image_path, deleted_at, created_at, updated_at`,
    [
      categoryId,
      sku,
      name,
      description,
      purchasePrice,
      sellingPrice,
      minimumStock,
      lowStockThreshold,
      unit,
      rackLocation,
      imagePath,
    ]
  );
  return rows[0];
}

export async function updateProduct(
  id,
  {
    categoryId,
    name,
    description,
    purchasePrice,
    sellingPrice = null,
    minimumStock,
    lowStockThreshold = null,
    unit,
    rackLocation,
    imagePath,
  },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `UPDATE products
     SET category_id = $2,
         name = $3,
         description = $4,
         purchase_price = $5,
         selling_price = $6,
         minimum_stock = $7,
         low_stock_threshold = $8,
         unit = $9,
         rack_location = $10,
         image_path = $11,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, category_id, sku, name, description, purchase_price, selling_price, stock, minimum_stock, low_stock_threshold, unit, rack_location, image_path, deleted_at, created_at, updated_at`,
    [
      id,
      categoryId,
      name,
      description,
      purchasePrice,
      sellingPrice,
      minimumStock,
      lowStockThreshold,
      unit,
      rackLocation,
      imagePath ?? null,
    ]
  );
  return rows[0] || null;
}

export async function getProductOperationalUsage(productId, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       (SELECT COUNT(*)::int FROM purchase_order_items WHERE product_id = $1) AS po_item_count,
       (SELECT COUNT(*)::int FROM transaction_items WHERE product_id = $1) AS tx_item_count,
       (SELECT COUNT(*)::int FROM discrepancy_reports WHERE product_id = $1) AS discrepancy_count,
       (SELECT COUNT(*)::int FROM stock_adjustments WHERE product_id = $1) AS adjustment_count,
       (SELECT COUNT(*)::int FROM stock_movements WHERE product_id = $1) AS movement_count`,
    [productId]
  );
  return rows[0] || {
    po_item_count: 0,
    tx_item_count: 0,
    discrepancy_count: 0,
    adjustment_count: 0,
    movement_count: 0,
  };
}

export async function archiveProductById(id, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `UPDATE products
     SET deleted_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id, category_id, sku, name, description, purchase_price, selling_price, stock, minimum_stock, low_stock_threshold, unit, rack_location, image_path, deleted_at, created_at, updated_at`,
    [id]
  );
  return rows[0] || null;
}

export async function deleteProductById(id, client = null) {
  const executor = client || { query };
  const res = await executor.query('DELETE FROM products WHERE id = $1', [id]);
  return res.rowCount > 0;
}
