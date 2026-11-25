import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, closePool } from '../../src/lib/db/pool.js';

test('getPool reuses the same pool for identical DATABASE_URL and recycles when DATABASE_URL changes', async () => {
  const originalUrl = process.env.DATABASE_URL;

  try {
    await closePool();

    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db_one';
    const poolA1 = getPool();
    const poolA2 = getPool();
    assert.equal(poolA1, poolA2);

    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db_two ';
    const poolB = getPool();
    assert.notEqual(poolB, poolA1);

    const poolB2 = getPool();
    assert.equal(poolB, poolB2);

    await closePool();
  } finally {
    await closePool();
    if (originalUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalUrl;
    }
  }
});
