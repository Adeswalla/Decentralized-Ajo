import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { applyRateLimit, validateId } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'api', route: '/api/circles/[id]/admin/dissolve' });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = await applyRateLimit(request, RATE_LIMITS.sensitive, 'circles:admin-dissolve', payload.userId);
  if (rateLimited) return rateLimited;

  try {
    const { id: circleId } = await params;
    const idError = validateId(request, circleId);
    if (idError) return idError;

    // Verify circle exists and user is organizer
    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
    });

    if (!circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
    }

    if (circle.organizerId !== payload.userId) {
      return NextResponse.json({ error: 'Only the organizer can dissolve the circle' }, { status: 403 });
    }

    // Update circle status to CANCELLED
    await prisma.circle.update({
      where: { id: circleId },
      data: {
        status: 'CANCELLED',
      },
    });

    // Update all active members to EXITED
    await prisma.circleMember.updateMany({
      where: {
        circleId,
        status: 'ACTIVE',
      },
      data: {
        status: 'EXITED',
        leftAt: new Date(),
      },
    });

    // Bust caches so dissolved status is immediately visible
    invalidatePrefix(`circles:detail:${circleId}`);
    invalidatePrefix(`circles:list:${payload.userId}`);

    return NextResponse.json(
      { success: true, message: 'Circle dissolved successfully' },
      { status: 200 }
    );
  } catch (err) {
    logger.error('Dissolve circle error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
