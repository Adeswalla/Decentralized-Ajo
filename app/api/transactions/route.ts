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

  const rateLimited = await applyRateLimit(request, RATE_LIMITS.api, 'transactions:list', payload.userId);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(request.url);
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';
  
  // Pagination parameters
  const cursor = searchParams.get('cursor');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  // Filter parameters
  const circleId = searchParams.get('circleId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const type = searchParams.get('type');

  const where: any = { userId: payload.userId };
  if (circleId) where.circleId = circleId;
  if (type) where.status = type;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  // Stable sort: primary sort + tiebreaker
  const orderBy: any[] = [
    sortBy === 'amount' ? { amount: order } : { createdAt: order },
    { id: order }
  ];

  const findManyOptions: any = {
    where,
    include: { circle: { select: { id: true, name: true } } },
    orderBy,
    take: limit,
  };

  if (cursor) {
    findManyOptions.cursor = { id: cursor };
    findManyOptions.skip = 1; // Skip the cursor itself
  } else if (page > 1) {
    // Fallback to offset pagination if no cursor is provided but page > 1
    findManyOptions.skip = (page - 1) * limit;
  }

  const [contributions, total] = await Promise.all([
    prisma.contribution.findMany(findManyOptions),
    prisma.contribution.count({ where }),
  ]);

  const nextCursor = contributions.length === limit ? contributions[contributions.length - 1].id : null;

  return NextResponse.json({ contributions, total, page, limit, nextCursor });
}
