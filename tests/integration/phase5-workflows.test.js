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
const { ConflictError, ForbiddenError } = await import(
  '../../src/lib/constants/errors.js'
);
const { PO_STATUSES } = await import('../../src/lib/constants/statuses.js');
const {
  createPurchaseOrder,
  supplierConfirmPo,
  supplierRejectPo,
  supplierSubmitShipment,
  supplierConfirmArrival,
  managerNotifyStaffForInspection,
  managerCompletePo,
  getPurchaseOrderDetail,
} = await import('../../src/modules/purchase-orders/poService.js');
const {
  createIncomingTransaction,
  approveIncomingTransaction,
  rejectIncomingTransaction,
} = await import('../../src/modules/incoming/incomingService.js');
const {
  createOutgoingTransaction,
  approveOutgoingTransaction,
  recordOutgoingHandover,
} = await import('../../src/modules/outgoing/outgoingService.js');
const {
  createStockAdjustmentRequest,
  approveStockAdjustment,
} = await import('../../src/modules/adjustments/adjustmentService.js');
const {
  createCategoryItem,
  updateCategoryItem,
  deleteCategoryItem,
} = await import('../../src/modules/categories/categoryService.js');
const {
  createProductItem,
  updateProductItem,
  archiveProductItem,
  deleteProductItem,
  getProductsCatalog,
  getProductDetail,
} = await import('../../src/modules/products/productService.js');
const { generateCsvExport, EXPORT_RESOURCES } = await import(
  '../../src/modules/export/exportService.js'
);

