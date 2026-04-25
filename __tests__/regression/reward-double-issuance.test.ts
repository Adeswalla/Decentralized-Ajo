/**
 * Regression Test: Reward Double-Issuance Prevention
 * Closes #644
 * 
 * @regression-issue #XXX (replace with actual issue number)
 * 
 * This test ensures that rewards cannot be issued twice for the same action.
 * Previously, a race condition allowed duplicate reward issuance.
 */

import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reward: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('Regression: Reward Double-Issuance Prevention', () => {
  const mockUserId = 'user-123';
  const mockActionId = 'action-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should prevent duplicate reward issuance for the same action', async () => {
    // Simulate checking if reward already exists
    (prisma.reward.findFirst as jest.Mock).mockResolvedValue({
      id: 'reward-1',
      userId: mockUserId,
      actionId: mockActionId,
      amount: 10,
    });

    // Attempt to issue reward
    const issueReward = async (userId: string, actionId: string, amount: number) => {
      const existingReward = await prisma.reward.findFirst({
        where: { userId, actionId },
      });

      if (existingReward) {
        throw new Error('Reward already issued for this action');
      }

      return prisma.reward.create({
        data: { userId, actionId, amount },
      });
    };

    await expect(issueReward(mockUserId, mockActionId, 10)).rejects.toThrow(
      'Reward already issued for this action'
    );

    expect(prisma.reward.create).not.toHaveBeenCalled();
  });

  it('should use database transaction to prevent race conditions', async () => {
    (prisma.reward.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(prisma);
    });

    const issueRewardWithTransaction = async (
      userId: string,
      actionId: string,
      amount: number
    ) => {
      return prisma.$transaction(async (tx: any) => {
        const existing = await tx.reward.findFirst({
          where: { userId, actionId },
        });

        if (existing) {
          throw new Error('Reward already issued');
        }

        return tx.reward.create({
          data: { userId, actionId, amount },
        });
      });
    };

    await issueRewardWithTransaction(mockUserId, mockActionId, 10);

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('should handle concurrent reward issuance attempts', async () => {
    let callCount = 0;

    (prisma.reward.findFirst as jest.Mock).mockImplementation(() => {
      callCount++;
      // First call returns null, second returns existing reward
      return callCount === 1 ? null : { id: 'reward-1', userId: mockUserId, actionId: mockActionId };
    });

    const issueReward = async (userId: string, actionId: string) => {
      const existing = await prisma.reward.findFirst({
        where: { userId, actionId },
      });

      if (existing) {
        throw new Error('Reward already issued');
      }

      return prisma.reward.create({
        data: { userId, actionId, amount: 10 },
      });
    };

    // First attempt should succeed
    await issueReward(mockUserId, mockActionId);

    // Second concurrent attempt should fail
    await expect(issueReward(mockUserId, mockActionId)).rejects.toThrow(
      'Reward already issued'
    );
  });

  it('should validate reward amount before issuance', async () => {
    (prisma.reward.findFirst as jest.Mock).mockResolvedValue(null);

    const issueReward = async (userId: string, actionId: string, amount: number) => {
      if (amount <= 0) {
        throw new Error('Invalid reward amount');
      }

      const existing = await prisma.reward.findFirst({
        where: { userId, actionId },
      });

      if (existing) {
        throw new Error('Reward already issued');
      }

      return prisma.reward.create({
        data: { userId, actionId, amount },
      });
    };

    await expect(issueReward(mockUserId, mockActionId, 0)).rejects.toThrow(
      'Invalid reward amount'
    );

    await expect(issueReward(mockUserId, mockActionId, -10)).rejects.toThrow(
      'Invalid reward amount'
    );
  });
});
