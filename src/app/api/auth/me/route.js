import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth/session.js';
import { actionFailure, actionSuccess } from '../../../../lib/utils/response.js';
import { UnauthorizedError } from '../../../../lib/constants/errors.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError();
    }
    return NextResponse.json(actionSuccess({ user }), {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (err) {
    const res = actionFailure(err, 'api.auth.me');
    return NextResponse.json(res, {
      status: err?.statusCode || 500,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
