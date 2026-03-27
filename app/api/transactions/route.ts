import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'transactions:list', payload.userId);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(request.url);
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = 20;

  const orderBy = sortBy === 'amount' ? { amount: order } : { createdAt: order };

  const [contributions, total] = await Promise.all([
    prisma.contribution.findMany({
      where: { userId: payload.userId },
      include: { circle: { select: { id: true, name: true } } },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contribution.count({ where: { userId: payload.userId } }),
  ]);

  return NextResponse.json({ contributions, total, page, limit });
}
