import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  verifyPassword,
  generateToken,
  generateRefreshToken,
  REFRESH_TOKEN_COOKIE_NAME,
  getRefreshTokenExpiryDate,
  isSecureCookieEnvironment,
} from '@/lib/auth';
import { validateBody, applyRateLimit, errorResponse } from '@/lib/api-helpers';
import { LoginSchema } from '@/lib/validations/auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'api', route: '/api/auth/login' });

export async function POST(request: NextRequest) {
  // 1. Rate Limiting
  const rateLimitResponse = await applyRateLimit(
    request,
    RATE_LIMITS.auth,
    'auth-login',
  );
  if (rateLimitResponse) return rateLimitResponse;

  const { data, error } = await validateBody(request, LoginSchema);
  if (error) return error;

  try {
    const { email, password } = data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        walletAddress: true,
        verified: true,
      },
    });

    if (!user) {
      return errorResponse(request, { code: 'invalid_credentials', message: 'Invalid email or password' }, 401);
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return errorResponse(request, { code: 'invalid_credentials', message: 'Invalid email or password' }, 401);
    }

    if (!user.verified) {
      return errorResponse(
        request,
        { code: 'email_not_verified', message: 'Please verify your email address before logging in.' },
        403,
      );
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      walletAddress: user.walletAddress || undefined,
    });
    const refreshToken = await generateRefreshToken(user.id);

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          walletAddress: user.walletAddress,
        },
        token,
      },
      { status: 200 },
    );

    response.cookies.set({
      name: REFRESH_TOKEN_COOKIE_NAME,
      value: refreshToken,
      httpOnly: true,
      secure: isSecureCookieEnvironment(),
      sameSite: 'lax',
      path: '/',
      expires: getRefreshTokenExpiryDate(),
    });

    return response;
  } catch (err) {
    logger.error('Login error', { err });
    return errorResponse(request, { code: 'internal_error', message: 'Internal server error' }, 500);
  }
}
