/**
 * Referral API endpoint
 * Closes #608
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'api', route: '/api/referrals' });

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        walletAddress: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate referral link with wallet address as query parameter
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const referralLink = `${baseUrl}/auth/register?ref=${user.walletAddress || user.id}`;

    // Get referral stats (mock data for now - would need a Referral model in production)
    const stats = {
      totalReferrals: 0,
      pendingReferrals: 0,
      confirmedReferrals: 0,
      rewardsEarned: 0,
    };

    // Get referred users list (mock data for now)
    const referredUsers: any[] = [];

    return NextResponse.json({
      referralLink,
      stats,
      referredUsers,
    });
  } catch (error) {
    logger.error('Get referral data error', { err: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
