import path from 'node:path';
import { NextResponse } from 'next/server.js';
import { getCurrentUser } from '../../../../../lib/auth/session.js';
import { PERMISSIONS, requirePermission } from '../../../../../lib/auth/rbac.js';
import { readProductImageFile } from '../../../../../lib/storage/index.js';
import { actionFailure } from '../../../../../lib/utils/response.js';
import { findProductById } from '../../../../../modules/products/productRepo.js';

export const dynamic = 'force-dynamic';

const EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function GET(_request, { params }) {
  try {
    const user = await getCurrentUser();
    requirePermission(user, PERMISSIONS.PRODUCTS_READ);

    const resolvedParams = await params;
    const productId = Number(resolvedParams?.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'ID produk tidak valid.' },
        { status: 400 }
      );
    }

    const product = await findProductById(productId);
    if (!product || !product.image_path) {
      return NextResponse.json(
        { ok: false, error: 'Gambar produk tidak ditemukan.' },
        { status: 404 }
      );
    }

    let buffer;
    try {
      buffer = await readProductImageFile(product.image_path);
    } catch (err) {
      if (err?.code === 'ENOENT') {
        return NextResponse.json(
          { ok: false, error: 'Berkas gambar produk tidak tersedia di penyimpanan.' },
          { status: 404 }
        );
      }
      throw err;
    }

    const ext = path.extname(product.image_path).toLowerCase();
    const contentType = EXT_TO_MIME[ext] || 'image/jpeg';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    const res = actionFailure(err, 'api.products.image.GET');
    return NextResponse.json(res, { status: err?.statusCode || 500 });
  }
}
