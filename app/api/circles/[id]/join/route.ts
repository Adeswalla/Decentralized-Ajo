import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { invalidatePrefix } from '@/lib/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'circles:join-preview', payload.userId);
  if (rateLimited) return rateLimited;

  try {
    const { id } = await params;

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
    console.error('Preview circle error:', err);
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

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'circles:join', payload.userId);
  if (rateLimited) return rateLimited;

  try {
    const { id } = await params;

    const circle = await prisma.circle.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 });

    const existingMember = await prisma.circleMember.findUnique({
      where: { circleId_userId: { circleId: id, userId: payload.userId } },
    });

    if (existingMember) {
      return NextResponse.json({ error: 'You are already a member of this circle' }, { status: 409 });
    }

    if (circle.status !== 'ACTIVE' && circle.status !== 'PENDING') {
      return NextResponse.json({ error: 'This circle is not accepting new members' }, { status: 403 });
    }

    const newMember = await prisma.circleMember.create({
      data: {
        circleId: id,
        userId: payload.userId,
        rotationOrder: circle.members.length + 1,
      },
    // Bust detail cache so the new member count is reflected immediately
    invalidatePrefix(`circles:detail:${id}`);
    invalidatePrefix(`circles:list:${payload.userId}`);

    return NextResponse.json({ success: true, member: newMember }, { status: 201 });
  } catch (err) {
    console.error('Join circle error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
