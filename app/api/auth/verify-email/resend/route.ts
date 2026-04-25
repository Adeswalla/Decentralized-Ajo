import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';
import { sendVerificationEmail } from '@/lib/email';

const logger = createChildLogger({ service: 'api', route: '/api/auth/verify-email/resend' });

export async function POST(request: NextRequest) {
  const rateLimited = await applyRateLimit(request, RATE_LIMITS.auth, 'auth:resend-verification');
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return NextResponse.json({ success: true, message: 'If an account exists, a new verification link has been sent.' });
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({ error: 'Email is already verified' }, { status: 400 });
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.$transaction([
      // Delete old tokens
      prisma.verificationToken.deleteMany({ where: { userId: user.id } }),
      // Create new token
      prisma.verificationToken.create({
        data: {
          token: verificationToken,
          userId: user.id,
          expiresAt,
        },
      }),
    ]);

    // Send email
    await sendVerificationEmail(user.email, verificationToken);

    return NextResponse.json({ success: true, message: 'Verification link resent successfully' });
  } catch (err: any) {
    logger.error('Resend verification error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
