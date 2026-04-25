/**
 * Test suite for /api/circles pagination
 * Closes #586
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/circles/route';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    circle: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/redis', () => ({
  redisClient: {
    getCachedCircleList: jest.fn().mockResolvedValue(null),
    cacheCircleList: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/logger', () => ({
  createChildLogger: jest.fn(() => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  })),
}));

describe('GET /api/circles - Pagination (Issue #586)', () => {
  const mockUserId = 'test-user-id';
  let mockToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    mockToken = generateToken({ userId: mockUserId, email: 'test@example.com' });
  });

  it('should return paginated circles with default page=1 and limit=10', async () => {
    const mockCircles = Array.from({ length: 10 }, (_, i) => ({
      id: `circle-${i}`,
      name: `Circle ${i}`,
      description: 'Test circle',
      organizerId: mockUserId,
      contributionAmount: 100,
      contributionFrequencyDays: 7,
      maxRounds: 12,
      currentRound: 1,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      organizer: {
        id: mockUserId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      },
      members: [],
      contributions: [],
    }));

    (prisma.circle.count as jest.Mock).mockResolvedValue(25);
    (prisma.circle.findMany as jest.Mock).mockResolvedValue(mockCircles);

    const request = new NextRequest('http://localhost:3000/api/circles', {
      headers: { authorization: `Bearer ${mockToken}` },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(10);
    expect(data.meta).toEqual({
      total: 25,
      pages: 3,
      currentPage: 1,
    });
  });

  it('should accept page and limit query parameters', async () => {
    const mockCircles = Array.from({ length: 5 }, (_, i) => ({
      id: `circle-${i + 10}`,
      name: `Circle ${i + 10}`,
      description: 'Test circle',
      organizerId: mockUserId,
      contributionAmount: 100,
      contributionFrequencyDays: 7,
      maxRounds: 12,
      currentRound: 1,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      organizer: {
        id: mockUserId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      },
      members: [],
      contributions: [],
    }));

    (prisma.circle.count as jest.Mock).mockResolvedValue(25);
    (prisma.circle.findMany as jest.Mock).mockResolvedValue(mockCircles);

    const request = new NextRequest('http://localhost:3000/api/circles?page=3&limit=5', {
      headers: { authorization: `Bearer ${mockToken}` },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(5);
    expect(data.meta).toEqual({
      total: 25,
      pages: 5,
      currentPage: 3,
    });

    // Verify skip and take were calculated correctly
    expect(prisma.circle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10, // (page 3 - 1) * limit 5
        take: 5,
      })
    );
  });

  it('should return metadata including totalCount, currentPage, and totalPages', async () => {
    (prisma.circle.count as jest.Mock).mockResolvedValue(47);
    (prisma.circle.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/circles?page=2&limit=20', {
      headers: { authorization: `Bearer ${mockToken}` },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta).toEqual({
      total: 47,
      pages: 3, // Math.ceil(47 / 20)
      currentPage: 2,
    });
  });

  it('should handle page=0 by defaulting to page=1', async () => {
    (prisma.circle.count as jest.Mock).mockResolvedValue(10);
    (prisma.circle.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/circles?page=0', {
      headers: { authorization: `Bearer ${mockToken}` },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta.currentPage).toBe(1);
    expect(prisma.circle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
      })
    );
  });

  it('should cap limit at 100 to prevent excessive queries', async () => {
    (prisma.circle.count as jest.Mock).mockResolvedValue(200);
    (prisma.circle.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/circles?limit=500', {
      headers: { authorization: `Bearer ${mockToken}` },
    });

    const response = await GET(request);
    await response.json();

    expect(prisma.circle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100, // Capped at 100
      })
    );
  });

  it('should handle negative page numbers by defaulting to page=1', async () => {
    (prisma.circle.count as jest.Mock).mockResolvedValue(10);
    (prisma.circle.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/circles?page=-5', {
      headers: { authorization: `Bearer ${mockToken}` },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta.currentPage).toBe(1);
  });

  it('should handle invalid limit by defaulting to 10', async () => {
    (prisma.circle.count as jest.Mock).mockResolvedValue(10);
    (prisma.circle.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/circles?limit=invalid', {
      headers: { authorization: `Bearer ${mockToken}` },
    });

    const response = await GET(request);
    await response.json();

    expect(prisma.circle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
      })
    );
  });

  it('should return empty array when page exceeds total pages', async () => {
    (prisma.circle.count as jest.Mock).mockResolvedValue(10);
    (prisma.circle.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/circles?page=100&limit=10', {
      headers: { authorization: `Bearer ${mockToken}` },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([]);
    expect(data.meta).toEqual({
      total: 10,
      pages: 1,
      currentPage: 100,
    });
  });

  it('should return 401 when no authorization token is provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/circles');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });
});
