import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getConditionMeta,
  getDiscrepancyIssueMeta,
  getDiscrepancySourceHref,
  getMovementSourceHref,
  getMovementTypeMeta,
  getAuditActionMeta,
  formatAuditSummary,
} from '../../src/lib/utils/labels.js';

test('labels helpers map operational enums and contextual links safely', () => {
  assert.equal(getConditionMeta('damaged').label, 'Rusak');
  assert.equal(getDiscrepancyIssueMeta('shortage').label, 'Kekurangan Jumlah');
  assert.equal(getMovementTypeMeta('in').label, 'Barang Masuk (+)');
  assert.equal(getAuditActionMeta('INCOMING_APPROVED').label, 'Incoming Disetujui');

  assert.equal(
    getMovementSourceHref({ transaction_id: 12, transaction_type: 'incoming' }),
    '/incoming/12'
  );
  assert.equal(
    getMovementSourceHref({ transaction_id: 15, transaction_type: 'outgoing' }),
    '/outgoing/15'
  );
  assert.equal(
    getMovementSourceHref({ stock_adjustment_id: 3 }),
    '/stock-adjustments'
  );

  assert.equal(
    getDiscrepancySourceHref({ source_type: 'incoming', transaction_id: 7 }),
    '/incoming/7'
  );
  assert.equal(
    getDiscrepancySourceHref({ source_type: 'purchase_order', purchase_order_id: 9 }),
    '/purchase-orders/9'
  );

  const summary = formatAuditSummary({
    sku: 'STA-001',
    status: 'approved',
    passwordHash: 'secret',
  });
  assert.equal(summary.includes('STA-001'), true);
  assert.equal(summary.includes('secret'), false);
});
