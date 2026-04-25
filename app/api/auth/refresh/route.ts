import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateToken,
  rotateRefreshToken,
  REFRESH_TOKEN_COOKIE_NAME,
  getRefreshTokenExpiryDate,
  isSecureCookieEnvironment,
} from '@/lib/auth';
import { applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'api', route: '/api/auth/refresh' });

export async function POST(request: NextRequest) {
  // 1. Rate Limiting
  const rateLimited = await applyRateLimit(request, RATE_LIMITS.auth, 'auth:refresh');
  if (rateLimited) return rateLimited;

  const currentRefreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
  if (!currentRefreshToken) {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  try {
    const rotated = await rotateRefreshToken(currentRefreshToken);

    if (!rotated) {
      const unauthorizedResponse = NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 },
      );
      unauthorizedResponse.cookies.set({
        name: REFRESH_TOKEN_COOKIE_NAME,
        value: '',
        httpOnly: true,
        secure: isSecureCookieEnvironment(),
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
      return unauthorizedResponse;
    }

    const user = await prisma.user.findUnique({
      where: { id: rotated.userId },
      select: {
        id: true,
        email: true,
        walletAddress: true,
      },
    });

    if (!user) {
      const unauthorizedResponse = NextResponse.json({ error: 'User not found' }, { status: 401 });
      unauthorizedResponse.cookies.set({
        name: REFRESH_TOKEN_COOKIE_NAME,
        value: '',
        httpOnly: true,
        secure: isSecureCookieEnvironment(),
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
      return unauthorizedResponse;
    }

    const accessToken = generateToken({
      userId: user.id,
      email: user.email,
      walletAddress: user.walletAddress || undefined,
    });

    const response = NextResponse.json({ success: true, token: accessToken }, { status: 200 });
    response.cookies.set({
      name: REFRESH_TOKEN_COOKIE_NAME,
      value: rotated.token,
      httpOnly: true,
      secure: isSecureCookieEnvironment(),
      sameSite: 'lax',
      path: '/',
      expires: getRefreshTokenExpiryDate(),
    });

    return response;
  } catch (err) {
    logger.error('Refresh token error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
