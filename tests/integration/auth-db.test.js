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

const { getPool, withTransaction, closePool } = await import('../../src/lib/db/pool.js');
const {
  registerSupplier,
  loginWithCredentials,
} = await import('../../src/modules/auth/authService.js');
const {
  createCategoryItem,
  deleteCategoryItem,
} = await import('../../src/modules/categories/categoryService.js');
const {
  createSessionRecord,
  findActiveSessionByToken,
  revokeSessionByToken,
} = await import('../../src/lib/auth/sessionStore.js');
const { ConflictError, ForbiddenError, UnauthorizedError } = await import(
  '../../src/lib/constants/errors.js'
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
  'Database integration: supplier registration, pending/rejected/active gates, session lifecycle & logout',
  { skip: !dbReady && 'PostgreSQL DATABASE_URL not configured or unreachable' },
  async () => {
    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const testEmail = `supplier.${uniqueSuffix}@test.supplify.local`;
    const testPassword = 'TestPassword123!';

    const pool = getPool();
    const { rows: adminRows } = await pool.query(
      `SELECT id, role FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1`
    );
    const adminActor = adminRows[0] || { id: 1, role: 'admin' };

    let createdUserId = null;
    let tempCategoryId = null;

    try {
      // Create temporary category -> must be available immediately for Supplier registration
      const tempCat = await createCategoryItem(adminActor, {
        code: `UT${String(Date.now()).slice(-4)}`,
        name: `Kategori Uji Supplier ${uniqueSuffix}`,
        description: 'Kategori sementara uji integrasi supplier',
      });
      tempCategoryId = tempCat.id;

      // 1. Register Supplier with dynamic category -> status pending, password hashed, supplier_categories persisted
      const reg = await registerSupplier({
        name: 'Integration Supplier',
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
        companyName: `PT Uji Integrasi ${uniqueSuffix}`,
        contactName: 'PIC Uji',
        phone: '081299988877',
        address: 'Jl. Pengujian No. 1, Jakarta',
        categoryIds: [tempCategoryId],
      });

      createdUserId = reg.user.id;
      assert.equal(reg.user.role, 'supplier');
      assert.equal(reg.user.status, 'pending');

      const { rows: scRows } = await pool.query(
        'SELECT supplier_id, category_id FROM supplier_categories WHERE supplier_id = $1',
        [reg.supplier.id]
      );
      assert.equal(scRows.length, 1);
      assert.equal(Number(scRows[0].category_id), Number(tempCategoryId));

      // Category linked to supplier must NOT be deletable
      await assert.rejects(
        () => deleteCategoryItem(adminActor, tempCategoryId),
        ConflictError
      );

      // 2. Pending Supplier MUST NOT be allowed to login
      await assert.rejects(
        () => loginWithCredentials({ email: testEmail, password: testPassword }),
        ForbiddenError
      );

      // 3. Rejected Supplier MUST NOT be allowed to login (and rejection reason included)
      await pool.query("UPDATE users SET status = 'rejected' WHERE id = $1", [
        createdUserId,
      ]);
      await pool.query(
        "UPDATE suppliers SET rejection_reason = 'Dokumen SIUP tidak lengkap' WHERE user_id = $1",
        [createdUserId]
      );
      await assert.rejects(
        () => loginWithCredentials({ email: testEmail, password: testPassword }),
        (err) =>
          err instanceof ForbiddenError &&
          err.message.includes('Dokumen SIUP tidak lengkap')
      );

      // 4. Simulate Admin approval -> status = active
      await pool.query("UPDATE users SET status = 'active' WHERE id = $1", [
        createdUserId,
      ]);

      // 5. Wrong password rejected
      await assert.rejects(
        () => loginWithCredentials({ email: testEmail, password: 'WrongPassword!' }),
        UnauthorizedError
      );

      // 6. Verified Supplier can login
      const loggedIn = await loginWithCredentials({
        email: testEmail,
        password: testPassword,
      });
      assert.equal(loggedIn.email, testEmail);
      assert.equal(loggedIn.role, 'supplier');
      assert.ok(loggedIn.supplierId);

      // 7. Session creation, lookup, revocation (logout) & expiration
      const { rawToken } = await createSessionRecord(createdUserId);
      const found = await findActiveSessionByToken(rawToken);
      assert.ok(found);
      assert.equal(found.id, createdUserId);

      const revoked = await revokeSessionByToken(rawToken);
      assert.equal(revoked, true);
      const afterRevoke = await findActiveSessionByToken(rawToken);
      assert.equal(afterRevoke, null);

      // 8. Expired session rejected
      const { rawToken: expToken, session: expSession } =
        await createSessionRecord(createdUserId);
      await pool.query(
        "UPDATE sessions SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1",
        [expSession.id]
      );
      const afterExpire = await findActiveSessionByToken(expToken);
      assert.equal(afterExpire, null);
    } finally {
      if (createdUserId) {
        await withTransaction(async (client) => {
          await client.query('DELETE FROM audit_logs WHERE actor_id = $1', [
            createdUserId,
          ]);
          await client.query('DELETE FROM sessions WHERE user_id = $1', [
            createdUserId,
          ]);
          await client.query('DELETE FROM suppliers WHERE user_id = $1', [
            createdUserId,
          ]);
          await client.query('DELETE FROM users WHERE id = $1', [createdUserId]);
        });
      }
      if (tempCategoryId) {
        await withTransaction(async (client) => {
          await client.query(
            `DELETE FROM audit_logs WHERE entity_type = 'category' AND entity_id = $1`,
            [tempCategoryId]
          );
          await client.query('DELETE FROM categories WHERE id = $1', [tempCategoryId]);
        });
      }
      await closePool();
    }
  }
);
