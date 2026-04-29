import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    circle: {
      findUnique: jest.fn(),
    },
    circleMember: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  extractToken: jest.fn(),
  verifyToken: jest.fn(),
}));

jest.mock('@/lib/api-helpers', () => ({
  applyRateLimit: jest.fn(),
  validateBody: jest.fn(async (request: NextRequest) => {
    const body = await request.json();
    return { data: body, error: null };
  }),
  validateId: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: {
    sensitive: {},
  },
}));

jest.mock('@/lib/logger', () => ({
  createChildLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

const { POST } = require('@/app/api/circles/[id]/admin/update-member-role/route');
const { extractToken, verifyToken } = require('@/lib/auth');
const { applyRateLimit, validateId } = require('@/lib/api-helpers');

const ADMIN_ID = 'admin-user-id';
const REGULAR_USER_ID = 'regular-user-id';
const TARGET_USER_ID = 'target-user-id';
const CIRCLE_ID = 'circle-id-1';
const MEMBER_RECORD_ID = 'circle-member-record-id';

const baseCircle = {
  id: CIRCLE_ID,
  organizerId: ADMIN_ID,
  name: 'Test Ajo Circle',
  status: 'ACTIVE',
};

const baseMember = {
  id: MEMBER_RECORD_ID,
  circleId: CIRCLE_ID,
  userId: TARGET_USER_ID,
  status: 'ACTIVE',
  rotationOrder: 2,
};

function makeRequest(status = 'SUSPENDED') {
  return new NextRequest(`http://localhost/api/circles/${CIRCLE_ID}/admin/update-member-role`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer valid-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ memberId: MEMBER_RECORD_ID, status }),
  });
}

const routeParams = { params: Promise.resolve({ id: CIRCLE_ID }) };

describe('POST /api/circles/[id]/admin/update-member-role', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (extractToken as jest.Mock).mockReturnValue('valid-token');
    (verifyToken as jest.Mock).mockReturnValue({
      userId: ADMIN_ID,
      role: 'admin',
      type: 'user',
      scopes: ['user:base'],
    });
    (applyRateLimit as jest.Mock).mockResolvedValue(null);
    (validateId as jest.Mock).mockReturnValue(null);
  });

  it('denies regular user context before target-member lookup or update', async () => {
    (verifyToken as jest.Mock).mockReturnValue({
      userId: REGULAR_USER_ID,
      role: 'user',
      type: 'user',
      scopes: ['user:base'],
    });
    (prisma.circle.findUnique as jest.Mock).mockResolvedValue(baseCircle);

    const response = await POST(makeRequest(), routeParams);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/only the organizer|admin/i);
    expect(prisma.circleMember.findUnique).not.toHaveBeenCalled();
    expect(prisma.circleMember.update).not.toHaveBeenCalled();
  });

  it('allows admin organizer context to update the target member role', async () => {
    (prisma.circle.findUnique as jest.Mock).mockResolvedValue(baseCircle);
    (prisma.circleMember.findUnique as jest.Mock).mockResolvedValue(baseMember);
    (prisma.circleMember.update as jest.Mock).mockResolvedValue({
      ...baseMember,
      status: 'SUSPENDED',
    });

    const response = await POST(makeRequest('SUSPENDED'), routeParams);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ memberId: MEMBER_RECORD_ID, status: 'SUSPENDED' });
    expect(prisma.circleMember.update).toHaveBeenCalledTimes(1);
    expect(prisma.circleMember.update).toHaveBeenCalledWith({
      where: { id: MEMBER_RECORD_ID },
      data: { status: 'SUSPENDED' },
    });
  });

  it('returns 401 for unauthenticated requests without updating member roles', async () => {
    (extractToken as jest.Mock).mockReturnValue(null);

    const response = await POST(makeRequest(), routeParams);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(prisma.circle.findUnique).not.toHaveBeenCalled();
    expect(prisma.circleMember.findUnique).not.toHaveBeenCalled();
    expect(prisma.circleMember.update).not.toHaveBeenCalled();
  });
});
