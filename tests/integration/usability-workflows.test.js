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
const { hashPassword } = await import('../../src/lib/auth/password.js');
const { ROLES, USER_STATUSES } = await import('../../src/lib/constants/roles.js');
const { SUPPLIER_APPEAL_STATUSES } = await import('../../src/lib/constants/statuses.js');
const {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} = await import('../../src/lib/constants/errors.js');
const {
  registerSupplier,
  verifyAccountStatusFromNotice,
} = await import('../../src/modules/auth/authService.js');
const {
  rejectSupplierRegistration,
  getRejectedSupplierAppealContext,
  submitSupplierAppeal,
  updateSubmittedSupplierAppeal,
  reviewSupplierAppeal,
} = await import('../../src/modules/suppliers/supplierService.js');
const {
  getUserNotifications,
  markUserNotificationRead,
} = await import('../../src/modules/notifications/notificationService.js');
const {
  getOwnProfile,
  updateOwnProfile,
} = await import('../../src/modules/users/userService.js');
const {
  createCategoryItem,
} = await import('../../src/modules/categories/categoryService.js');
const {
  createProductItem,
  updateProductItem,
  deleteProductItem,
} = await import('../../src/modules/products/productService.js');
const {
  resolvePublicProductImagePath,
} = await import('../../src/lib/storage/index.js');
const {
  createPurchaseOrder,
} = await import('../../src/modules/purchase-orders/poService.js');

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
  'Integration: Registration appeal lifecycle, cross-role notifications, own-profile update protection, and safe product delete',
  { skip: !dbReady && 'PostgreSQL DATABASE_URL not configured or unreachable' },
  async () => {
    const pool = getPool();
    const suffix = Date.now();
    const createdUserIds = [];
    const createdCategoryIds = [];
    const createdProductIds = [];
    const createdPoIds = [];
    const { rows: tsRows } = await pool.query('SELECT NOW() AS ts');
    const testStartTs = tsRows[0].ts;

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
      assert.ok(admin && manager && staff, 'Seed users (admin, manager, staff) must exist');

      const passwordHash = await hashPassword('SupplifyTest#2026');

      // 1. Create test pending supplier A and other rejected supplier B
      const {
        rows: [supUserA],
      } = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, status)
         VALUES ($1, $2, $3, 'supplier', 'pending')
         RETURNING id, name, email, role, status`,
        [`Test Supplier Appeal ${suffix}`, `appeal-a-${suffix}@test.local`, passwordHash]
      );
      createdUserIds.push(supUserA.id);

      const {
        rows: [supProfileA],
      } = await pool.query(
        `INSERT INTO suppliers (user_id, company_name, contact_name, phone, address)
         VALUES ($1, $2, 'PIC Awal', '0811000011', 'Jl. Awal Pengujian No. 1')
         RETURNING id, user_id, company_name`,
        [supUserA.id, `PT Uji Banding ${suffix}`]
      );

      // Pending supplier cannot submit appeal
      await assert.rejects(
        () =>
          submitSupplierAppeal(supUserA.id, {
            appealReason: 'Mencoba mengajukan banding saat akun masih pending.',
          }),
        ForbiddenError
      );

      // Admin rejects pending supplier A -> supplier receives notification
      await rejectSupplierRegistration(admin, supProfileA.id, {
        rejectionReason: 'Nomor telepon perusahaan tidak dapat dihubungi saat verifikasi.',
      });

      const noticeCheck = await verifyAccountStatusFromNotice({ userId: supUserA.id });
      assert.equal(noticeCheck.verified, true);
      assert.equal(noticeCheck.userId, supUserA.id);
      assert.equal(noticeCheck.accountStatus, USER_STATUSES.REJECTED);

      const contextBeforeAppeal = await getRejectedSupplierAppealContext(supUserA.id);
      assert.equal(contextBeforeAppeal.eligible, true);
      assert.equal(contextBeforeAppeal.notifications.length >= 1, true);

      // Rejected supplier submits appeal -> status MUST remain 'rejected' until Admin approves
      const submittedAppeal = await submitSupplierAppeal(supUserA.id, {
        appealReason:
          'Nomor telepon sebelumnya salah ketik. Berikut nomor telepon kantor resmi kami yang aktif.',
        phone: '081299998888',
        contactName: 'PIC Terverifikasi',
      });
      assert.equal(submittedAppeal.status, SUPPLIER_APPEAL_STATUSES.SUBMITTED);

      const {
        rows: [afterAppealUser],
      } = await pool.query(`SELECT status FROM users WHERE id = $1`, [supUserA.id]);
      assert.equal(afterAppealUser.status, USER_STATUSES.REJECTED);

      // Second concurrent open appeal is blocked
      await assert.rejects(
        () =>
          submitSupplierAppeal(supUserA.id, {
            appealReason: 'Mengajukan banding ganda ketika masih ada banding aktif.',
          }),
        ConflictError
      );

      // Admin receives persistent notification for the submitted appeal
      const adminNotifs = await getUserNotifications(admin, { limit: 20 });
      const appealNotifForAdmin = adminNotifs.items.find(
        (n) => n.entity_type === 'supplier_appeal' && Number(n.entity_id) === Number(submittedAppeal.id)
      );
      assert.ok(appealNotifForAdmin);

      // Another user cannot update Supplier A's submitted appeal
      await assert.rejects(
        () =>
          updateSubmittedSupplierAppeal(staff.id, submittedAppeal.id, {
            appealReason: 'Percobaan ubah banding milik akun lain secara tidak sah.',
          }),
        ForbiddenError
      );

      // Owner can edit appeal while still 'submitted'
      const updatedAppeal = await updateSubmittedSupplierAppeal(supUserA.id, submittedAppeal.id, {
        appealReason:
          'Nomor telepon kantor terbaru sudah diperbarui beserta penanggung jawab resmi perusahaan.',
        phone: '081277776666',
        contactName: 'Rina Penanggung Jawab',
        address: 'Jl. Gudang Baru No. 88, Surabaya',
      });
      assert.equal(updatedAppeal.proposed_updates.phone, '081277776666');

      // Non-admin role cannot review appeal
      await assert.rejects(
        () =>
          reviewSupplierAppeal(manager, submittedAppeal.id, {
            decision: SUPPLIER_APPEAL_STATUSES.APPROVED,
          }),
        ForbiddenError
      );

      // Admin marks under_review -> editing by supplier now blocked
      await reviewSupplierAppeal(admin, submittedAppeal.id, {
        decision: SUPPLIER_APPEAL_STATUSES.UNDER_REVIEW,
      });
      await assert.rejects(
        () =>
          updateSubmittedSupplierAppeal(supUserA.id, submittedAppeal.id, {
            appealReason: 'Mencoba mengubah saat status sudah ditinjau admin.',
          }),
        ConflictError
      );

      // Admin rejects appeal #1 with notes -> account stays rejected & 1-appeal quota is exhausted
      const rejRes = await reviewSupplierAppeal(admin, submittedAppeal.id, {
        decision: SUPPLIER_APPEAL_STATUSES.REJECTED,
        adminDecisionNotes: 'Mohon cantumkan alamat lengkap RT/RW dan jam operasional.',
      });
      assert.equal(rejRes.supplierStatus, USER_STATUSES.REJECTED);

      const exhaustedContext = await getRejectedSupplierAppealContext(supUserA.id);
      assert.equal(exhaustedContext.isAppealExhausted, true);
      assert.equal(exhaustedContext.hasUsedAppeal, true);
      assert.equal(exhaustedContext.appealCount, 1);

      // Supplier A CANNOT submit a second appeal once their 1-time appeal was rejected
      await assert.rejects(
        () =>
          submitSupplierAppeal(supUserA.id, {
            appealReason:
              'Mencoba mengajukan banding kedua kalinya setelah banding pertama ditolak.',
            phone: '081355554444',
          }),
        ConflictError
      );

      // Re-registering with the same rejected email explicitly tells user to register with a new email
      await assert.rejects(
        () =>
          registerSupplier({
            name: 'Daftar Ulang Email Sama',
            email: supUserA.email,
            password: 'PasswordBaru#123',
            confirmPassword: 'PasswordBaru#123',
            companyName: `PT Uji Banding ${suffix}`,
            contactName: 'PIC Baru',
            phone: '081355554444',
            address: 'Jl. Gudang Baru No. 88, Surabaya',
            categoryIds: [1],
          }),
        ConflictError
      );

      // Supplier B (rejected, 0 appeals used) submits its single allowed appeal -> Admin approves
      const {
        rows: [supUserB],
      } = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, status)
         VALUES ($1, $2, $3, 'supplier', 'rejected')
         RETURNING id, name, email, role, status`,
        [`Test Supplier Appeal B ${suffix}`, `appeal-b-${suffix}@test.local`, passwordHash]
      );
      createdUserIds.push(supUserB.id);

      const {
        rows: [supProfileB],
      } = await pool.query(
        `INSERT INTO suppliers (user_id, company_name, contact_name, phone, address, rejection_reason, verified_by, verified_at)
         VALUES ($1, $2, 'PIC Awal B', '0811000022', 'Jl. Awal B No. 2', 'Kontak perlu dikonfirmasi.', $3, NOW())
         RETURNING id, user_id, company_name`,
        [supUserB.id, `PT Uji Banding B ${suffix}`, admin.id]
      );

      const secondSupplierAppeal = await submitSupplierAppeal(supUserB.id, {
        appealReason:
          'Kami lengkapi alamat operasional perusahaan secara detail beserta nomor kontak aktif.',
        phone: '081355554444',
        contactName: 'Rina Penanggung Jawab',
        address: 'Jl. Gudang Baru No. 88 RT 04 RW 02, Surabaya',
      });

      const appRes = await reviewSupplierAppeal(admin, secondSupplierAppeal.id, {
        decision: SUPPLIER_APPEAL_STATUSES.APPROVED,
        adminDecisionNotes: 'Data lengkap dan nomor telepon dapat dihubungi.',
      });
      assert.equal(appRes.supplierStatus, USER_STATUSES.ACTIVE);

      const {
        rows: [activatedSup],
      } = await pool.query(
        `SELECT u.status, s.contact_name, s.phone, s.address, s.rejection_reason
         FROM users u
         INNER JOIN suppliers s ON s.user_id = u.id
         WHERE u.id = $1`,
        [supUserB.id]
      );
      assert.equal(activatedSup.status, USER_STATUSES.ACTIVE);
      assert.equal(activatedSup.phone, '081355554444');
      assert.equal(activatedSup.rejection_reason, null);

      // Mark admin notification as read cleanly
      await markUserNotificationRead(admin, appealNotifForAdmin.id);

      // 2. Profile editing: authenticated self-update & tampered restricted keys rejected
      await assert.rejects(() => getOwnProfile(null), UnauthorizedError);

      await assert.rejects(
        () =>
          updateOwnProfile(supUserB, {
            name: 'Mitra Uji',
            phone: '081355554444',
            contactName: 'Rina',
            address: 'Jl. Valid No. 5',
            role: 'admin',
          }),
        ForbiddenError
      );

      await assert.rejects(
        () =>
          updateOwnProfile(staff, {
            name: 'Staff Uji',
            email: 'spoof@test.local',
          }),
        ForbiddenError
      );

      const updatedSupProfile = await updateOwnProfile(supUserB, {
        name: 'Mitra Uji Terupdate',
        phone: '081300009999',
        contactName: 'Rina Baru',
        address: 'Jl. Logistik Terpadu No. 12, Surabaya',
      });
      assert.equal(updatedSupProfile.name, 'Mitra Uji Terupdate');
      assert.equal(updatedSupProfile.phone, '081300009999');
      assert.equal(updatedSupProfile.supplier_contact_name, 'Rina Baru');
      assert.equal(updatedSupProfile.role, ROLES.SUPPLIER);
      assert.equal(updatedSupProfile.company_name || updatedSupProfile.supplier_company_name, `PT Uji Banding B ${suffix}`);

      // Create temporary internal user for clean profile-edit verification without mutating seed users
      const {
        rows: [tempStaff],
      } = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, status)
         VALUES ($1, $2, $3, 'staff', 'active')
         RETURNING id, name, email, role, status`,
        [`Temp Staff ${suffix}`, `staff-${suffix}@test.local`, passwordHash]
      );
      createdUserIds.push(tempStaff.id);

      const updatedStaff = await updateOwnProfile(tempStaff, {
        name: 'Temp Staff Baru',
        phone: '082111223344',
      });
      assert.equal(updatedStaff.name, 'Temp Staff Baru');
      assert.equal(updatedStaff.phone, '082111223344');
      assert.equal(updatedStaff.role, ROLES.STAFF);

      // 3. Safe product deletion vs historical relationship protection
      const cat = await createCategoryItem(manager, {
        code: `UT${String(suffix).slice(-4)}`,
        name: `Kategori Uji Hapus ${suffix}`,
      });
      createdCategoryIds.push(cat.id);

      const prodUnused = await createProductItem(admin, {
        sku: `DEL-OK-${suffix}`,
        categoryId: cat.id,
        name: 'Produk Uji Bisa Dihapus',
        purchasePrice: '10000',
        sellingPrice: '15000',
        unit: 'pcs',
        minimumStock: '2',
        lowStockThreshold: '5',
      });
      createdProductIds.push(prodUnused.id);

      const prodReferenced = await createProductItem(admin, {
        sku: `DEL-REF-${suffix}`,
        categoryId: cat.id,
        name: 'Produk Uji Terpakai PO',
        purchasePrice: '20000',
        sellingPrice: '28000',
        unit: 'pcs',
        minimumStock: '2',
        lowStockThreshold: '5',
      });
      createdProductIds.push(prodReferenced.id);

      const po = await createPurchaseOrder(manager, {
        supplierId: supProfileB.id,
        orderDate: '2026-11-25',
        notes: 'PO uji relasi hapus produk',
        items: [{ productId: prodReferenced.id, quantity: 3 }],
      });
      createdPoIds.push(po.id);

      // Referenced product MUST NOT be deleted
      await assert.rejects(
        () => deleteProductItem(admin, prodReferenced.id),
        ConflictError
      );

      // Unreferenced 0-stock product CAN be deleted after confirmation
      const deleted = await deleteProductItem(admin, prodUnused.id);
      assert.equal(deleted.sku, `DEL-OK-${suffix}`);

      // 4. Product image upload & replacement save cleanly into /public/images/products/
      const imgProd = await createProductItem(
        admin,
        {
          sku: `IMG-PUB-${suffix}`,
          categoryId: cat.id,
          name: 'Produk Gambar Public',
          purchasePrice: '15000',
          sellingPrice: '22000',
          unit: 'pcs',
          minimumStock: '1',
          lowStockThreshold: '5',
        },
        {
          imageFile: {
            buffer: Buffer.from('test-public-image-v1'),
            mimeType: 'image/webp',
            originalName: 'uji-produk.webp',
          },
        }
      );
      createdProductIds.push(imgProd.id);
      assert.equal(imgProd.image_path?.startsWith('/images/products/'), true);
      const firstImgDiskPath = resolvePublicProductImagePath(imgProd.image_path);
      assert.equal(fs.existsSync(firstImgDiskPath), true);

      const updatedImgProd = await updateProductItem(
        admin,
        imgProd.id,
        {
          name: 'Produk Gambar Public V2',
          categoryId: cat.id,
          purchasePrice: '15000',
          sellingPrice: '22000',
          unit: 'pcs',
          minimumStock: '1',
          lowStockThreshold: '5',
        },
        {
          imageFile: {
            buffer: Buffer.from('test-public-image-v2'),
            mimeType: 'image/png',
            originalName: 'uji-produk-v2.png',
          },
        }
      );
      assert.equal(updatedImgProd.image_path?.startsWith('/images/products/'), true);
      assert.notEqual(updatedImgProd.image_path, imgProd.image_path);
      const secondImgDiskPath = resolvePublicProductImagePath(updatedImgProd.image_path);
      assert.equal(fs.existsSync(secondImgDiskPath), true);
      assert.equal(fs.existsSync(firstImgDiskPath), false);

      await deleteProductItem(admin, imgProd.id);
      assert.equal(fs.existsSync(secondImgDiskPath), false);
    } finally {
      await pool.query(`DELETE FROM notifications WHERE created_at >= $1`, [testStartTs]);
      await pool.query(`DELETE FROM audit_logs WHERE created_at >= $1`, [testStartTs]);
      if (createdPoIds.length > 0) {
        await pool.query(`DELETE FROM purchase_order_items WHERE purchase_order_id = ANY($1::bigint[])`, [
          createdPoIds,
        ]);
        await pool.query(`DELETE FROM purchase_orders WHERE id = ANY($1::bigint[])`, [createdPoIds]);
      }
      if (createdProductIds.length > 0) {
        await pool.query(`DELETE FROM products WHERE id = ANY($1::bigint[])`, [createdProductIds]);
      }
      if (createdCategoryIds.length > 0) {
        await pool.query(`DELETE FROM categories WHERE id = ANY($1::bigint[])`, [createdCategoryIds]);
      }
      if (createdUserIds.length > 0) {
        await pool.query(
          `DELETE FROM supplier_appeals WHERE submitted_by_user_id = ANY($1::bigint[])`,
          [createdUserIds]
        );
        await pool.query(`DELETE FROM suppliers WHERE user_id = ANY($1::bigint[])`, [
          createdUserIds,
        ]);
        await pool.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [createdUserIds]);
      }
      await closePool();
    }
  }
);
