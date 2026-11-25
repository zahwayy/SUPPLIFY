import pg from 'pg';
import { logError } from '../utils/logger.js';

const { Pool } = pg;

function createPool(connectionString) {
  const normalizedUrl = typeof connectionString === 'string' ? connectionString.trim() : '';
  if (!normalizedUrl) {
    throw new Error('DATABASE_URL environment variable is not configured.');
  }

  const pool = new Pool({
    connectionString: normalizedUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    logError('pg.Pool', err);
  });

  return pool;
}

export function getPool() {
  const connectionString = (process.env.DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not configured.');
  }

  if (
    globalThis.__supplifyPgPool &&
    globalThis.__supplifyPgPoolUrl !== connectionString
  ) {
    const stalePool = globalThis.__supplifyPgPool;
    globalThis.__supplifyPgPool = null;
    globalThis.__supplifyPgPoolUrl = null;
    stalePool.end().catch((err) => logError('pg.Pool.recycle', err));
  }

  if (!globalThis.__supplifyPgPool) {
    globalThis.__supplifyPgPool = createPool(connectionString);
    globalThis.__supplifyPgPoolUrl = connectionString;
  }

  return globalThis.__supplifyPgPool;
}

export async function query(text, params = []) {
  const pool = getPool();
  return pool.query(text, params);
}

/**
 * Executes a callback inside an explicit PostgreSQL BEGIN/COMMIT/ROLLBACK transaction.
 * Automatically releases the client back to the pool.
 */
export async function withTransaction(callback) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (globalThis.__supplifyPgPool) {
    const pool = globalThis.__supplifyPgPool;
    globalThis.__supplifyPgPool = null;
    globalThis.__supplifyPgPoolUrl = null;
    await pool.end();
  }
}
