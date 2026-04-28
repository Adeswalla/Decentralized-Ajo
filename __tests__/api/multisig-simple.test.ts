import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { prisma } from '@/lib/prisma';
import { checkMultisigRequired, processApproval, validateApprover, getApprovalStatus } from '@/lib/services/multisig';
import { TestDbHelper } from './db-helper';

describe('Multisig Service Layer Tests', () => {
  const dbHelper = new TestDbHelper();
  let circle: any;
  let user1: any;
  let user2: any;
  let user3: any;

  beforeAll(async () => {
    await dbHelper.cleanup();
  });

  afterAll(async () => {
    await dbHelper.disconnect();
  });

  beforeEach(async () => {
    await dbHelper.cleanup();

    // Create test users
    user1 = await prisma.user.create({
      data: {
        email: 'user1@test.com',
        address: 'addr1-' + Date.now(),
        password: 'hash',
      },
    });

    user2 = await prisma.user.create({
      data: {
        email: 'user2@test.com',
        address: 'addr2-' + Date.now(),
        password: 'hash',
      },
    });

    user3 = await prisma.user.create({
      data: {
        email: 'user3@test.com',
        address: 'addr3-' + Date.now(),
        password: 'hash',
      },
    });

    // Create circle with multisig enabled
    circle = await prisma.circle.create({
      data: {
        name: 'Test Circle',
        organizerId: user1.id,
        contributionAmount: 1000000,
        contributionFrequencyDays: 7,
        maxRounds: 12,
        multisigEnabled: true,
        multisigThreshold: 2000000, // 2M stroops
        requiredApprovals: 2,
        approvers: JSON.stringify([user2.id, user3.id]),
      },
    });
  });

  describe('checkMultisigRequired', () => {
    it('should return false for amounts below threshold', async () => {
      const result = await checkMultisigRequired(circle.id, 1000000);
      
      expect(result.requiresMultisig).toBe(false);
      expect(result.threshold).toBe(2000000);
    });

    it('should return true for amounts above threshold', async () => {
      const result = await checkMultisigRequired(circle.id, 5000000);
      
      expect(result.requiresMultisig).toBe(true);
      expect(result.threshold).toBe(2000000);
      expect(result.requiredApprovals).toBe(2);
      expect(result.approvers).toHaveLength(2);
    });

    it('should return false when multisig is disabled', async () => {
      await prisma.circle.update({
        where: { id: circle.id },
        data: { multisigEnabled: false },
      });

      const result = await checkMultisigRequired(circle.id, 10000000);
      
      expect(result.requiresMultisig).toBe(false);
    });
  });

  describe('validateApprover', () => {
    it('should return true for organizer', async () => {
      const isValid = await validateApprover(circle.id, user1.id);
      expect(isValid).toBe(true);
    });

    it('should return true for designated approver', async () => {
      const isValid = await validateApprover(circle.id, user2.id);
      expect(isValid).toBe(true);
    });

    it('should return false for non-approver', async () => {
      const nonApprover = await prisma.user.create({
        data: {
          email: 'nonapprover@test.com',
          address: 'addr-non-' + Date.now(),
          password: 'hash',
        },
      });

      const isValid = await validateApprover(circle.id, nonApprover.id);
      expect(isValid).toBe(false);
    });
  });

  describe('processApproval', () => {
    let withdrawal: any;

    beforeEach(async () => {
      // Create a pending withdrawal
      withdrawal = await prisma.withdrawal.create({
        data: {
          circleId: circle.id,
          userId: user1.id,
          amount: 4500000,
          requestedAmount: 5000000,
          status: 'PENDING',
        },
      });
    });

    it('should record approval', async () => {
      const result = await processApproval(
        withdrawal.id,
        user2.id,
        true,
        'Looks good'
      );

      expect(result.approval.approved).toBe(true);
      expect(result.approval.comment).toBe('Looks good');
      expect(result.status.approvedCount).toBe(1);
      expect(result.status.isApproved).toBe(false); // Needs 2 approvals
    });

    it('should auto-approve when threshold is met', async () => {
      // First approval
      await processApproval(withdrawal.id, user2.id, true);

      // Second approval
      const result = await processApproval(withdrawal.id, user3.id, true);

      expect(result.status.approvedCount).toBe(2);
      expect(result.status.isApproved).toBe(true);

      // Check withdrawal status
      const updatedWithdrawal = await prisma.withdrawal.findUnique({
        where: { id: withdrawal.id },
      });

      expect(updatedWithdrawal?.status).toBe('APPROVED');
      expect(updatedWithdrawal?.approvedAt).toBeTruthy();
    });

    it('should record rejection', async () => {
      const result = await processApproval(
        withdrawal.id,
        user2.id,
        false,
        'Insufficient documentation'
      );

      expect(result.approval.approved).toBe(false);
      expect(result.status.rejectedCount).toBe(1);
      expect(result.status.isApproved).toBe(false);
    });
  });

  describe('getApprovalStatus', () => {
    let withdrawal: any;

    beforeEach(async () => {
      withdrawal = await prisma.withdrawal.create({
        data: {
          circleId: circle.id,
          userId: user1.id,
          amount: 4500000,
          requestedAmount: 5000000,
          status: 'PENDING',
        },
      });
    });

    it('should return correct approval counts', async () => {
      // Add one approval
      await prisma.withdrawalApproval.create({
        data: {
          withdrawalId: withdrawal.id,
          approverId: user2.id,
          approved: true,
        },
      });

      const status = await getApprovalStatus(withdrawal.id);

      expect(status.approvedCount).toBe(1);
      expect(status.rejectedCount).toBe(0);
      expect(status.requiredApprovals).toBe(2);
      expect(status.isApproved).toBe(false);
    });

    it('should detect when approval threshold is met', async () => {
      // Add two approvals
      await prisma.withdrawalApproval.createMany({
        data: [
          {
            withdrawalId: withdrawal.id,
            approverId: user2.id,
            approved: true,
          },
          {
            withdrawalId: withdrawal.id,
            approverId: user3.id,
            approved: true,
          },
        ],
      });

      const status = await getApprovalStatus(withdrawal.id);

      expect(status.approvedCount).toBe(2);
      expect(status.isApproved).toBe(true);
    });
  });

  describe('Database Schema Validation', () => {
    it('should prevent duplicate approvals', async () => {
      const withdrawal = await prisma.withdrawal.create({
        data: {
          circleId: circle.id,
          userId: user1.id,
          amount: 4500000,
          requestedAmount: 5000000,
          status: 'PENDING',
        },
      });

      // First approval
      await prisma.withdrawalApproval.create({
        data: {
          withdrawalId: withdrawal.id,
          approverId: user2.id,
          approved: true,
        },
      });

      // Try to create duplicate approval
      await expect(
        prisma.withdrawalApproval.create({
          data: {
            withdrawalId: withdrawal.id,
            approverId: user2.id,
            approved: true,
          },
        })
      ).rejects.toThrow();
    });

    it('should cascade delete approvals when withdrawal is deleted', async () => {
      const withdrawal = await prisma.withdrawal.create({
        data: {
          circleId: circle.id,
          userId: user1.id,
          amount: 4500000,
          requestedAmount: 5000000,
          status: 'PENDING',
        },
      });

      await prisma.withdrawalApproval.create({
        data: {
          withdrawalId: withdrawal.id,
          approverId: user2.id,
          approved: true,
        },
      });

      // Delete withdrawal
      await prisma.withdrawal.delete({
        where: { id: withdrawal.id },
      });

      // Check that approval was also deleted
      const approvals = await prisma.withdrawalApproval.findMany({
        where: { withdrawalId: withdrawal.id },
      });

      expect(approvals).toHaveLength(0);
    });
  });
});
