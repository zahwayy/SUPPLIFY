import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth/session.js';
import { PERMISSIONS, requirePermission } from '../../../../lib/auth/rbac.js';
import { actionFailure, actionSuccess } from '../../../../lib/utils/response.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    requirePermission(user, PERMISSIONS.USERS_MANAGE);
    return NextResponse.json(
      actionSuccess({ authorized: true, role: user.role }),
      { status: 200 }
    );
  } catch (err) {
    const res = actionFailure(err, 'api.admin.rbacCheck');
    return NextResponse.json(res, { status: err?.statusCode || 500 });
  }
}
