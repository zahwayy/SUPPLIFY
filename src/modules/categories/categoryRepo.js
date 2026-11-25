import { query } from '../../lib/db/pool.js';

export async function listCategories({ search = '' } = {}, client = null) {
  const executor = client || { query };
  const params = [];
  let whereSql = '';

  if (search) {
    params.push(`%${search}%`);
    whereSql = `WHERE c.name ILIKE $1 OR COALESCE(c.code, '') ILIKE $1`;
  }

  const { rows } = await executor.query(
    `SELECT
       c.id,
       c.code,
       c.name,
       c.description,
       c.created_at,
       c.updated_at,
       COALESCE(prod_agg.active_product_count, 0)::int AS active_product_count,
       COALESCE(prod_agg.total_product_count, 0)::int AS total_product_count,
       COALESCE(sup_agg.supplier_count, 0)::int AS supplier_count
     FROM categories c
     LEFT JOIN LATERAL (
       SELECT
         COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL)::int AS active_product_count,
         COUNT(p.id)::int AS total_product_count
       FROM products p
       WHERE p.category_id = c.id
     ) prod_agg ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(sc.supplier_id)::int AS supplier_count
       FROM supplier_categories sc
       WHERE sc.category_id = c.id
     ) sup_agg ON TRUE
     ${whereSql}
     ORDER BY c.name ASC`,
    params
  );

  return rows;
}

export async function listPublicCategories(client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT id, code, name, description
     FROM categories
     ORDER BY name ASC`
  );
  return rows;
}

export async function findCategoriesByIds(ids, client = null) {
  const cleanIds = Array.isArray(ids)
    ? [...new Set(ids.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))]
    : [];
  if (cleanIds.length === 0) return [];

  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT id, code, name
     FROM categories
     WHERE id = ANY($1::bigint[])
     ORDER BY name ASC`,
    [cleanIds]
  );
  return rows;
}

export async function findCategoryById(id, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       c.id,
       c.code,
       c.name,
       c.description,
       c.created_at,
       c.updated_at,
       COALESCE(prod_agg.active_product_count, 0)::int AS active_product_count,
       COALESCE(prod_agg.total_product_count, 0)::int AS total_product_count,
       COALESCE(sup_agg.supplier_count, 0)::int AS supplier_count
     FROM categories c
     LEFT JOIN LATERAL (
       SELECT
         COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL)::int AS active_product_count,
         COUNT(p.id)::int AS total_product_count
       FROM products p
       WHERE p.category_id = c.id
     ) prod_agg ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(sc.supplier_id)::int AS supplier_count
       FROM supplier_categories sc
       WHERE sc.category_id = c.id
     ) sup_agg ON TRUE
     WHERE c.id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function findCategoryConflict({ name, code, excludeId = null }, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT id, name, code
     FROM categories
     WHERE ($1::bigint IS NULL OR id <> $1)
       AND (LOWER(name) = LOWER($2) OR ($3::varchar IS NOT NULL AND UPPER(code) = UPPER($3)))
     LIMIT 1`,
    [excludeId, name, code]
  );
  return rows[0] || null;
}

export async function createCategory({ code, name, description }, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `INSERT INTO categories (code, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, code, name, description, created_at, updated_at`,
    [code, name, description]
  );
  return rows[0];
}

export async function updateCategory(id, { code, name, description }, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `UPDATE categories
     SET code = $2,
         name = $3,
         description = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, code, name, description, created_at, updated_at`,
    [id, code, name, description]
  );
  return rows[0] || null;
}

export async function deleteCategory(id, client = null) {
  const executor = client || { query };
  const res = await executor.query('DELETE FROM categories WHERE id = $1', [id]);
  return res.rowCount > 0;
}
