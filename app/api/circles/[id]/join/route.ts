import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { applyRateLimit, validateId } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';
import { cacheInvalidatePrefix } from '@/lib/cache';
import { MAX_MEMBERS } from '@/lib/validations/circle';

const logger = createChildLogger({ service: 'api', route: '/api/circles/[id]/join' });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = await applyRateLimit(request, RATE_LIMITS.api, 'circles:join-preview', payload.userId);
  if (rateLimited) return rateLimited;

  try {
    const { id } = await params;
    const idError = validateId(request, id);
    if (idError) return idError;

    const circle = await prisma.circle.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        contributionAmount: true,
        contributionFrequencyDays: true,
        maxRounds: true,
        currentRound: true,
        status: true,
        organizer: { select: { firstName: true, lastName: true, email: true } },
        members: { select: { id: true } },
      },
    });

    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 });

    const alreadyMember = await prisma.circleMember.findUnique({
      where: { circleId_userId: { circleId: id, userId: payload.userId } },
    });

    return NextResponse.json({ success: true, circle, alreadyMember: !!alreadyMember });
  } catch (err) {
    logger.error('Preview circle error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = await applyRateLimit(request, RATE_LIMITS.sensitive, 'circles:join', payload.userId);
  if (rateLimited) return rateLimited;

  try {
    const { id } = await params;
    const idError = validateId(request, id);
    if (idError) return idError;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { verified: true },
    });
    if (!user?.verified) {
      return NextResponse.json(
        { error: 'Email verification required to join a circle.' },
        { status: 403 },
      );
    }

    const circle = await prisma.circle.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 });

    if (circle.status !== 'ACTIVE' && circle.status !== 'PENDING') {
      return NextResponse.json({ error: 'This circle is not accepting new members' }, { status: 403 });
    }

    if (circle.members.length >= MAX_MEMBERS) {
      return NextResponse.json(
        { error: 'CircleAtCapacity', message: `Circle has reached the maximum of ${MAX_MEMBERS} members` },
        { status: 409 },
      );
    }

    const newMember = await prisma.circleMember.create({
      data: {
        circleId: id,
        userId: payload.userId,
        rotationOrder: circle.members.length + 1,
      },
    });

    cacheInvalidatePrefix(`circles:detail:${id}`);
    cacheInvalidatePrefix(`circles:list:${payload.userId}`);

    return NextResponse.json({ success: true, member: newMember }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'You are already a member of this circle' }, { status: 409 });
    }
    logger.error('Join circle error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
