import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  hashPassword,
  validatePasswordStrength,
} from '@/lib/auth';
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { RegisterSchema } from '@/lib/validations/auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';
import { sendVerificationEmail } from '@/lib/email';

const logger = createChildLogger({ service: 'api', route: '/api/auth/register' });

export async function POST(request: NextRequest) {
  const rateLimited = await applyRateLimit(request, RATE_LIMITS.auth, 'auth:register');
  if (rateLimited) return rateLimited;

  const { data, error } = await validateBody(request, RegisterSchema);
  if (error) return error;

  const registerData = data as z.infer<typeof RegisterSchema>;

  try {
    const { email, password, firstName, lastName } = registerData;

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

    const user = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
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

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await tx.verificationToken.create({
        data: {
          token: verificationToken,
          userId: newUser.id,
          expiresAt,
        },
      });

      return { newUser, verificationToken };
    });

    // Send verification email asynchronously
    sendVerificationEmail(user.newUser.email, user.verificationToken).catch((err) => {
      logger.error('Failed to send verification email during registration', { err, userId: user.newUser.id });
    });

    return NextResponse.json(
      { success: true, message: 'Registration successful. Please check your email to verify your account.' },
      { status: 201 },
    );
  } catch (err) {
    logger.error('Registration error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
