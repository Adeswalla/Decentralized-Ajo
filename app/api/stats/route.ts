import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';

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
    const [activeCircles, contributionStats, memberStats, withdrawalStats] = await prisma.$transaction([
      // Count active circles where user is a member
      prisma.circle.count({
        where: {
          OR: [
            { organizerId: payload.userId },
            { members: { some: { userId: payload.userId } } },
          ],
          status: 'ACTIVE',
        },
      }),
      
      // Sum of user's completed contributions
      prisma.contribution.aggregate({
        where: {
          userId: payload.userId,
          status: 'COMPLETED',
        },
        _sum: { amount: true },
        _count: true,
      }),
      
      // Total members across user's circles
      prisma.circleMember.count({
        where: {
          circle: {
            OR: [
              { organizerId: payload.userId },
              { members: { some: { userId: payload.userId } } },
            ],
          },
          status: 'ACTIVE',
        },
      }),
      
      // Total withdrawals
      prisma.withdrawal.aggregate({
        where: {
          userId: payload.userId,
          status: 'COMPLETED',
        },
        _sum: { amount: true },
      }),
    ]);

    return NextResponse.json({
      activeCircles,
      totalContributed: contributionStats._sum.amount || 0,
      contributionCount: contributionStats._count,
      totalMembers: memberStats,
      totalWithdrawn: withdrawalStats._sum.amount || 0,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
