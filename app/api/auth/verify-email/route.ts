import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'api', route: '/api/auth/verify-email' });

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing verification token' }, { status: 400 });
  }

  try {
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verificationToken) {
      return NextResponse.json({ error: 'Invalid verification token' }, { status: 400 });
    }

    if (new Date() > verificationToken.expiresAt) {
      // Token expired, delete it and return error
      await prisma.verificationToken.delete({ where: { id: verificationToken.id } });
      return NextResponse.json({ error: 'Verification token has expired' }, { status: 400 });
    }

    // Verify user email
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerifiedAt: new Date(), verified: true },
      }),
      prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      }),
    ]);

    // Redirect to a success page or return success JSON
    // For now, return JSON success
    return NextResponse.json({ success: true, message: 'Email verified successfully' });
  } catch (err: any) {
    logger.error('Email verification error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
