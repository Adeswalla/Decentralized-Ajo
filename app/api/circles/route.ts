import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { CircleStatus } from '@prisma/client';

export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'circles:create', payload.userId);
  if (rateLimited) return rateLimited;

  const validated = await validateBody(request, CreateCircleSchema);
  if (validated.error) return validated.error;
  const data = validated.data as CreateCircleInput;

  try {
    const circle = await prisma.circle.create({
      data: {
        name: data.name,
        description: data.description,
        organizerId: payload.userId,
        contributionAmount: data.contributionAmount,
        contributionFrequencyDays: data.contributionFrequencyDays,
        maxRounds: data.maxRounds,
      },
      include: {
        organizer: { select: { id: true, email: true, firstName: true, lastName: true } },
        members: true,
      },
    });

    await prisma.circleMember.create({
      data: { circleId: circle.id, userId: payload.userId, rotationOrder: 1 },
    });

    return NextResponse.json({ success: true, circle }, { status: 201 });
  } catch (err) {
    console.error('Create circle error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - List circles with pagination and optional status filter
export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'circles:list', payload.userId);
  if (rateLimited) return rateLimited;

    // Parse and validate query params
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10) || 10));
    const statusParam = searchParams.get('status')?.toUpperCase();

    // Validate status value if provided
    if (statusParam && !(statusParam in CircleStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${Object.values(CircleStatus).join(', ')}` },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;

    // Base where clause — user's circles as member or organizer
    const where = {
      OR: [
        { organizerId: payload.userId },
        { members: { some: { userId: payload.userId } } },
      ],
      // Conditionally add status filter
      ...(statusParam ? { status: statusParam as CircleStatus } : {}),
    };

    // Run count and findMany in parallel
    const [total, circles] = await Promise.all([
      prisma.circle.count({ where }),
      prisma.circle.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          organizer: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          members: {
            include: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true },
              },
            },
          },
          contributions: {
            select: { amount: true },
          },
        },
      }),
    ]);

    return NextResponse.json(
      {
        data: circles,
        meta: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('List circles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
