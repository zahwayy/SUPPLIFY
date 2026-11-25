import { NextResponse } from 'next/server.js';
import { getCurrentUser } from '../../../../lib/auth/session.js';
import { actionFailure, actionSuccess } from '../../../../lib/utils/response.js';
import {
  getAuthorizedEvidenceDownload,
  removeEvidenceFile,
} from '../../../../modules/files/evidenceService.js';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  try {
    const user = await getCurrentUser();
    const resolved = await params;
    const evidenceId = Number(resolved?.id);

    const { file, buffer } = await getAuthorizedEvidenceDownload(user, evidenceId);
    const safeDownloadName = String(file.original_name || 'evidence').replace(
      /["\r\n]/g,
      ''
    );

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${safeDownloadName}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    const res = actionFailure(err, 'api.evidence.GET');
    return NextResponse.json(res, { status: err?.statusCode || 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const user = await getCurrentUser();
    const resolved = await params;
    const evidenceId = Number(resolved?.id);

    const deleted = await removeEvidenceFile(user, evidenceId);
    return NextResponse.json(
      actionSuccess(deleted, 'File bukti berhasil dihapus.'),
      { status: 200 }
    );
  } catch (err) {
    const res = actionFailure(err, 'api.evidence.DELETE');
    return NextResponse.json(res, { status: err?.statusCode || 500 });
  }
}
