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
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { LoginSchema } from '@/lib/validations/auth';
import { RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimited = applyRateLimit(request, RATE_LIMITS.auth, 'auth:login');
  if (rateLimited) return rateLimited;

  const { data, error } = await validateBody(request, LoginSchema);
  if (error) return error;

  try {
    const { email, password } = data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
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
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
