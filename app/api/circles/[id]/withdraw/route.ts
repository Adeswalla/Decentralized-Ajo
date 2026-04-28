import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { WithdrawalRequestSchema } from '@/lib/validations/withdrawal';
import { checkMultisigRequired } from '@/lib/services/multisig';
import { createChildLogger } from '@/server/config/logger';

const logger = createChildLogger('withdraw-api');

/**
 * POST /api/circles/[id]/withdraw
 * Request a withdrawal from the circle
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Authorize user
  const { payload, error } = await authorize(request);
  if (error) return error;

  try {
    // Parse and validate request body
    const body = await request.json();
    const data = WithdrawalRequestSchema.parse(body);

    // Get circle and member info
    const circle = await prisma.circle.findUnique({
      where: { id },
      include: {
        members: {
          where: { userId: payload.userId },
        },
      },
    });

    if (!circle) {
      return NextResponse.json(
        { error: 'Circle not found' },
        { status: 404 }
      );
    }

    const member = circle.members[0];
    if (!member) {
      return NextResponse.json(
        { error: 'You are not a member of this circle' },
        { status: 403 }
      );
    }

    // Check if member has sufficient balance
    const availableBalance = member.totalContributed - member.totalWithdrawn;
    if (data.amount > availableBalance) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          available: availableBalance,
          requested: data.amount,
        },
        { status: 400 }
      );
    }

    // Check for pending withdrawals
    const pendingWithdrawal = await prisma.withdrawal.findFirst({
      where: {
        circleId: id,
        userId: payload.userId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (pendingWithdrawal) {
      return NextResponse.json(
        { error: 'You already have a pending withdrawal request' },
        { status: 400 }
      );
    }

    // Check if multisig is required
    const multisigCheck = await checkMultisigRequired(id, data.amount);

    // Calculate penalty if applicable
    const penaltyPercentage = 10; // From WITHDRAWAL_PENALTY_PERCENT
    const penalty = (data.amount * penaltyPercentage) / 100;
    const finalAmount = data.amount - penalty;

    // Create withdrawal request
    const withdrawal = await prisma.withdrawal.create({
      data: {
        circleId: id,
        userId: payload.userId,
        amount: finalAmount,
        requestedAmount: data.amount,
        penaltyPercentage,
        reason: data.reason,
        status: multisigCheck.requiresMultisig ? 'PENDING' : 'APPROVED',
        approvedAt: multisigCheck.requiresMultisig ? null : new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    logger.info('Withdrawal request created', {
      withdrawalId: withdrawal.id,
      userId: payload.userId,
      circleId: id,
      amount: data.amount,
      requiresMultisig: multisigCheck.requiresMultisig,
    });

    return NextResponse.json({
      withdrawal,
      requiresMultisig: multisigCheck.requiresMultisig,
      requiredApprovals: multisigCheck.requiredApprovals,
      penalty,
      finalAmount,
    });
  } catch (err: any) {
    logger.error('Withdrawal request failed', { err, circleId: id });

    if (err.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: err.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process withdrawal request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/circles/[id]/withdraw
 * Get withdrawal requests for the circle
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Authorize user
  const { payload, error } = await authorize(request);
  if (error) return error;

  try {
    // Check if user is a member or organizer
    const circle = await prisma.circle.findUnique({
      where: { id },
      select: {
        organizerId: true,
        approvers: true,
      },
    });

    if (!circle) {
      return NextResponse.json(
        { error: 'Circle not found' },
        { status: 404 }
      );
    }

    const isOrganizer = circle.organizerId === payload.userId;
    const approvers = circle.approvers ? JSON.parse(circle.approvers) : [];
    const isApprover = isOrganizer || approvers.includes(payload.userId);

    // Get withdrawals based on user role
    const where = isApprover
      ? { circleId: id } // Approvers see all withdrawals
      : { circleId: id, userId: payload.userId }; // Members see only their own

    const withdrawals = await prisma.withdrawal.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ withdrawals });
  } catch (err: any) {
    logger.error('Failed to fetch withdrawals', { err, circleId: id });
    return NextResponse.json(
      { error: 'Failed to fetch withdrawals' },
      { status: 500 }
    );
  }
}
