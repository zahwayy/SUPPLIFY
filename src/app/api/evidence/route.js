import { NextResponse } from 'next/server.js';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { actionFailure, actionSuccess } from '../../../lib/utils/response.js';
import { uploadEvidenceFile } from '../../../modules/files/evidenceService.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    const formData = await request.formData();

    const file = formData.get('file');
    const entityType = String(formData.get('entityType') || '');
    const entityId = Number(formData.get('entityId'));
    const description = formData.get('description');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json(
        { ok: false, error: 'File bukti wajib dipilih.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const created = await uploadEvidenceFile(user, {
      entityType,
      entityId,
      buffer,
      originalName: file.name || 'evidence',
      mimeType: file.type || 'application/octet-stream',
      description,
    });

    return NextResponse.json(
      actionSuccess(created, 'File bukti berhasil diunggah.'),
      { status: 201 }
    );
  } catch (err) {
    const res = actionFailure(err, 'api.evidence.POST');
    return NextResponse.json(res, { status: err?.statusCode || 500 });
  }
}
