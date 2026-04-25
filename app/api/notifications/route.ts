import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'api', route: '/api/notifications' });

// GET /api/notifications — fetch notifications for the current user
export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = await applyRateLimit(request, RATE_LIMITS.api, 'notifications:list', payload.userId);
  if (rateLimited) return rateLimited;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = notifications.filter((n: { read: boolean }) => !n.read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    logger.error('Fetch notifications error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/notifications — mark all as read
export async function PATCH(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  try {
    await prisma.notification.updateMany({
      where: { userId: payload.userId, read: false },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Mark all notifications read error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
