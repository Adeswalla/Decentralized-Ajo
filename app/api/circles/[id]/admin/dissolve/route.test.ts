import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    circle: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    circleMember: {
      update: vi.fn(),
    },
    withdrawal: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    governanceProposal: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  verifyToken: vi.fn(),
  extractToken: vi.fn(),
}));

vi.mock('@/lib/api-helpers', () => ({
  applyRateLimit: vi.fn(),
  validateId: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  cacheInvalidatePrefix: vi.fn(),
}));

describe('POST /api/circles/[id]/admin/dissolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should dissolve circle and create refund withdrawals for all members', async () => {
    const mockCircle = {
      id: 'circle-1',
      organizerId: 'user-1',
      status: 'ACTIVE',
      name: 'Test Circle',
      members: [
        {
          id: 'member-1',
          userId: 'user-1',
          totalContributed: 1000,
          totalWithdrawn: 200,
          status: 'ACTIVE',
          user: { id: 'user-1', email: 'user1@test.com', firstName: 'User', lastName: 'One' },
        },
        {
          id: 'member-2',
          userId: 'user-2',
          totalContributed: 1000,
          totalWithdrawn: 0,
          status: 'ACTIVE',
          user: { id: 'user-2', email: 'user2@test.com', firstName: 'User', lastName: 'Two' },
        },
      ],
    };

    const { verifyToken, extractToken } = await import('@/lib/auth');
    const { applyRateLimit, validateId } = await import('@/lib/api-helpers');

    (extractToken as any).mockReturnValue('valid-token');
    (verifyToken as any).mockReturnValue({ userId: 'user-1' });
    (applyRateLimit as any).mockResolvedValue(null);
    (validateId as any).mockReturnValue(null);
    (prisma.circle.findUnique as any).mockResolvedValue(mockCircle);

    // Mock transaction
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      return callback({
        withdrawal: {
          create: vi.fn().mockResolvedValue({ id: 'withdrawal-1' }),
        },
        circleMember: {
          update: vi.fn(),
        },
        circle: {
          update: vi.fn(),
        },
        governanceProposal: {
          update: vi.fn(),
        },
        notification: {
          create: vi.fn(),
        },
      });
    });

    const request = new NextRequest('http://localhost/api/circles/circle-1/admin/dissolve', {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'circle-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.remainingPool).toBe(1800); // 800 + 1000
    expect(data.data.refunds).toHaveLength(2);
  });

  it('should reject dissolution if circle is already dissolved', async () => {
    const mockCircle = {
      id: 'circle-1',
      organizerId: 'user-1',
      status: 'DISSOLVED',
      members: [],
    };

    const { verifyToken, extractToken } = await import('@/lib/auth');
    const { applyRateLimit, validateId } = await import('@/lib/api-helpers');

    (extractToken as any).mockReturnValue('valid-token');
    (verifyToken as any).mockReturnValue({ userId: 'user-1' });
    (applyRateLimit as any).mockResolvedValue(null);
    (validateId as any).mockReturnValue(null);
    (prisma.circle.findUnique as any).mockResolvedValue(mockCircle);

    const request = new NextRequest('http://localhost/api/circles/circle-1/admin/dissolve', {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'circle-1' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Circle is already dissolved');
  });

  it('should reject dissolution if user is not organizer and no unanimous vote', async () => {
    const mockCircle = {
      id: 'circle-1',
      organizerId: 'user-1',
      status: 'ACTIVE',
      members: [
        { userId: 'user-2', status: 'ACTIVE' },
      ],
    };

    const { verifyToken, extractToken } = await import('@/lib/auth');
    const { applyRateLimit, validateId } = await import('@/lib/api-helpers');

    (extractToken as any).mockReturnValue('valid-token');
    (verifyToken as any).mockReturnValue({ userId: 'user-2' }); // Not organizer
    (applyRateLimit as any).mockResolvedValue(null);
    (validateId as any).mockReturnValue(null);
    (prisma.circle.findUnique as any).mockResolvedValue(mockCircle);

    const request = new NextRequest('http://localhost/api/circles/circle-1/admin/dissolve', {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'circle-1' }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Only the organizer or a unanimous vote');
  });

  it('should apply no penalty to dissolution refunds', async () => {
    const mockCircle = {
      id: 'circle-1',
      organizerId: 'user-1',
      status: 'ACTIVE',
      name: 'Test Circle',
      members: [
        {
          id: 'member-1',
          userId: 'user-1',
          totalContributed: 1000,
          totalWithdrawn: 0,
          status: 'ACTIVE',
          user: { id: 'user-1', email: 'user1@test.com', firstName: 'User', lastName: 'One' },
        },
      ],
    };

    const { verifyToken, extractToken } = await import('@/lib/auth');
    const { applyRateLimit, validateId } = await import('@/lib/api-helpers');

    (extractToken as any).mockReturnValue('valid-token');
    (verifyToken as any).mockReturnValue({ userId: 'user-1' });
    (applyRateLimit as any).mockResolvedValue(null);
    (validateId as any).mockReturnValue(null);
    (prisma.circle.findUnique as any).mockResolvedValue(mockCircle);

    let withdrawalData: any;
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      return callback({
        withdrawal: {
          create: vi.fn().mockImplementation((data) => {
            withdrawalData = data.data;
            return Promise.resolve({ id: 'withdrawal-1' });
          }),
        },
        circleMember: { update: vi.fn() },
        circle: { update: vi.fn() },
        governanceProposal: { update: vi.fn() },
        notification: { create: vi.fn() },
      });
    });

    const request = new NextRequest('http://localhost/api/circles/circle-1/admin/dissolve', {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
    });

    await POST(request, { params: Promise.resolve({ id: 'circle-1' }) });

    expect(withdrawalData.penaltyPercentage).toBe(0);
    expect(withdrawalData.amount).toBe(1000);
    expect(withdrawalData.requestedAmount).toBe(1000);
  });
});
