import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/ajos/:id/join
 *
 * Adds the authenticated user to the UserAjoParticipation table (off-chain record).
 * Status starts as PENDING until an on-chain event confirms the membership.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'ajos:join', payload.userId);
  if (rateLimited) return rateLimited;

  try {
    const { id: ajoId } = await params;

    // ── Validate the Ajo group exists ─────────────────────────────────────
    const ajo = await prisma.circle.findUnique({
      where: { id: ajoId },
      select: { id: true, name: true, status: true, organizerId: true, maxRounds: true, _count: { select: { ajoParticipants: true } } },
    });

    if (!ajo) {
      return NextResponse.json({ error: 'Ajo group not found' }, { status: 404 });
    }

    if (ajo.status !== 'ACTIVE' && ajo.status !== 'PENDING') {
      return NextResponse.json({ error: 'This Ajo group is not accepting new participants' }, { status: 403 });
    }

    // ── Prevent duplicate participation ───────────────────────────────────
    const existing = await prisma.userAjoParticipation.findUnique({
      where: { userId_ajoId: { userId: payload.userId, ajoId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'You are already participating in this Ajo group', participation: existing },
        { status: 409 },
      );
    }

    // ── Enforce member cap (maxRounds is reused as member cap in /api/ajos) ─
    if (ajo._count.ajoParticipants >= ajo.maxRounds) {
      return NextResponse.json({ error: 'This Ajo group has reached its maximum number of participants' }, { status: 403 });
    }

    // ── Create off-chain participation record ─────────────────────────────
    const participation = await prisma.userAjoParticipation.create({
      data: {
        userId: payload.userId,
        ajoId,
        status: 'PENDING', // will be updated to CONFIRMED by on-chain event listener
      },
      select: {
        id: true,
        userId: true,
        ajoId: true,
        status: true,
        onChainTxHash: true,
        confirmedAt: true,
        joinedAt: true,
      },
    });

    // ── Notify organizer ──────────────────────────────────────────────────
    await prisma.notification.create({
      data: {
        userId: ajo.organizerId,
        type: 'MEMBER_JOINED',
        title: 'New participant joined your Ajo group',
        message: `A new member has joined "${ajo.name}". Their participation is pending on-chain confirmation.`,
        circleId: ajoId,
      },
    });

    return NextResponse.json({ success: true, participation }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ajos/:id/join]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
