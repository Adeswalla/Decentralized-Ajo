import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { CircleStatus } from '@prisma/client';

// GET - List circles with pagination, filtering, and sorting
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { redisClient } from '@/lib/redis';
import { CircleStatus } from '@prisma/client';

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
    // Parse and validate query params
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10) || 10));
    const statusParam = searchParams.get('status')?.toUpperCase();
    const durationParam = searchParams.get('duration'); // Weekly, Monthly, Quarterly
    const sortBy = searchParams.get('sortBy') || 'newest'; // newest, size_desc, size_asc, name_asc, name_desc

    // Create cache key from query parameters
    const cacheParams = JSON.stringify({ page, limit, statusParam, durationParam, sortBy, searchQuery });
    
    // Try to get cached results first
    const cachedResult = await redisClient.getCachedCircleList(payload.userId, cacheParams);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    // Validate status value if provided
    if (statusParam && !(statusParam in CircleStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${Object.values(CircleStatus).join(', ')}` },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';

    const durationDaysMap: Record<string, number> = {
      Weekly: 7,
      Monthly: 30,
      Quarterly: 90,
    };

    // Build where clause — single source of truth, no duplicate filters
    const where: any = {
      AND: [
        // User membership filter
        {
          OR: [
            { organizerId: payload.userId },
            { members: { some: { userId: payload.userId } } },
          ],
        },
        // Status filter (uses @@index([organizerId, status]) and @@index([status]))
        ...(statusParam ? [{ status: statusParam as CircleStatus }] : []),
        // Duration filter
        ...(durationParam && durationDaysMap[durationParam]
          ? [{ contributionFrequencyDays: durationDaysMap[durationParam] }]
          : []),
        // Search filter — uses both name and description
        ...(search
          ? [
              {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { description: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
      ],
    };

    // Build orderBy
    let orderBy: any = {};
    if (sortBy === 'size_desc') {
      orderBy = { members: { _count: 'desc' } };
    } else if (sortBy === 'size_asc') {
      orderBy = { members: { _count: 'asc' } };
    } else if (sortBy === 'name_asc') {
      orderBy = { name: 'asc' };
    } else if (sortBy === 'name_desc') {
      orderBy = { name: 'desc' };
    } else {
      orderBy = { createdAt: 'desc' }; // newest first
    }

    // Run optimized queries in parallel
    const [total, circles] = await Promise.all([
      prisma.circle.count({ where }),
      prisma.circle.findMany({
        where,
        take: limit,
        skip,
        orderBy,
        include: {
          organizer: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          members: {
            where: { status: 'ACTIVE' }, // Only include active members
            include: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true },
              },
            },
          },
          contributions: {
            where: { status: 'COMPLETED' }, // Only include completed contributions
            select: { amount: true },
          },
        },
      }),
    ]);

    const result = {
      data: circles,
      meta: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      },
    };

    // Cache the results for 3 minutes (180 seconds)
    await redisClient.cacheCircleList(payload.userId, cacheParams, result, 180);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('List circles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}