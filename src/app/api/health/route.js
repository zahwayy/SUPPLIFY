import { NextResponse } from 'next/server';
import { query } from '../../../lib/db/pool.js';
import { logError } from '../../../lib/utils/logger.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rows } = await query(
      'SELECT 1 AS ok, current_database() AS database_name, current_schema() AS schema_name'
    );
    return NextResponse.json(
      {
        ok: true,
        database: 'connected',
        databaseName: rows[0]?.database_name || null,
        schema: rows[0]?.schema_name || null,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    logError('api.health', err);
    return NextResponse.json(
      { ok: false, database: 'unavailable' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
