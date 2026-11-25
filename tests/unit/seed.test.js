import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { verifyPassword } from '../../src/lib/auth/password.js';

const MIGRATION_PATH = path.resolve('src/database/migrations/schema.sql');
const SEED_PATH = path.resolve('src/database/seeds/seed.sql');

test('Unified schema.sql uses standard SQL without IF NOT EXISTS, wraps in BEGIN/COMMIT, and enforces agreed constraints', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  const sqlWithoutComments = sql.replace(/--.*$/gm, '');

  assert.equal(/IF\s+NOT\s+EXISTS/i.test(sqlWithoutComments), false);
  assert.match(sqlWithoutComments, /^\s*BEGIN;/m);
  assert.match(sqlWithoutComments, /COMMIT;\s*$/);
  assert.match(sql, /CREATE TABLE users/i);
  assert.match(sql, /\bphone\b/i);
  assert.match(sql, /CREATE TABLE sessions/i);
  assert.match(sql, /CREATE TABLE suppliers/i);
  assert.match(sql, /CREATE TABLE supplier_appeals/i);
  assert.match(sql, /CREATE TABLE categories/i);
  assert.match(sql, /CREATE TABLE supplier_categories/i);
  assert.match(sql, /CREATE TABLE products/i);
  assert.match(sql, /CREATE TABLE notifications/i);
  assert.match(sql, /purchase_price/i);
  assert.match(sql, /\bselling_price\b/i);
  assert.match(sql, /low_stock_threshold/i);
  assert.match(sql, /shipment_date/i);
  assert.match(sql, /recipient_name/i);
  assert.match(sql, /CREATE UNIQUE INDEX uq_transactions_single_active_incoming_po/i);
  assert.match(sql, /CREATE UNIQUE INDEX uq_supplier_appeals_single_per_supplier/i);
  assert.match(sql, /idx_notifications_recipient_unread_date/i);
  assert.match(sql, /chk_transaction_po_type/i);
  assert.match(sql, /chk_adjustment_not_self_approval/i);
  assert.match(sql, /chk_movement_stock_balance/i);
  assert.match(sql, /^-- /m);
});

test('SQL seed.sql defines 4 test roles with valid bcrypt hash, 3 categories, 15 SKUs, BEGIN/COMMIT, and ON CONFLICT idempotency', async () => {
  const sql = fs.readFileSync(SEED_PATH, 'utf8');
  const sqlWithoutComments = sql.replace(/--.*$/gm, '');

  assert.match(sqlWithoutComments, /^\s*BEGIN;/m);
  assert.match(sqlWithoutComments, /COMMIT;\s*$/);

  for (const email of [
    'admin@supplify.local',
    'manager@supplify.local',
    'staff@supplify.local',
    'supplier@supplify.local',
  ]) {
    assert.equal(sql.includes(email), true, `Missing seeded email: ${email}`);
  }

  const hashMatch = sql.match(/\$2[ab]\$12\$[A-Za-z0-9./]{53}/);
  assert.ok(hashMatch, 'Expected valid bcryptjs hash in seed.sql');
  assert.equal(await verifyPassword('SupplifyTest123!', hashMatch[0]), true);

  for (const cat of ['Stationery', 'Office Supplies', 'Art Supplies']) {
    assert.equal(sql.includes(cat), true, `Missing category: ${cat}`);
  }

  const expectedSkus = [
    'STA-001', 'STA-002', 'STA-003', 'STA-004', 'STA-005',
    'OFF-001', 'OFF-002', 'OFF-003', 'OFF-004', 'OFF-005',
    'ART-001', 'ART-002', 'ART-003', 'ART-004', 'ART-005',
  ];
  for (const sku of expectedSkus) {
    assert.equal(sql.includes(sku), true, `Missing SKU: ${sku}`);
  }

  assert.equal((sql.match(/ON CONFLICT/gi) || []).length >= 4, true);
});
