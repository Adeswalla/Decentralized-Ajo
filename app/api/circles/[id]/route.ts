import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { UpdateCircleSchema } from '@/lib/validations/circle';
import type { UpdateCircleInput } from '@/lib/validations/circle';
import { RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'circles:get', payload.userId);
  if (rateLimited) return rateLimited;

  try {
    const { id } = await params;

    const circle = await prisma.circle.findUnique({
      where: { id },
      include: {
        organizer: {
          select: { id: true, email: true, firstName: true, lastName: true, walletAddress: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true, walletAddress: true },
            },
          },
        },
        contributions: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        payments: { orderBy: { dueDate: 'asc' } },
      },
    });

    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 });

    const isMember = circle.members.some((m: { userId: string }) => m.userId === payload.userId);
    const isOrganizer = circle.organizerId === payload.userId;

    if (!isMember && !isOrganizer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ success: true, circle }, { status: 200 });
  } catch (err) {
    console.error('Get circle error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'circles:update', payload.userId);
  if (rateLimited) return rateLimited;

  const validated = await validateBody(request, UpdateCircleSchema);
  if (validated.error) return validated.error;
  const data = validated.data as UpdateCircleInput;

  try {
    const { id } = await params;

    const circle = await prisma.circle.findUnique({ where: { id } });
    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 });

    if (circle.organizerId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedCircle = await prisma.circle.update({
      where: { id },
      data: {
        name: data.name ?? circle.name,
        description: data.description ?? circle.description,
        status: data.status ?? circle.status,
      },
      include: {
        organizer: { select: { id: true, email: true, firstName: true, lastName: true } },
        members: { include: { user: { select: { id: true, email: true } } } },
      },
    });

    return NextResponse.json({ success: true, circle: updatedCircle }, { status: 200 });
  } catch (err) {
    console.error('Update circle error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
