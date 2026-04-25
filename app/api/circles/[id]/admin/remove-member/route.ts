import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { z } from 'zod';
import { createChildLogger } from '@/lib/logger';

const RemoveMemberSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
});
const logger = createChildLogger({ service: 'api', route: '/api/circles/[id]/admin/remove-member' });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = await applyRateLimit(request, RATE_LIMITS.sensitive, 'circles:admin-remove', payload.userId);
  if (rateLimited) return rateLimited;

  const validated = await validateBody(request, RemoveMemberSchema);
  if (validated.error) return validated.error;
  const { memberId } = validated.data as z.infer<typeof RemoveMemberSchema>;

  try {
    const { id: circleId } = await params;

    // Verify circle exists and user is organizer
    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
    });

    if (!circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
    }

    if (circle.organizerId !== payload.userId) {
      return NextResponse.json({ error: 'Only the organizer can remove members' }, { status: 403 });
    }

    // Find the member
    const member = await prisma.circleMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (member.circleId !== circleId) {
      return NextResponse.json({ error: 'Member does not belong to this circle' }, { status: 400 });
    }

    // Prevent removing the organizer
    if (member.userId === circle.organizerId) {
      return NextResponse.json({ error: 'Cannot remove the organizer' }, { status: 400 });
    }

    // Update member status to EXITED
    await prisma.circleMember.update({
      where: { id: memberId },
      data: {
        status: 'EXITED',
        leftAt: new Date(),
      },
    });

    return NextResponse.json(
      { success: true, message: 'Member removed successfully' },
      { status: 200 }
    );
  } catch (err) {
    logger.error('Remove member error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
