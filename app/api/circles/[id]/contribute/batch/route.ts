import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { validateBody, applyRateLimit, validateId } from '@/lib/api-helpers';
import { BatchContributeSchema, MIN_CONTRIBUTION_AMOUNT, MAX_CONTRIBUTION_AMOUNT } from '@/lib/validations/circle';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sendContributionReminder, sendPayoutAlert } from '@/lib/email';
import { createChildLogger } from '@/lib/logger';
import { cacheInvalidatePrefix } from '@/lib/cache';

const logger = createChildLogger({ service: 'api', route: '/api/circles/[id]/contribute/batch' });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  // Only organizers can batch contribute on behalf of members
  const rateLimited = await applyRateLimit(request, RATE_LIMITS.sensitive, 'circles:batch-contribute', payload.userId);
  if (rateLimited) return rateLimited;

  const { data, error } = await validateBody(request, BatchContributeSchema);
  if (error) return error;

  try {
    const { id } = await params;
    const idError = validateId(request, id);
    if (idError) return idError;

    const circle = await prisma.circle.findUnique({ 
      where: { id },
      include: { members: true }
    });
    
    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 });

    // Verify requester is the organizer
    if (circle.organizerId !== payload.userId) {
      return NextResponse.json({ error: 'Only the organizer can batch contribute' }, { status: 403 });
    }

    // Validate all contributions
    const memberIds = new Set(circle.members.map(m => m.userId));
    for (const contrib of data.contributions) {
      if (!memberIds.has(contrib.userId)) {
        return NextResponse.json(
          { error: `User ${contrib.userId} is not a member of this circle` },
          { status: 400 }
        );
      }
      
      if (
        contrib.amount < MIN_CONTRIBUTION_AMOUNT ||
        contrib.amount > MAX_CONTRIBUTION_AMOUNT ||
        contrib.amount !== circle.contributionAmount
      ) {
        return NextResponse.json(
          {
            error: 'InvalidInput',
            message: 'All contribution amounts must exactly match the circle contribution amount',
            details: {
              expectedAmount: circle.contributionAmount,
              min: MIN_CONTRIBUTION_AMOUNT,
              max: MAX_CONTRIBUTION_AMOUNT,
            },
          },
          { status: 400 },
        );
      }
    }

    // Process all contributions in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdContributions = [];
      
      for (const contrib of data.contributions) {
        const newContribution = await tx.contribution.create({
          data: {
            circleId: id,
            userId: contrib.userId,
            amount: contrib.amount,
            round: circle.currentRound,
            status: 'COMPLETED',
          },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        });

        await tx.circleMember.update({
          where: { circleId_userId: { circleId: id, userId: contrib.userId } },
          data: { totalContributed: { increment: contrib.amount } },
        });

        createdContributions.push(newContribution);
      }

      // Count total contributions for this round
      const roundContribCount = await tx.contribution.count({
        where: { circleId: id, round: circle.currentRound },
      });

      const memberCount = await tx.circleMember.count({ where: { circleId: id } });

      return {
        contributions: createdContributions,
        totalContributedThisRound: roundContribCount,
        totalMembers: memberCount,
      };
    });

    // Post-transaction: send reminder emails to members who haven't contributed yet
    const allMembers = await prisma.circleMember.findMany({
      where: { circleId: id },
      include: { user: { select: { email: true, firstName: true } } },
    });
    
    const contributedThisRound = await prisma.contribution.findMany({
      where: { circleId: id, round: circle.currentRound },
      select: { userId: true },
    });
    
    const contributedIds = new Set(contributedThisRound.map((c: { userId: string }) => c.userId));

    for (const m of allMembers) {
      if (!contributedIds.has(m.userId)) {
        await sendContributionReminder(m.user.email, m.user.firstName, circle.contributionAmount, circle.name);
      }
    }

    // Check if round is complete and send payout alert
    if (result.totalContributedThisRound >= result.totalMembers) {
      const payoutMember = await prisma.circleMember.findFirst({
        where: { circleId: id, rotationOrder: circle.currentRound },
        include: { user: { select: { email: true, firstName: true } } },
      });
      
      if (payoutMember) {
        const payoutAmount = circle.contributionAmount * result.totalMembers;
        await sendPayoutAlert(payoutMember.user.email, payoutMember.user.firstName, payoutAmount);
      }
    }

    // Bust detail cache
    cacheInvalidatePrefix(`circles:detail:${id}`);

    logger.info('Batch contribution successful', { 
      circleId: id, 
      count: result.contributions.length,
      organizerId: payload.userId 
    });

    return NextResponse.json({ 
      success: true, 
      contributions: result.contributions,
      count: result.contributions.length,
      totalContributedThisRound: result.totalContributedThisRound,
      totalMembers: result.totalMembers
    }, { status: 201 });
  } catch (err) {
    logger.error('Batch contribute error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
