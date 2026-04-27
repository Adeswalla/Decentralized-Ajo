import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { validateBody, applyRateLimit, validateId } from '@/lib/api-helpers';
import { ContributeSchema, MIN_CONTRIBUTION_AMOUNT, MAX_CONTRIBUTION_AMOUNT } from '@/lib/validations/circle';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sendContributionReminder, sendPayoutAlert } from '@/lib/email';
import { createChildLogger } from '@/lib/logger';
import { cacheInvalidatePrefix } from '@/lib/cache';

const logger = createChildLogger({ service: 'api', route: '/api/circles/[id]/contribute' });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = await applyRateLimit(request, RATE_LIMITS.sensitive, 'circles:contribute', payload.userId);
  if (rateLimited) return rateLimited;

  const { data, error } = await validateBody(request, ContributeSchema);
  if (error) return error;

  try {
    const { id } = await params;
    const idError = validateId(request, id);
    if (idError) return idError;

    const circle = await prisma.circle.findUnique({ where: { id } });
    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 });

    if (
      data.amount < MIN_CONTRIBUTION_AMOUNT ||
      data.amount > MAX_CONTRIBUTION_AMOUNT ||
      data.amount !== circle.contributionAmount
    ) {
      return NextResponse.json(
        {
          error: 'InvalidInput',
          message: 'Contribution amount must exactly match the circle contribution amount',
          details: {
            expectedAmount: circle.contributionAmount,
            min: MIN_CONTRIBUTION_AMOUNT,
            max: MAX_CONTRIBUTION_AMOUNT,
          },
        },
        { status: 400 },
      );
    }

    const member = await prisma.circleMember.findUnique({
      where: { circleId_userId: { circleId: id, userId: payload.userId } },
    });

    if (!member) {
      return NextResponse.json({ error: 'You are not a member of this circle' }, { status: 403 });
    }

    // Wrap the contribution record creation and balance update in a single atomic
    // transaction so concurrent requests cannot produce an incorrect remaining balance.
    const { contribution, totalContributedThisRound, totalMembers } =
      await prisma.$transaction(async (tx) => {
        const newContribution = await tx.contribution.create({
          data: {
            circleId: id,
            userId: payload.userId,
            amount: data.amount,
            round: circle.currentRound,
            status: 'COMPLETED',
          },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        });

        await tx.circleMember.update({
          where: { circleId_userId: { circleId: id, userId: payload.userId } },
          data: { totalContributed: { increment: data.amount } },
        });

        // Count contributions for this round inside the transaction so the
        // number is consistent with the balance update above.
        const roundContribCount = await tx.contribution.count({
          where: { circleId: id, round: circle.currentRound },
        });

        const memberCount = await tx.circleMember.count({ where: { circleId: id } });

        return {
          contribution: newContribution,
          totalContributedThisRound: roundContribCount,
          totalMembers: memberCount,
        };
      });

    // Post-transaction: send reminder emails to members who haven't contributed yet.
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

    if (totalContributedThisRound >= totalMembers) {
      const payoutMember = await prisma.circleMember.findFirst({
        where: { circleId: id, rotationOrder: circle.currentRound },
        include: { user: { select: { email: true, firstName: true } } },
      });
      if (payoutMember) {
        const payoutAmount = circle.contributionAmount * totalMembers;
        await sendPayoutAlert(payoutMember.user.email, payoutMember.user.firstName, payoutAmount);
      }
    }

    // Bust detail cache so contribution totals are fresh
    cacheInvalidatePrefix(`circles:detail:${id}`);

    return NextResponse.json({ success: true, contribution }, { status: 201 });
  } catch (err) {
    logger.error('Contribute error', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
