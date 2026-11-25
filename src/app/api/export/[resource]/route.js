import { NextResponse } from 'next/server.js';
import { getCurrentUser } from '../../../../lib/auth/session.js';
import { actionFailure } from '../../../../lib/utils/response.js';
import { generateCsvExport } from '../../../../modules/export/exportService.js';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser();
    const resolvedParams = await params;
    const resource = String(resolvedParams?.resource || '').trim().toLowerCase();
    const sp = request.nextUrl.searchParams;

    // Only safe filter parameters are forwarded; user scoping is enforced in backend.
    const filters = {
      search: sp.get('search') || '',
      status: sp.get('status') || '',
      categoryId: sp.get('categoryId') || '',
      stockStatus: sp.get('stockStatus') || '',
      sortBy: sp.get('sortBy') || 'sku',
    };

    const result = await generateCsvExport(user, resource, filters);

    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Export-Row-Count': String(result.rowCount),
      },
    });
  } catch (err) {
    const res = actionFailure(err, 'api.export.GET');
    return NextResponse.json(res, { status: err?.statusCode || 500 });
  }
}
