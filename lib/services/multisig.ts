import { prisma } from '@/lib/prisma';
import { createChildLogger } from '@/server/config/logger';

const logger = createChildLogger('multisig-service');

export interface MultisigCheckResult {
  requiresMultisig: boolean;
  threshold: number;
  requiredApprovals: number;
  approvers: string[];
}

/**
 * Check if a withdrawal requires multisig approval
 */
export async function checkMultisigRequired(
  circleId: string,
  amount: number
): Promise<MultisigCheckResult> {
  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    select: {
      multisigEnabled: true,
      multisigThreshold: true,
      requiredApprovals: true,
      approvers: true,
    },
  });

  if (!circle) {
    throw new Error('Circle not found');
  }

  const requiresMultisig =
    circle.multisigEnabled && amount > circle.multisigThreshold;

  const approvers = circle.approvers ? JSON.parse(circle.approvers) : [];

  return {
    requiresMultisig,
    threshold: circle.multisigThreshold,
    requiredApprovals: circle.requiredApprovals,
    approvers,
  };
}

/**
 * Get approval status for a withdrawal
 */
export async function getApprovalStatus(withdrawalId: string) {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
    include: {
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
      circle: {
        select: {
          requiredApprovals: true,
          approvers: true,
        },
      },
    },
  });

  if (!withdrawal) {
    throw new Error('Withdrawal not found');
  }

  const approvedCount = withdrawal.approvals.filter((a) => a.approved).length;
  const rejectedCount = withdrawal.approvals.filter((a) => !a.approved).length;
  const isApproved = approvedCount >= withdrawal.circle.requiredApprovals;

  return {
    withdrawal,
    approvedCount,
    rejectedCount,
    requiredApprovals: withdrawal.circle.requiredApprovals,
    isApproved,
    approvals: withdrawal.approvals,
  };
}

/**
 * Process approval and auto-complete if threshold met
 */
export async function processApproval(
  withdrawalId: string,
  approverId: string,
  approved: boolean,
  comment?: string
) {
  // Create approval record
  const approval = await prisma.withdrawalApproval.create({
    data: {
      withdrawalId,
      approverId,
      approved,
      comment,
    },
  });

  logger.info('Withdrawal approval recorded', {
    withdrawalId,
    approverId,
    approved,
  });

  // Check if we have enough approvals
  const status = await getApprovalStatus(withdrawalId);

  if (status.isApproved && status.withdrawal.status === 'PENDING') {
    // Auto-approve the withdrawal
    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });

    logger.info('Withdrawal auto-approved after reaching threshold', {
      withdrawalId,
      approvedCount: status.approvedCount,
      requiredApprovals: status.requiredApprovals,
    });
  }

  return {
    approval,
    status,
  };
}

/**
 * Validate that user is an authorized approver
 */
export async function validateApprover(
  circleId: string,
  userId: string
): Promise<boolean> {
  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    select: {
      organizerId: true,
      approvers: true,
    },
  });

  if (!circle) {
    return false;
  }

  // Organizer is always an approver
  if (circle.organizerId === userId) {
    return true;
  }

  // Check if user is in approvers list
  const approvers = circle.approvers ? JSON.parse(circle.approvers) : [];
  return approvers.includes(userId);
}
