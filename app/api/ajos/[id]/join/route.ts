import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'api', route: '/api/ajos/[id]/join' });

/**
 * POST /api/ajos/:id/join
 *
 * Adds the authenticated user to the UserAjo table (off-chain record).
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
  const rateLimited = await applyRateLimit(request, RATE_LIMITS.sensitive, 'ajos:join', payload.userId);
  if (rateLimited) return rateLimited;

  try {
    const { id: ajoId } = await params;

    // ── Validate the Ajo group exists ─────────────────────────────────────
    const ajo = await prisma.ajoGroup.findUnique({ where: { id: ajoId } });
    if (!ajo) return NextResponse.json({ error: 'Ajo not found' }, { status: 404 });

    // Get user address
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { address: true } });
    if (!user || !user.address) return NextResponse.json({ error: 'User address not found' }, { status: 400 });

    const joinRecord = await prisma.userAjo.create({
      data: {
        userAddress: user.address,
        ajoId: ajo.id
      }
    });

    return NextResponse.json({ message: 'Successfully joined Ajo' });
  } catch (err) {
    logger.error('Join ajo failed', { err });
    return NextResponse.json({ error: 'Already joined or DB error' }, { status: 500 });
  }
}
