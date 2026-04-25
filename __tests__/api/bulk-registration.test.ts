/**
 * Test suite for bulk user registration
 * Closes #593
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/register/bulk/route';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    verificationToken: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  hashPassword: jest.fn((password) => Promise.resolve(`hashed_${password}`)),
  validatePasswordStrength: jest.fn(() => ({ isValid: true, errors: [] })),
}));

jest.mock('@/lib/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api-helpers', () => ({
  validateBody: jest.fn(async (request, schema) => {
    const body = await request.json();
    try {
      const data = schema.parse(body);
      return { data, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { json: () => ({ error: err.message }), status: 400 },
      };
    }
  }),
  applyRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/logger', () => ({
  createChildLogger: jest.fn(() => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  })),
}));

describe('POST /api/auth/register/bulk - Bulk Registration (Issue #593)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully register multiple users at once', async () => {
    const users = [
      {
        email: 'user1@example.com',
        password: 'Password123!',
        firstName: 'User',
        lastName: 'One',
      },
      {
        email: 'user2@example.com',
        password: 'Password123!',
        firstName: 'User',
        lastName: 'Two',
      },
      {
        email: 'user3@example.com',
        password: 'Password123!',
        firstName: 'User',
        lastName: 'Three',
      },
    ];

    // Mock no existing users
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    // Mock transaction
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback({
        user: {
          createMany: jest.fn().mockResolvedValue({ count: 3 }),
          findMany: jest.fn().mockResolvedValue([
            { id: 'user-1', email: 'user1@example.com', firstName: 'User', lastName: 'One' },
            { id: 'user-2', email: 'user2@example.com', firstName: 'User', lastName: 'Two' },
            { id: 'user-3', email: 'user3@example.com', firstName: 'User', lastName: 'Three' },
          ]),
        },
        verificationToken: {
          createMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
      });
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register/bulk', {
      method: 'POST',
      body: JSON.stringify({ users }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.summary).toEqual({
      total: 3,
      successful: 3,
      failed: 0,
    });
    expect(data.results).toHaveLength(3);
    expect(data.results.every((r: any) => r.success)).toBe(true);
  });

  it('should return summary of successful and failed registrations', async () => {
    const users = [
      {
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      },
      {
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'Existing',
        lastName: 'User',
      },
    ];

    // Mock one existing user
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { email: 'existing@example.com' },
    ]);

    // Mock transaction for the new user
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback({
        user: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn().mockResolvedValue([
            { id: 'user-1', email: 'new@example.com', firstName: 'New', lastName: 'User' },
          ]),
        },
        verificationToken: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      });
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register/bulk', {
      method: 'POST',
      body: JSON.stringify({ users }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.summary).toEqual({
      total: 2,
      successful: 1,
      failed: 1,
    });

    const failedResult = data.results.find((r: any) => r.email === 'existing@example.com');
    expect(failedResult.success).toBe(false);
    expect(failedResult.error).toContain('already exists');

    const successResult = data.results.find((r: any) => r.email === 'new@example.com');
    expect(successResult.success).toBe(true);
    expect(successResult.userId).toBeDefined();
  });

  it('should use prisma.user.createMany for efficient insertion', async () => {
    const users = [
      {
        email: 'bulk1@example.com',
        password: 'Password123!',
        firstName: 'Bulk',
        lastName: 'One',
      },
      {
        email: 'bulk2@example.com',
        password: 'Password123!',
        firstName: 'Bulk',
        lastName: 'Two',
      },
    ];

    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const mockCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback({
        user: {
          createMany: mockCreateMany,
          findMany: jest.fn().mockResolvedValue([
            { id: 'user-1', email: 'bulk1@example.com', firstName: 'Bulk', lastName: 'One' },
            { id: 'user-2', email: 'bulk2@example.com', firstName: 'Bulk', lastName: 'Two' },
          ]),
        },
        verificationToken: {
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
      });
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register/bulk', {
      method: 'POST',
      body: JSON.stringify({ users }),
    });

    await POST(request);

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          email: 'bulk1@example.com',
          password: expect.stringContaining('hashed_'),
        }),
        expect.objectContaining({
          email: 'bulk2@example.com',
          password: expect.stringContaining('hashed_'),
        }),
      ]),
      skipDuplicates: true,
    });
  });

  it('should reject requests with more than 100 users', async () => {
    const users = Array.from({ length: 101 }, (_, i) => ({
      email: `user${i}@example.com`,
      password: 'Password123!',
      firstName: 'User',
      lastName: `${i}`,
    }));

    const request = new NextRequest('http://localhost:3000/api/auth/register/bulk', {
      method: 'POST',
      body: JSON.stringify({ users }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('should validate each user email format', async () => {
    const users = [
      {
        email: 'invalid-email',
        password: 'Password123!',
        firstName: 'Invalid',
        lastName: 'Email',
      },
    ];

    const request = new NextRequest('http://localhost:3000/api/auth/register/bulk', {
      method: 'POST',
      body: JSON.stringify({ users }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('should handle partial failures gracefully', async () => {
    const users = [
      {
        email: 'valid@example.com',
        password: 'Password123!',
        firstName: 'Valid',
        lastName: 'User',
      },
      {
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'Existing',
        lastName: 'User',
      },
    ];

    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { email: 'existing@example.com' },
    ]);

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback({
        user: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn().mockResolvedValue([
            { id: 'user-1', email: 'valid@example.com', firstName: 'Valid', lastName: 'User' },
          ]),
        },
        verificationToken: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      });
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register/bulk', {
      method: 'POST',
      body: JSON.stringify({ users }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.summary.successful).toBe(1);
    expect(data.summary.failed).toBe(1);
    expect(data.results).toHaveLength(2);
  });

  it('should require at least one user in the request', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/register/bulk', {
      method: 'POST',
      body: JSON.stringify({ users: [] }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});
