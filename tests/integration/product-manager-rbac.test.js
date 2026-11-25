import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

for (const candidate of ['.env.local', '.env']) {
  const envPath = path.resolve(candidate);
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
    break;
  }
}

const { getPool, closePool } = await import('../../src/lib/db/pool.js');
const { ConflictError, ForbiddenError, ValidationError } = await import(
  '../../src/lib/constants/errors.js'
);
const {
  getProductsCatalog,
  getProductDetail,
  createProductItem,
  updateProductItem,
  archiveProductItem,
  deleteProductItem,
} = await import('../../src/modules/products/productService.js');
const { createCategoryItem } = await import(
  '../../src/modules/categories/categoryService.js'
);
const { createPurchaseOrder } = await import(
  '../../src/modules/purchase-orders/poService.js'
);

async function canConnectToDb() {
  if (
    !process.env.DATABASE_URL ||
    process.env.DATABASE_URL.includes('YOUR_POSTGRES_PASSWORD')
  ) {
    return false;
  }
  try {
    await getPool().query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

const dbReady = await canConnectToDb();

test(
  'Integration: Manager has full Product CRUD (with immutable SKU and stock/history delete protection) while Staff stays read-only',
  { skip: !dbReady && 'PostgreSQL DATABASE_URL not configured or unreachable' },
  async () => {
    const pool = getPool();
    const suffix = Date.now();
    const { rows: tsRows } = await pool.query('SELECT NOW() AS ts');
    const testStartTs = tsRows[0].ts;

    const createdCategoryIds = [];
    const createdProductIds = [];
    const createdPoIds = [];

    try {
      const {
        rows: [admin],
      } = await pool.query(
        `SELECT id, name, email, role, status FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1`
      );
      const {
        rows: [manager],
      } = await pool.query(
        `SELECT id, name, email, role, status FROM users WHERE role = 'manager' AND status = 'active' LIMIT 1`
      );
      const {
        rows: [staff],
      } = await pool.query(
        `SELECT id, name, email, role, status FROM users WHERE role = 'staff' AND status = 'active' LIMIT 1`
      );
      const {
        rows: [supplier],
      } = await pool.query(
        `SELECT s.id, s.user_id, u.role FROM suppliers s INNER JOIN users u ON u.id = s.user_id WHERE u.status = 'active' LIMIT 1`
      );
      assert.ok(admin && manager && staff && supplier, 'Seed actors must exist');

      const catA = await createCategoryItem(manager, {
        code: `MA${String(suffix).slice(-4)}`,
        name: `Cat Mgr A ${suffix}`,
      });
      createdCategoryIds.push(catA.id);

      const catB = await createCategoryItem(manager, {
        code: `MB${String(suffix).slice(-4)}`,
        name: `Cat Mgr B ${suffix}`,
      });
      createdCategoryIds.push(catB.id);

      // 1. Manager creates product (Create)
      const createdByMgr = await createProductItem(
        manager,
        {
          sku: `MGR-CRU-${suffix}`,
          name: 'Produk Baru Manager',
          categoryId: catA.id,
          description: 'Dibuat oleh Warehouse Manager',
          purchasePrice: '15000',
          sellingPrice: '21000',
          minimumStock: '5',
          lowStockThreshold: '12',
          unit: 'pcs',
          rackLocation: 'R-M1',
        },
        { requirePrices: true, requireUnit: true }
      );
      createdProductIds.push(createdByMgr.id);
      assert.equal(createdByMgr.sku, `MGR-CRU-${suffix}`);
      assert.equal(Number(createdByMgr.stock), 0);

      // 2. Manager reads list and detail (Read)
      const mgrList = await getProductsCatalog(manager, { search: createdByMgr.sku });
      assert.equal(mgrList.items.some((p) => Number(p.id) === Number(createdByMgr.id)), true);
      const mgrDetail = await getProductDetail(manager, createdByMgr.id);
      assert.equal(mgrDetail.name, 'Produk Baru Manager');

      // 3. Set simulated stock + create PO reference, then verify Manager master update NEVER alters stock or PO/movements/audit
      await pool.query(`UPDATE products SET stock = 25 WHERE id = $1`, [createdByMgr.id]);
      const po = await createPurchaseOrder(manager, {
        supplierId: supplier.id,
        orderDate: '2026-11-25',
        notes: 'PO sebelum update produk oleh Manager',
        items: [{ productId: createdByMgr.id, quantity: 4 }],
      });
      createdPoIds.push(po.id);

      // Attempting to change SKU on edit still fails cleanly
      await assert.rejects(
        () =>
          updateProductItem(manager, createdByMgr.id, {
            sku: `CHANGED-${suffix}`,
            name: 'Ubah SKU Terlarang',
            categoryId: catB.id,
            purchasePrice: '16000',
            sellingPrice: '22000',
            unit: 'box',
          }),
        ValidationError
      );

      // Valid master update by Manager (Update) even if spoofed stock is passed
      const updatedByMgr = await updateProductItem(
        manager,
        createdByMgr.id,
        {
          name: 'Produk Update Manager',
          categoryId: catB.id,
          description: 'Keterangan diperbarui oleh Manager',
          purchasePrice: '17500',
          sellingPrice: '25000',
          minimumStock: '8',
          lowStockThreshold: '15',
          unit: 'box',
          rackLocation: 'R-M2',
          stock: 999,
        },
        { requirePrices: true, requireUnit: true }
      );
      assert.equal(updatedByMgr.name, 'Produk Update Manager');
      assert.equal(Number(updatedByMgr.category_id), Number(catB.id));
      assert.equal(updatedByMgr.unit, 'BOX');
      assert.equal(updatedByMgr.rack_location, 'R-M2');
      assert.equal(Number(updatedByMgr.purchase_price), 17500);
      assert.equal(Number(updatedByMgr.selling_price), 25000);
      // Physical stock remains 25 (unmodified by master update!)
      assert.equal(Number(updatedByMgr.stock), 25);

      // PO item quantity & unit_price snapshot remain untouched
      const {
        rows: [poItemRow],
      } = await pool.query(
        `SELECT quantity, unit_price FROM purchase_order_items WHERE purchase_order_id = $1 AND product_id = $2`,
        [po.id, createdByMgr.id]
      );
      assert.equal(Number(poItemRow.quantity), 4);
      assert.equal(Number(poItemRow.unit_price), 15000);

      // 4. Manager CANNOT delete stocked/referenced product (ConflictError) and CANNOT archive product (ForbiddenError)
      await assert.rejects(
        () => deleteProductItem(manager, createdByMgr.id),
        ConflictError
      );
      await assert.rejects(
        () => archiveProductItem(manager, createdByMgr.id),
        ForbiddenError
      );

      // 5. Staff remains strictly read-only on products
      const staffList = await getProductsCatalog(staff, { search: createdByMgr.sku });
      assert.equal(staffList.items.length, 1);
      await assert.rejects(
        () =>
          createProductItem(staff, {
            sku: `STF-${suffix}`,
            name: 'Blocked Staff Create',
            categoryId: catA.id,
            purchasePrice: '1000',
            sellingPrice: '2000',
            unit: 'PCS',
          }),
        ForbiddenError
      );
      await assert.rejects(
        () =>
          updateProductItem(staff, createdByMgr.id, {
            name: 'Blocked Staff Update',
            categoryId: catA.id,
            purchasePrice: '1000',
            sellingPrice: '2000',
            unit: 'PCS',
          }),
        ForbiddenError
      );
      await assert.rejects(() => deleteProductItem(staff, createdByMgr.id), ForbiddenError);

      // 6. Admin delete on operationally-referenced product is STILL blocked with ConflictError
      await assert.rejects(
        () => deleteProductItem(admin, createdByMgr.id),
        ConflictError
      );

      // 7. Manager CAN delete clean unreferenced product with 0 stock; validation also blocks delete if stock > 0
      const cleanProd = await createProductItem(
        manager,
        {
          sku: `MGR-CLEAN-${suffix}`,
          name: 'Produk Clean Manager',
          categoryId: catA.id,
          purchasePrice: '8000',
          sellingPrice: '12000',
          unit: 'pcs',
        },
        { requirePrices: true, requireUnit: true }
      );
      createdProductIds.push(cleanProd.id);

      await pool.query(`UPDATE products SET stock = 3 WHERE id = $1`, [cleanProd.id]);
      await assert.rejects(
        () => deleteProductItem(manager, cleanProd.id),
        ConflictError
      );
      await pool.query(`UPDATE products SET stock = 0 WHERE id = $1`, [cleanProd.id]);

      const deletedByManager = await deleteProductItem(manager, cleanProd.id);
      assert.equal(deletedByManager.id, cleanProd.id);
      assert.equal(deletedByManager.sku, cleanProd.sku);
      await assert.rejects(() => getProductDetail(manager, cleanProd.id), /tidak ditemukan/i);
    } finally {
      await pool.query(`DELETE FROM audit_logs WHERE created_at >= $1`, [testStartTs]);
      if (createdPoIds.length > 0) {
        await pool.query(
          `DELETE FROM purchase_order_items WHERE purchase_order_id = ANY($1::bigint[])`,
          [createdPoIds]
        );
        await pool.query(`DELETE FROM purchase_orders WHERE id = ANY($1::bigint[])`, [
          createdPoIds,
        ]);
      }
      if (createdProductIds.length > 0) {
        await pool.query(`DELETE FROM products WHERE id = ANY($1::bigint[])`, [
          createdProductIds,
        ]);
      }
      if (createdCategoryIds.length > 0) {
        await pool.query(`DELETE FROM categories WHERE id = ANY($1::bigint[])`, [
          createdCategoryIds,
        ]);
      }
      await closePool();
    }
  }
);
