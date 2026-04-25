import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { z } from 'zod';
import { createChildLogger } from '@/lib/logger';

const InviteSchema = z.object({
  email: z.string().email('Invalid email address'),
});
const logger = createChildLogger({ service: 'api', route: '/api/circles/[id]/admin/invite' });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = await applyRateLimit(request, RATE_LIMITS.sensitive, 'circles:admin-invite', payload.userId);
  if (rateLimited) return rateLimited;

  const validated = await validateBody(request, InviteSchema);
  if (validated.error) return validated.error;
  const { email } = validated.data as z.infer<typeof InviteSchema>;

  try {
    const { id: circleId } = await params;

    // Verify circle exists and user is organizer
    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
      include: { members: true },
    });

    if (!circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
    }

    if (circle.organizerId !== payload.userId) {
      return NextResponse.json({ error: 'Only the organizer can invite members' }, { status: 403 });
    }

    // Find user by email
    const userToInvite = await prisma.user.findUnique({
      where: { email },
    });

    if (!userToInvite) {
      return NextResponse.json({ error: 'User not found with this email' }, { status: 404 });
    }

    // Check if user is already a member
    const existingMember = circle.members.find((m: { userId: string }) => m.userId === userToInvite.id);
    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this circle' }, { status: 400 });
    }

    // Get the next rotation order
    const rotationOrders = circle.members.map((m: { rotationOrder: number }) => m.rotationOrder);
    const maxRotationOrder = rotationOrders.length > 0 ? Math.max(...rotationOrders) : 0;

    // Add user as member
    await prisma.circleMember.create({
      data: {
        circleId,
        userId: userToInvite.id,
        rotationOrder: maxRotationOrder + 1,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json(
      { success: true, message: 'Member invited successfully' },
      { status: 200 }
    );
  } catch (err) {
    logger.error('Invite member error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
