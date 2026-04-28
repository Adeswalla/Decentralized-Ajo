import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { applyRateLimit, validateId } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';
import { cacheInvalidatePrefix } from '@/lib/cache';

const logger = createChildLogger({ service: 'api', route: '/api/circles/[id]/admin/dissolve' });

/**
 * POST /api/circles/[id]/admin/dissolve
 * Emergency dissolution endpoint - distributes remaining funds to members based on contribution history
 * Can be triggered by:
 * 1. Organizer directly (admin override)
 * 2. Unanimous vote (100% member approval)
 */
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

    const body = await request.json().catch(() => ({}));
    const { proposalId } = body;

    // Verify circle exists and get member data
    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
      include: {
        members: {
          where: { status: 'ACTIVE' },
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (!circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
    }

    if (circle.status === 'DISSOLVED') {
      return NextResponse.json({ error: 'Circle is already dissolved' }, { status: 400 });
    }

    // Authorization check: organizer OR unanimous vote
    const isOrganizer = circle.organizerId === payload.userId;
    let isUnanimousVote = false;

    if (proposalId) {
      // Check if this is a unanimous dissolution vote
      const proposal = await prisma.governanceProposal.findFirst({
        where: {
          id: proposalId,
          circleId,
          proposalType: 'EMERGENCY_DISSOLUTION',
          status: 'PASSED',
        },
        include: { votes: true },
      });

      if (proposal) {
        const totalMembers = circle.members.length;
        const yesVotes = proposal.votes.filter((v) => v.voteChoice === 'YES').length;
        isUnanimousVote = totalMembers > 0 && yesVotes === totalMembers;
      }
    }

    if (!isOrganizer && !isUnanimousVote) {
      return NextResponse.json(
        { error: 'Only the organizer or a unanimous vote can dissolve the circle' },
        { status: 403 }
      );
    }

    // Calculate total pool and member refunds
    const totalContributed = circle.members.reduce((sum, m) => sum + m.totalContributed, 0);
    const totalWithdrawn = circle.members.reduce((sum, m) => sum + m.totalWithdrawn, 0);
    const remainingPool = totalContributed - totalWithdrawn;

    // Execute dissolution in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create refund records for each member based on their net contribution
      const refunds = [];
      for (const member of circle.members) {
        const netContribution = member.totalContributed - member.totalWithdrawn;
        if (netContribution > 0) {
          // Create a withdrawal record for the refund (no penalty for dissolution)
          const withdrawal = await tx.withdrawal.create({
            data: {
              circleId,
              userId: member.userId,
              amount: netContribution,
              requestedAmount: netContribution,
              penaltyPercentage: 0, // No penalty for emergency dissolution
              reason: 'Emergency dissolution refund',
              status: 'APPROVED',
              approvedAt: new Date(),
            },
          });

          refunds.push({
            userId: member.userId,
            email: member.user.email,
            name: `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim(),
            amount: netContribution,
            withdrawalId: withdrawal.id,
          });

          // Update member totals
          await tx.circleMember.update({
            where: { id: member.id },
            data: {
              totalWithdrawn: member.totalContributed, // Full refund
              status: 'EXITED',
              leftAt: new Date(),
            },
          });
        }
      }

      // Update circle status to DISSOLVED
      await tx.circle.update({
        where: { id: circleId },
        data: { status: 'DISSOLVED' },
      });

      // Mark proposal as executed if applicable
      if (proposalId) {
        await tx.governanceProposal.update({
          where: { id: proposalId },
          data: { status: 'EXECUTED' },
        });
      }

      // Create notifications for all members
      for (const member of circle.members) {
        await tx.notification.create({
          data: {
            userId: member.userId,
            type: 'CIRCLE_DISSOLVED',
            title: 'Circle Dissolved',
            message: `${circle.name} has been dissolved. Your funds are available for withdrawal.`,
            circleId,
          },
        });
      }

      return { refunds, remainingPool };
    });

    // Bust caches
    cacheInvalidatePrefix(`circles:detail:${circleId}`);
    cacheInvalidatePrefix(`circles:list:${payload.userId}`);

    logger.info('Circle dissolved successfully', {
      circleId,
      initiator: payload.userId,
      isOrganizer,
      isUnanimousVote,
      remainingPool: result.remainingPool,
      refundCount: result.refunds.length,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Circle dissolved successfully',
        data: {
          remainingPool: result.remainingPool,
          refunds: result.refunds,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    logger.error('Dissolve circle error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
