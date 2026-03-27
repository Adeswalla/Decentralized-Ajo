import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId;

    // Get stats
    const totalCircles = await prisma.circleMember.count({
      where: { userId }
    });

    const activeCircles = await prisma.circleMember.count({
      where: { 
        userId,
        circle: { status: 'ACTIVE' }
      }
    });

    const totalContributed = await prisma.contribution.aggregate({
      where: { 
        userId,
        status: 'COMPLETED'
      },
      _sum: {
        amount: true
      }
    });

    const totalWithdrawn = await prisma.withdrawal.aggregate({
      where: {
        userId,
        status: 'COMPLETED'
      },
      _sum: {
        amount: true
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalCircles,
        activeCircles,
        totalContributed: totalContributed._sum.amount || 0,
        totalWithdrawn: totalWithdrawn._sum.amount || 0,
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