async function canConnectToDb() {
  if (
    !process.env.DATABASE_URL ||
    process.env.DATABASE_URL.includes('YOUR_POSTGRES_PASSWORD')
  ) {
    return false;
  }
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

const dbReady = await canConnectToDb();

test(
  'Database integration: Final WMS PO -> Incoming (Accepted Qty) -> Received/Returned -> Outgoing Shipped -> Adjustment -> CSV export & stock integrity',
  { skip: !dbReady && 'PostgreSQL DATABASE_URL not configured or unreachable' },
  async () => {
    const pool = getPool();
    const { rows: startRows } = await pool.query('SELECT NOW() AS ts');
    const testStartTs = startRows[0].ts;

    const { rows: users } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, s.id AS supplier_id
       FROM users u
       LEFT JOIN suppliers s ON s.user_id = u.id
       WHERE u.status = 'active'`
    );
    const admin = users.find((u) => u.role === 'admin');
    const manager = users.find((u) => u.role === 'manager');
    const staff = users.find((u) => u.role === 'staff');
    const supplierRow = users.find((u) => u.role === 'supplier');
    const { rows: products } = await pool.query(
      `SELECT id, sku, stock FROM products WHERE deleted_at IS NULL AND purchase_price > 0 ORDER BY id ASC LIMIT 1`
    );

    if (!admin || !manager || !staff || !supplierRow || products.length === 0) {
      return;
    }

    const { rows: allProds } = await pool.query(`SELECT id, stock FROM products`);
    const stockSnapshot = new Map(allProds.map((r) => [Number(r.id), Number(r.stock)]));
    const maxIdsRes = await Promise.all([
      pool.query(`SELECT COALESCE(MAX(id), 0)::bigint AS m FROM purchase_orders`),
      pool.query(`SELECT COALESCE(MAX(id), 0)::bigint AS m FROM transactions`),
      pool.query(`SELECT COALESCE(MAX(id), 0)::bigint AS m FROM discrepancy_reports`),
      pool.query(`SELECT COALESCE(MAX(id), 0)::bigint AS m FROM stock_adjustments`),
      pool.query(`SELECT COALESCE(MAX(id), 0)::bigint AS m FROM products`),
      pool.query(`SELECT COALESCE(MAX(id), 0)::bigint AS m FROM categories`),
      pool.query(`SELECT COALESCE(MAX(id), 0)::bigint AS m FROM users`),
    ]);
    const [maxPoId, maxTxId, maxDiscId, maxAdjId, maxProdId, maxCatId, maxUserId] =
      maxIdsRes.map((r) => Number(r.rows[0].m));

    const supplierUser = { ...supplierRow, supplierId: supplierRow.supplier_id };
    const product = products[0];
    const initialStock = Number(product.stock);

    const getStock = async () => {
      const { rows } = await pool.query('SELECT stock FROM products WHERE id = $1', [
        product.id,
      ]);
      return Number(rows[0].stock);
    };

    let createdStaff2Id = null;

    try {
      // 0. Supplier Rejection flow: rejected PO cannot be shipped
      const rejectedPo = await createPurchaseOrder(manager, {
        supplierId: supplierUser.supplierId,
        orderDate: '2026-11-23',
        items: [{ productId: product.id, quantity: 5 }],
      });
      assert.equal(rejectedPo.status, PO_STATUSES.PENDING);
      const afterReject = await supplierRejectPo(supplierUser, rejectedPo.id, {
        rejectionReason: 'Stok sementara kosong di pabrik',
      });
      assert.equal(afterReject.status, PO_STATUSES.REJECTED);
      await assert.rejects(
        () =>
          supplierSubmitShipment(supplierUser, rejectedPo.id, {
            courierName: 'JNE',
            trackingNumber: 'RESI-FAIL',
          }),
        ConflictError
      );
      assert.equal(await getStock(), initialStock);

      // 1. Tahap 1: Manager creates PO (100 units) -> Pending, stock unchanged
      const po = await createPurchaseOrder(manager, {
        supplierId: supplierUser.supplierId,
        orderDate: '2026-11-23',
        items: [{ productId: product.id, quantity: 100 }],
      });
      assert.equal(po.status, PO_STATUSES.PENDING);
      assert.equal(await getStock(), initialStock);

      // 2. Tahap 2: Supplier confirms PO -> Confirmed (NOT In Transit), stock unchanged
      const confirmedPo = await supplierConfirmPo(supplierUser, po.id);
      assert.equal(confirmedPo.status, PO_STATUSES.CONFIRMED);
      assert.equal(await getStock(), initialStock);

      // Cross-supplier ownership check
      await assert.rejects(
        () =>
          getPurchaseOrderDetail(
            { id: 99999, role: 'supplier', supplierId: 99999 },
            po.id
          ),
        ForbiddenError
      );

      // 3. Tahap 3: Supplier confirms shipment -> In Transit, stock unchanged
      const { po: shippedPo } = await supplierSubmitShipment(supplierUser, po.id, {
        courierName: 'JNE Cargo',
        trackingNumber: 'RESI-TEST-001',
      });
      assert.equal(shippedPo.status, PO_STATUSES.IN_TRANSIT);
      assert.equal(await getStock(), initialStock);

      // 4. Tahap 4: Supplier confirms arrival -> arrival_confirmed_at set, stock unchanged
      const arrivedPo = await supplierConfirmArrival(supplierUser, po.id, {
        arrivalNotes: 'Pengiriman tiba (80 unit)',
      });
      assert.equal(arrivedPo.status, PO_STATUSES.IN_TRANSIT);
      assert.ok(arrivedPo.arrival_confirmed_at);
      assert.equal(await getStock(), initialStock);

      // Staff CANNOT submit Incoming before Manager informs Staff
      await assert.rejects(
        () =>
          createIncomingTransaction(staff, {
            purchaseOrderId: po.id,
            items: [
              {
                productId: product.id,
                quantity: 80,
                goodQuantity: 70,
                damagedQuantity: 10,
                conditionStatus: 'mixed',
              },
            ],
          }),
        ConflictError
      );

      // 5. Tahap 5: Manager instructs Staff for physical inspection -> Inspecting, stock unchanged
      const notifiedPo = await managerNotifyStaffForInspection(manager, po.id, {
        notes: 'Cek fisik dan pisahkan unit rusak',
      });
      assert.equal(notifiedPo.status, PO_STATUSES.INSPECTING);
      assert.ok(notifiedPo.inspection_requested_at);
      assert.equal(await getStock(), initialStock);

      // 6. Tahap 6: Staff inspects (80 received: 70 good, 10 damaged) -> Pending, stock unchanged
      const inc1 = await createIncomingTransaction(staff, {
        purchaseOrderId: po.id,
        receivingDate: '2026-11-23',
        notes: '70 baik, 10 rusak',
        items: [
          {
            productId: product.id,
            quantity: 80,
            goodQuantity: 70,
            damagedQuantity: 10,
            conditionStatus: 'mixed',
            notes: '10 kemasan sobek & rusak',
          },
        ],
      });
      assert.equal(await getStock(), initialStock);

      // Staff cannot approve Incoming
      await assert.rejects(
        () =>
          approveIncomingTransaction(staff, inc1.id, {
            items: [{ productId: product.id, approvedQuantity: 70 }],
          }),
        ForbiddenError
      );

      // Overlapping second Pending Incoming on same PO must be blocked
      await assert.rejects(
        () =>
          createIncomingTransaction(staff, {
            purchaseOrderId: po.id,
            items: [{ productId: product.id, quantity: 10, conditionStatus: 'good' }],
          }),
        ConflictError
      );

      // 7 & 8. Manager accepts 70 units -> stock +70 & PO atomically Received (NO repeat fulfillment)
      await approveIncomingTransaction(manager, inc1.id, {
        items: [
          {
            productId: product.id,
            approvedQuantity: 70,
            discrepancyAction: 'refund_claim',
            managerNotes: '70 baik masuk stok, 30 selisih/rusak klaim refund',
          },
        ],
        supplierFollowupNotes: 'Ajukan klaim refund 30 unit atau buat PO baru terpisah',
      });
      assert.equal(await getStock(), initialStock + 70);

      // Double approval & repeat Incoming on Received PO must fail
      await assert.rejects(
        () =>
          approveIncomingTransaction(manager, inc1.id, {
            items: [{ productId: product.id, approvedQuantity: 70 }],
          }),
        ConflictError
      );
      await assert.rejects(
        () =>
          createIncomingTransaction(staff, {
            purchaseOrderId: po.id,
            items: [{ productId: product.id, quantity: 30, conditionStatus: 'good' }],
          }),
        ConflictError
      );
      await assert.rejects(
        () => managerCompletePo(manager, po.id, {}),
        ConflictError
      );

      const poFinal = await getPurchaseOrderDetail(manager, po.id);
      assert.equal(poFinal.po.status, PO_STATUSES.RECEIVED);
      assert.equal(Number(poFinal.items[0].approved_quantity), 70);

      // Reject-then-Returned PO test & re-inspection
      const returnPo = await createPurchaseOrder(manager, {
        supplierId: supplierUser.supplierId,
        orderDate: '2026-11-23',
        items: [{ productId: product.id, quantity: 10 }],
      });
      await supplierConfirmPo(supplierUser, returnPo.id);
      await supplierSubmitShipment(supplierUser, returnPo.id, {
        courierName: 'Armada Internal',
        noTrackingReason: 'Diantar langsung oleh driver supplier',
      });
      await supplierConfirmArrival(supplierUser, returnPo.id, {});
      await managerNotifyStaffForInspection(manager, returnPo.id, {});
      const badInc = await createIncomingTransaction(staff, {
        purchaseOrderId: returnPo.id,
        items: [{ productId: product.id, quantity: 6, conditionStatus: 'damaged' }],
      });
      await rejectIncomingTransaction(manager, badInc.id, {
        rejectionReason: 'Barang diterima dalam kondisi rusak menyeluruh.',
      });
      assert.equal(await getStock(), initialStock + 70);
      const returnPoMid = await getPurchaseOrderDetail(manager, returnPo.id);
      assert.equal(returnPoMid.po.status, PO_STATUSES.RETURNED);

      // Re-inspection after Returned -> approve 6 -> Received & stock +76
      const reInc = await createIncomingTransaction(staff, {
        purchaseOrderId: returnPo.id,
        items: [{ productId: product.id, quantity: 6, conditionStatus: 'good' }],
      });
      await approveIncomingTransaction(manager, reInc.id, {
        items: [{ productId: product.id, approvedQuantity: 6 }],
      });
      assert.equal(await getStock(), initialStock + 76);

      // 9. Outgoing: Approve does NOT deduct stock; Staff Shipped deducts ONCE atomically
      const out = await createOutgoingTransaction(staff, {
        shipmentDate: '2026-11-24',
        recipientName: 'Divisi Desain Pelanggan',
        items: [{ productId: product.id, quantity: 3 }],
      });
      await approveOutgoingTransaction(manager, out.id);
      assert.equal(await getStock(), initialStock + 76);
      await recordOutgoingHandover(staff, out.id, {
        recipientName: 'Divisi Desain Pelanggan',
        recipientType: 'customer',
        handoverMethod: 'direct',
      });
      assert.equal(await getStock(), initialStock + 76 - 3);

      await assert.rejects(
        () =>
          createOutgoingTransaction(staff, {
            shipmentDate: '2026-11-24',
            recipientName: 'PT Kelebihan',
            items: [{ productId: product.id, quantity: initialStock + 10000 }],
          }),
        ConflictError
      );

      // 10. Adjustment: Self-approval / Staff forbidden -> Manager approval applies delta
      const adj = await createStockAdjustmentRequest(staff, {
        productId: product.id,
        adjustmentType: 'loss',
        direction: 'decrease',
        quantityDelta: 1,
        reason: 'Uji integrasi kehilangan 1 unit',
      });
      await assert.rejects(
        () => approveStockAdjustment(staff, adj.id),
        ForbiddenError
      );
      await approveStockAdjustment(manager, adj.id);
      assert.equal(await getStock(), initialStock + 76 - 3 - 1);

      // 11. Admin vs Manager RBAC on Products/Categories, Safe Product Delete & Role-Based CSV Export
      // Manager has full product CRUD (Create, Read, Update, safe Delete) without Archive; Staff cannot mutate products at all
      const managerCreatedProd = await createProductItem(manager, {
        sku: `MGR-${Date.now()}`,
        name: 'Created By Manager',
        categoryId: 1,
        purchasePrice: '5000',
        sellingPrice: '8000',
        unit: 'PCS',
      });
      const managerUpdatedProd = await updateProductItem(manager, managerCreatedProd.id, {
        name: 'Updated By Manager',
        categoryId: 1,
        purchasePrice: '5500',
        sellingPrice: '9000',
        unit: 'PCS',
      });
      assert.equal(managerUpdatedProd.name, 'Updated By Manager');
      assert.equal(Number(managerUpdatedProd.stock), 0);

      await assert.rejects(() => archiveProductItem(manager, managerCreatedProd.id), ForbiddenError);
      await assert.rejects(() => deleteProductItem(manager, product.id), ConflictError);
      await assert.rejects(() => archiveProductItem(manager, product.id), ForbiddenError);
      await assert.rejects(
        () =>
          updateProductItem(staff, product.id, {
            name: 'Blocked Staff Edit',
            categoryId: 1,
            purchasePrice: '1000',
            sellingPrice: '2000',
            unit: 'PCS',
          }),
        ForbiddenError
      );
      const managerDeletedProd = await deleteProductItem(manager, managerCreatedProd.id);
      assert.equal(managerDeletedProd.id, managerCreatedProd.id);

      // Manager CAN CRUD Category; Admin can create/update/archive/safely delete unreferenced Product
      const sharedCat = await createCategoryItem(manager, {
        code: `MG${String(Date.now()).slice(-4)}`,
        name: `Kategori Shared ${Date.now()}`,
        description: 'Dibuat oleh Manager',
      });
      const updatedCat = await updateCategoryItem(admin, sharedCat.id, {
        code: sharedCat.code,
        name: `${sharedCat.name} Rev`,
        description: 'Diperbarui Admin',
      });
      assert.ok(updatedCat.name.endsWith('Rev'));

      const tempProd = await createProductItem(admin, {
        sku: `TMP-${Date.now()}`,
        name: 'Produk Uji Admin',
        categoryId: sharedCat.id,
        purchasePrice: '12000',
        sellingPrice: '18500',
        unit: 'pcs',
      });
      assert.equal(Number(tempProd.selling_price), 18500);
      assert.equal(tempProd.unit, 'PCS');

      // Deleting category used by product must fail; deleting referenced operational product must fail
      await assert.rejects(() => deleteCategoryItem(manager, sharedCat.id), ConflictError);
      await assert.rejects(() => deleteProductItem(admin, product.id), ConflictError);

      // Deleting unreferenced product by Admin succeeds, then unused category can be deleted by Manager
      const delProd = await deleteProductItem(admin, tempProd.id);
      assert.equal(delProd.id, tempProd.id);
      await deleteCategoryItem(manager, sharedCat.id);

      // Soft-archiving a product removes it from active catalog, preserves detail/audit history, and blocks duplicate archive
      const { rows: catRows } = await pool.query(
        `SELECT id FROM categories ORDER BY id ASC LIMIT 1`
      );
      const baseCatId = catRows[0].id;
      const tempArchiveProd = await createProductItem(admin, {
        sku: `ARC-${Date.now()}`,
        name: 'Produk Uji Arsip',
        categoryId: baseCatId,
        purchasePrice: '9000',
        sellingPrice: '14000',
        unit: 'pcs',
      });
      const archivedProd = await archiveProductItem(admin, tempArchiveProd.id);
      assert.ok(archivedProd.deleted_at);

      const catalogSearchArchived = await getProductsCatalog(admin, {
        search: tempArchiveProd.sku,
      });
      assert.equal(catalogSearchArchived.totalCount, 0);

      const archivedDetail = await getProductDetail(admin, tempArchiveProd.id);
      assert.ok(archivedDetail.deleted_at);

      await assert.rejects(
        () => archiveProductItem(admin, tempArchiveProd.id),
        ConflictError
      );

      const archiveAuditRes = await pool.query(
        `SELECT action FROM audit_logs
         WHERE entity_type = 'product' AND entity_id = $1 AND action = 'PRODUCT_ARCHIVED'`,
        [tempArchiveProd.id]
      );
      assert.equal(archiveAuditRes.rows.length, 1);

      // Second Staff user for strict Staff CSV own-transaction isolation test
      const staff2Res = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, status)
         VALUES ($1, $2, 'test-hash', 'staff', 'active')
         RETURNING id, name, email, role`,
        ['Staff Dua Uji', `staff2.${Date.now()}@test.supplify.local`]
      );
      const staff2 = staff2Res.rows[0];
      createdStaff2Id = staff2.id;
      const outOtherStaff = await createOutgoingTransaction(staff2, {
        shipmentDate: '2026-11-24',
        recipientName: 'Penerima Rahasia Staff Lain',
        items: [{ productId: product.id, quantity: 1 }],
      });

      // Admin exports all 6 resources safely
      for (const resource of Object.values(EXPORT_RESOURCES)) {
        const adminExp = await generateCsvExport(admin, resource, {});
        assert.equal(adminExp.csv.startsWith('\uFEFF'), true);
        assert.equal(adminExp.csv.includes('password_hash'), false);
        assert.equal(adminExp.csv.includes('token_hash'), false);

        await assert.rejects(() => generateCsvExport(supplierUser, resource, {}), ForbiddenError);
      }

      // Manager exports ONLY products, purchase-orders, incoming, outgoing (NOT categories/suppliers)
      for (const resAllowed of [
        EXPORT_RESOURCES.PRODUCTS,
        EXPORT_RESOURCES.PURCHASE_ORDERS,
        EXPORT_RESOURCES.INCOMING,
        EXPORT_RESOURCES.OUTGOING,
      ]) {
        const managerExp = await generateCsvExport(manager, resAllowed, {});
        assert.equal(managerExp.csv.startsWith('\uFEFF'), true);
      }
      await assert.rejects(
        () => generateCsvExport(manager, EXPORT_RESOURCES.CATEGORIES, {}),
        ForbiddenError
      );
      await assert.rejects(
        () => generateCsvExport(manager, EXPORT_RESOURCES.SUPPLIERS, {}),
        ForbiddenError
      );

      // Staff cannot export master data or PO, and can export ONLY own Incoming & Outgoing
      for (const resBlocked of [
        EXPORT_RESOURCES.PRODUCTS,
        EXPORT_RESOURCES.CATEGORIES,
        EXPORT_RESOURCES.SUPPLIERS,
        EXPORT_RESOURCES.PURCHASE_ORDERS,
      ]) {
        await assert.rejects(() => generateCsvExport(staff, resBlocked, {}), ForbiddenError);
      }
      const staffIncCsv = await generateCsvExport(staff, EXPORT_RESOURCES.INCOMING, {});
      assert.equal(staffIncCsv.csv.includes(inc1.transaction_code), true);

      const staffOutCsv = await generateCsvExport(staff, EXPORT_RESOURCES.OUTGOING, {
        createdBy: staff2.id,
        userId: staff2.id,
      });
      assert.equal(staffOutCsv.csv.includes(out.transaction_code), true);
      assert.equal(staffOutCsv.csv.includes(outOtherStaff.transaction_code), false);

      const staffOutTargetedLeak = await generateCsvExport(staff, EXPORT_RESOURCES.OUTGOING, {
        search: outOtherStaff.transaction_code,
      });
      assert.equal(staffOutTargetedLeak.rowCount, 0);
      assert.equal(staffOutTargetedLeak.csv.includes(outOtherStaff.transaction_code), false);

      const filteredPoCsv = await generateCsvExport(manager, EXPORT_RESOURCES.PURCHASE_ORDERS, {
        search: po.po_code,
      });
      assert.equal(filteredPoCsv.rowCount, 1);
      assert.equal(filteredPoCsv.csv.includes(po.po_code), true);

      const emptyCsv = await generateCsvExport(admin, EXPORT_RESOURCES.PRODUCTS, {
        search: '__NON_EXISTENT_SKU_99999__',
      });
      assert.equal(emptyCsv.rowCount, 0);
      assert.equal(emptyCsv.csv.startsWith('\uFEFFSKU,'), true);
    } finally {
      await pool.query(`DELETE FROM audit_logs WHERE created_at >= $1`, [testStartTs]);
      await pool.query(
        `DELETE FROM stock_movements WHERE transaction_id > $1 OR stock_adjustment_id > $2`,
        [maxTxId, maxAdjId]
      );
      await pool.query(`DELETE FROM stock_adjustments WHERE id > $1`, [maxAdjId]);
      await pool.query(`DELETE FROM discrepancy_reports WHERE id > $1`, [maxDiscId]);
      await pool.query(`DELETE FROM handover_details WHERE transaction_id > $1`, [maxTxId]);
      await pool.query(`DELETE FROM transaction_items WHERE transaction_id > $1`, [maxTxId]);
      await pool.query(`DELETE FROM transactions WHERE id > $1`, [maxTxId]);
      await pool.query(`DELETE FROM shipment_details WHERE purchase_order_id > $1`, [maxPoId]);
      await pool.query(`DELETE FROM purchase_order_items WHERE purchase_order_id > $1`, [maxPoId]);
      await pool.query(`DELETE FROM purchase_orders WHERE id > $1`, [maxPoId]);
      await pool.query(`DELETE FROM products WHERE id > $1`, [maxProdId]);
      await pool.query(`DELETE FROM categories WHERE id > $1`, [maxCatId]);
      if (createdStaff2Id) {
        await pool.query(`DELETE FROM users WHERE id = $1`, [createdStaff2Id]);
      }
      for (const [pid, origStock] of stockSnapshot.entries()) {
        await pool.query(`UPDATE products SET stock = $2 WHERE id = $1 AND stock <> $2`, [
          pid,
          origStock,
        ]);
      }
      await closePool();
    }
  }
);
