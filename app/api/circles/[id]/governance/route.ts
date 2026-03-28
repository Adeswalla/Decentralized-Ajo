import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { CreateProposalSchema } from '@/lib/validations/governance';
import type { CreateProposalInput } from '@/lib/validations/governance';
import { RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'governance:get', payload.userId);
  if (rateLimited) return rateLimited;

  try {
    const { id: circleId } = await params;

    // Verify circle exists and user has access
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch proposals with vote counts
    const proposals = await prisma.governanceProposal.findMany({
      where: { circleId },
      include: {
        votes: {
          select: {
            id: true,
            userId: true,
            voteChoice: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add computed fields
    const totalMembers = circle.members.length;
    const enrichedProposals = proposals.map((proposal: typeof proposals[number]) => {
      const yesVotes = proposal.votes.filter((v: { voteChoice: string }) => v.voteChoice === 'YES').length;
      const noVotes = proposal.votes.filter((v: { voteChoice: string }) => v.voteChoice === 'NO').length;
      const abstainVotes = proposal.votes.filter((v: { voteChoice: string }) => v.voteChoice === 'ABSTAIN').length;
      const userVote = proposal.votes.find((v: { userId: string }) => v.userId === payload.userId);

      return {
        ...proposal,
        yesVotes,
        noVotes,
        abstainVotes,
        totalVotes: proposal.votes.length,
        totalMembers,
        userVote: userVote ? userVote.voteChoice : null,
        quorumPercentage: totalMembers > 0
          ? Math.round((proposal.votes.length / totalMembers) * 100)
          : 0,
      };
    });

    return NextResponse.json({
      success: true,
      proposals: enrichedProposals,
      totalMembers,
    }, { status: 200 });
  } catch (err) {
    console.error('Get governance proposals error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'governance:create', payload.userId);
  if (rateLimited) return rateLimited;

  const validated = await validateBody(request, CreateProposalSchema);
  if (validated.error) return validated.error;
  const data = validated.data as CreateProposalInput;

  try {
    const { id: circleId } = await params;

    // Verify circle exists and user is a member
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
      return NextResponse.json({ error: 'Only circle members can create proposals' }, { status: 403 });
    }

    const proposal = await prisma.governanceProposal.create({
      data: {
        circleId,
        title: data.title,
        description: data.description,
        proposalType: data.proposalType,
        status: 'ACTIVE',
        votingStartDate: new Date(),
        votingEndDate: new Date(data.votingEndDate),
        requiredQuorum: data.requiredQuorum,
      },
      include: {
        votes: true,
      },
    });

    return NextResponse.json({ success: true, proposal }, { status: 201 });
  } catch (err) {
    console.error('Create governance proposal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
