import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { CastVoteSchema } from '@/lib/validations/governance';
import type { CastVoteInput } from '@/lib/validations/governance';
import { RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'governance:vote', payload.userId);
  if (rateLimited) return rateLimited;

  const validated = await validateBody(request, CastVoteSchema);
  if (validated.error) return validated.error;
  const data = validated.data as CastVoteInput;

  try {
    const { id: circleId, proposalId } = await params;

    // Verify circle and membership
    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
      include: {
        members: { select: { userId: true } },
      },
    });

    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 });

    const isMember = circle.members.some((m: { userId: string }) => m.userId === payload.userId);
    const isOrganizer = circle.organizerId === payload.userId;

    if (!isMember && !isOrganizer) {
      return NextResponse.json({ error: 'Only circle members can vote' }, { status: 403 });
    }

    // Verify proposal exists and is active
    const proposal = await prisma.governanceProposal.findFirst({
      where: { id: proposalId, circleId },
    });

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (proposal.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Proposal is not active' }, { status: 400 });
    }

    if (new Date() > proposal.votingEndDate) {
      return NextResponse.json({ error: 'Voting period has ended' }, { status: 400 });
    }

    // Check if user already voted
    const existingVote = await prisma.governanceVote.findUnique({
      where: {
        proposalId_userId: {
          proposalId,
          userId: payload.userId,
        },
      },
    });

    if (existingVote) {
      return NextResponse.json({ error: 'You have already voted on this proposal' }, { status: 409 });
    }

    // Cast the vote
    const vote = await prisma.governanceVote.create({
      data: {
        proposalId,
        userId: payload.userId,
        voteChoice: data.voteChoice,
      },
    });

    // Check if quorum is met and update proposal status
    const totalVotes = await prisma.governanceVote.count({
      where: { proposalId },
    });
    const totalMembers = circle.members.length;
    const quorumPercentage = totalMembers > 0 ? (totalVotes / totalMembers) * 100 : 0;

    if (quorumPercentage >= proposal.requiredQuorum) {
      const yesVotes = await prisma.governanceVote.count({
        where: { proposalId, voteChoice: 'YES' },
      });
      const noVotes = await prisma.governanceVote.count({
        where: { proposalId, voteChoice: 'NO' },
      });

      // Simple majority among YES/NO votes determines outcome
      if (yesVotes > noVotes) {
        await prisma.governanceProposal.update({
          where: { id: proposalId },
          data: { status: 'PASSED' },
        });
      } else if (noVotes > yesVotes) {
        await prisma.governanceProposal.update({
          where: { id: proposalId },
          data: { status: 'REJECTED' },
        });
      }
      // If tied, remains ACTIVE until more votes break the tie
    }

    return NextResponse.json({ success: true, vote }, { status: 201 });
  } catch (err) {
    console.error('Cast vote error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
