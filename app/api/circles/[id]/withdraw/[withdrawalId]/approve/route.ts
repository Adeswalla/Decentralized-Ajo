import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { WithdrawalApprovalSchema } from '@/lib/validations/withdrawal';
import { processApproval, validateApprover } from '@/lib/services/multisig';
import { createChildLogger } from '@/server/config/logger';

const logger = createChildLogger('withdrawal-approval-api');

/**
 * POST /api/circles/[id]/withdraw/[withdrawalId]/approve
 * Approve or reject a withdrawal request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; withdrawalId: string } }
) {
  const { id, withdrawalId } = params;

  // Authorize user
  const { payload, error } = await authorize(request);
  if (error) return error;

  try {
    // Parse and validate request body
    const body = await request.json();
    const data = WithdrawalApprovalSchema.parse(body);

    // Validate that withdrawal exists and belongs to this circle
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        circle: {
          select: {
            id: true,
            name: true,
            multisigEnabled: true,
            requiredApprovals: true,
          },
        },
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

    if (!withdrawal) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    if (withdrawal.circleId !== id) {
      return NextResponse.json(
        { error: 'Withdrawal does not belong to this circle' },
        { status: 400 }
      );
    }

    // Check if withdrawal is still pending
    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Withdrawal is already ${withdrawal.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Validate that user is an authorized approver
    const isApprover = await validateApprover(id, payload.userId);
    if (!isApprover) {
      return NextResponse.json(
        { error: 'You are not authorized to approve withdrawals for this circle' },
        { status: 403 }
      );
    }

    // Check if user already approved/rejected this withdrawal
    const existingApproval = await prisma.withdrawalApproval.findUnique({
      where: {
        withdrawalId_approverId: {
          withdrawalId,
          approverId: payload.userId,
        },
      },
    });

    if (existingApproval) {
      return NextResponse.json(
        { error: 'You have already voted on this withdrawal' },
        { status: 400 }
      );
    }

    // Process the approval
    const result = await processApproval(
      withdrawalId,
      payload.userId,
      data.approved,
      data.comment
    );

    logger.info('Withdrawal approval processed', {
      withdrawalId,
      approverId: payload.userId,
      approved: data.approved,
      approvedCount: result.status.approvedCount,
      requiredApprovals: result.status.requiredApprovals,
    });

    return NextResponse.json({
      approval: result.approval,
      status: {
        approvedCount: result.status.approvedCount,
        rejectedCount: result.status.rejectedCount,
        requiredApprovals: result.status.requiredApprovals,
        isApproved: result.status.isApproved,
      },
      withdrawal: {
        id: withdrawal.id,
        status: result.status.isApproved ? 'APPROVED' : withdrawal.status,
        amount: withdrawal.amount,
        user: withdrawal.user,
      },
    });
  } catch (err: any) {
    logger.error('Withdrawal approval failed', {
      err,
      circleId: id,
      withdrawalId,
    });

    if (err.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: err.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}
