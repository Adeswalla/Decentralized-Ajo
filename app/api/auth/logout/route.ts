import { NextRequest, NextResponse } from 'next/server';
import {
  extractToken,
  verifyToken,
  revokeUserRefreshTokens,
  REFRESH_TOKEN_COOKIE_NAME,
  isSecureCookieEnvironment,
} from '@/lib/auth';
import { applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'api', route: '/api/auth/logout' });

export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = await applyRateLimit(request, RATE_LIMITS.auth, 'auth:logout');
  if (rateLimited) return rateLimited;

  try {
    await revokeUserRefreshTokens(payload.userId);

    const response = NextResponse.json({ success: true }, { status: 200 });
    response.cookies.set({
      name: REFRESH_TOKEN_COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: isSecureCookieEnvironment(),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err) {
    logger.error('Logout error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
