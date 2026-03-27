import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  hashPassword,
  generateToken,
  validatePasswordStrength,
  generateRefreshToken,
  REFRESH_TOKEN_COOKIE_NAME,
  getRefreshTokenExpiryDate,
  isSecureCookieEnvironment,
} from '@/lib/auth';
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { RegisterSchema } from '@/lib/validations/auth';
import { RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimited = applyRateLimit(request, RATE_LIMITS.auth, 'auth:register');
  if (rateLimited) return rateLimited;

  const { data, error } = await validateBody(request, RegisterSchema);
  if (error) return error;

  try {
    const { email, password, firstName, lastName } = data;

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: 'Password does not meet strength requirements', details: passwordValidation.errors },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        walletAddress: true,
        createdAt: true,
      },
    });

    const token = generateToken({ userId: user.id, email: user.email });
    const refreshToken = await generateRefreshToken(user.id);

    const response = NextResponse.json({ success: true, user, token }, { status: 201 });
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
    console.error('Registration error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
