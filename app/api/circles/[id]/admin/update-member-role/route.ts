import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { validateBody, applyRateLimit, validateId } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { z } from 'zod';
import { createChildLogger } from '@/lib/logger';

const UpdateMemberRoleSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'], {
    errorMap: () => ({ message: 'Status must be one of: ACTIVE, INACTIVE, SUSPENDED' }),
  }),
});

const logger = createChildLogger({
  service: 'api',
  route: '/api/circles/[id]/admin/update-member-role',
});

/**
 * POST /api/circles/[id]/admin/update-member-role
 * Update a circle member's role/status.
 * Restricted to the circle organizer (admin) only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Authentication ──────────────────────────────────────────────────────────
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rateLimited = await applyRateLimit(
    request,
    RATE_LIMITS.sensitive,
    'circles:admin-update-role',
    payload.userId,
  );
  if (rateLimited) return rateLimited;

  // ── Input validation ────────────────────────────────────────────────────────
  const validated = await validateBody(request, UpdateMemberRoleSchema);
  if (validated.error) return validated.error;
  const { memberId, status } = validated.data as z.infer<typeof UpdateMemberRoleSchema>;

  try {
    const { id: circleId } = await params;
    const idError = validateId(request, circleId);
    if (idError) return idError;

    // ── Circle lookup ───────────────────────────────────────────────────────
    const circle = await prisma.circle.findUnique({ where: { id: circleId } });
    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 });

    // ── Role / access check ─────────────────────────────────────────────────
    // SECURITY: Only the organizer (admin) is permitted to change member roles.
    // Any other authenticated user — including active circle members — must be denied.
    if (circle.organizerId !== payload.userId) {
      return NextResponse.json(
        { error: 'Only the organizer can update member roles' },
        { status: 403 },
      );
    }

    // ── Member lookup ────────────────────────────────────────────────────────
    const member = await prisma.circleMember.findUnique({ where: { id: memberId } });
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    if (member.circleId !== circleId) {
      return NextResponse.json(
        { error: 'Member does not belong to this circle' },
        { status: 400 },
      );
    }

    // Prevent the organizer from modifying their own record
    if (member.userId === circle.organizerId) {
      return NextResponse.json(
        { error: "Cannot modify the organizer's role" },
        { status: 400 },
      );
    }

    // ── Persist ──────────────────────────────────────────────────────────────
    const updated = await prisma.circleMember.update({
      where: { id: memberId },
      data: { status },
    });

    logger.info('Member role updated', {
      circleId,
      memberId,
      updatedBy: payload.userId,
      newStatus: status,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Member role updated successfully',
        data: { memberId: updated.id, status: updated.status },
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error('Update member role error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
