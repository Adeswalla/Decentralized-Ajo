import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { withCache, cacheInvalidatePrefix } from '@/lib/cache';

// Stats are cached per-user for 60 seconds to avoid hammering the DB on every page load
const STATS_TTL_MS = 60_000;

interface StatsRow {
  active_circles: string;
  total_contributed: string | null;
  contribution_count: string;
  total_members: string;
  total_withdrawn: string | null;
}

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const userId = payload.userId;

  try {
    const stats = await withCache(
      `stats:${payload.userId}`,
      STATS_TTL_MS,
      () => fetchStats(payload.userId),
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function fetchStats(userId: string) {
  /**
   * Single round-trip: compute all four aggregates in one query.
   * Uses the composite indexes on (userId, status) for Contribution and Withdrawal,
   * and (organizerId, status) for Circle.
   *
   * EXPLAIN ANALYZE this query to verify index usage:
   *   EXPLAIN ANALYZE SELECT ...
   */
  const rows = await prisma.$queryRaw<StatsRow[]>`
    SELECT
      -- Active circles where user is organizer or member
      (
        SELECT COUNT(DISTINCT c.id)::text
        FROM "Circle" c
        LEFT JOIN "CircleMember" cm ON cm."circleId" = c.id AND cm."userId" = ${userId}
        WHERE c.status = 'ACTIVE'
          AND (c."organizerId" = ${userId} OR cm."userId" = ${userId})
      ) AS active_circles,

      -- Completed contributions: sum + count
      (
        SELECT COALESCE(SUM(amount), 0)::text
        FROM "Contribution"
        WHERE "userId" = ${userId} AND status = 'COMPLETED'
      ) AS total_contributed,

      (
        SELECT COUNT(*)::text
        FROM "Contribution"
        WHERE "userId" = ${userId} AND status = 'COMPLETED'
      ) AS contribution_count,

      -- Total active members across circles the user belongs to
      (
        SELECT COUNT(*)::text
        FROM "CircleMember" cm2
        WHERE cm2.status = 'ACTIVE'
          AND cm2."circleId" IN (
            SELECT DISTINCT c2.id
            FROM "Circle" c2
            LEFT JOIN "CircleMember" cm3 ON cm3."circleId" = c2.id AND cm3."userId" = ${userId}
            WHERE c2."organizerId" = ${userId} OR cm3."userId" = ${userId}
          )
      ) AS total_members,

      -- Completed withdrawals sum
      (
        SELECT COALESCE(SUM(amount), 0)::text
        FROM "Withdrawal"
        WHERE "userId" = ${userId} AND status = 'COMPLETED'
      ) AS total_withdrawn
  `;

  const row = rows[0];
  return {
    activeCircles: parseInt(row.active_circles, 10),
    totalContributed: parseFloat(row.total_contributed ?? '0'),
    contributionCount: parseInt(row.contribution_count, 10),
    totalMembers: parseInt(row.total_members, 10),
    totalWithdrawn: parseFloat(row.total_withdrawn ?? '0'),
  };
}

/**
 * Exported so contribution/withdrawal mutation routes can bust the cache
 * after a write: cacheInvalidatePrefix(`stats:${userId}`)
 */
export { cacheInvalidatePrefix };
