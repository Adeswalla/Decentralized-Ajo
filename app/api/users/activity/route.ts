import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const activities = await prisma.activityLog.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      action: true,
      description: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: activities, page, limit });
}
