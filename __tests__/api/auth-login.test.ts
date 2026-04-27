import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  verifyPassword: jest.fn(),
  generateToken: jest.fn(() => 'jwt-token'),
  generateRefreshToken: jest.fn(async () => 'refresh-token'),
  REFRESH_TOKEN_COOKIE_NAME: 'refreshToken',
  getRefreshTokenExpiryDate: jest.fn(() => new Date('2099-01-01T00:00:00.000Z')),
  isSecureCookieEnvironment: jest.fn(() => false),
}));

jest.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: {
    auth: {},
  },
}));

jest.mock('@/lib/api-helpers', () => ({
  validateBody: jest.fn(async (request: NextRequest, schema: any) => {
    const body = await request.json();
    return { data: body, error: null };
  }),
  applyRateLimit: jest.fn().mockResolvedValue(null),
  errorResponse: jest.fn((request: NextRequest, payload: any, status: number) => {
    return new (require('next/server').NextResponse)(JSON.stringify(payload), { status });
  }),
}));

jest.mock('@/lib/logger', () => ({
  createChildLogger: jest.fn(() => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  })),
}));

const { POST } = require('@/app/api/auth/login/route');
const { verifyPassword, generateToken, generateRefreshToken } = require('@/lib/auth');

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches only essential authentication fields and returns a token on successful login', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      password: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      walletAddress: '0xabc',
      verified: true,
    });
    (verifyPassword as jest.Mock).mockResolvedValue(true);

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'Password123!' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      walletAddress: '0xabc',
    });
    expect(data.token).toBe('jwt-token');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        walletAddress: true,
        verified: true,
      },
    });

    expect(verifyPassword).toHaveBeenCalledWith('Password123!', 'hashed-password');
    expect(generateToken).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'test@example.com',
      walletAddress: '0xabc',
    });
    expect(generateRefreshToken).toHaveBeenCalledWith('user-123');
  });

  it('returns invalid credentials when the user is not found', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'missing@example.com', password: 'Password123!' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('invalid_credentials');
  });
});
