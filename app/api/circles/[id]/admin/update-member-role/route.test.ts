import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { POST } from './route';
import { prisma } from '@/lib/prisma';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    circle: {
      findUnique: vi.fn(),
    },
    circleMember: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  verifyToken: vi.fn(),
  extractToken: vi.fn(),
}));

vi.mock('@/lib/api-helpers', () => ({
  applyRateLimit: vi.fn(),
  validateBody: vi.fn(),
  validateId: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createChildLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN_ID   = 'admin-user-id';
const MEMBER_ID  = 'member-user-id';
const CIRCLE_ID  = 'circle-id-1';
const CM_ID      = 'circle-member-record-id';

const baseCircle = {
  id: CIRCLE_ID,
  organizerId: ADMIN_ID,
  name: 'Test Ajo Circle',
  status: 'ACTIVE',
};

const baseMember = {
  id: CM_ID,
  circleId: CIRCLE_ID,
  userId: MEMBER_ID,
  status: 'ACTIVE',
  rotationOrder: 2,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupMocks({
  userId        = ADMIN_ID,
  hasToken      = true,
  tokenValid    = true,
  circle        = baseCircle as typeof baseCircle | null,
  member        = baseMember as typeof baseMember | null,
  bodyStatus    = 'INACTIVE',
}: {
  userId?:     string;
  hasToken?:   boolean;
  tokenValid?: boolean;
  circle?:     typeof baseCircle | null;
  member?:     typeof baseMember | null;
  bodyStatus?: string;
} = {}) {
  const { verifyToken, extractToken } = await import('@/lib/auth');
  const { applyRateLimit, validateBody, validateId } = await import('@/lib/api-helpers');

  (extractToken as ReturnType<typeof vi.fn>).mockReturnValue(hasToken ? 'mock-token' : null);
  (verifyToken  as ReturnType<typeof vi.fn>).mockReturnValue(
    tokenValid ? { userId, type: 'user', scopes: ['user:base'] } : null,
  );
  (applyRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (validateId   as ReturnType<typeof vi.fn>).mockReturnValue(null);
  (validateBody as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    data: { memberId: CM_ID, status: bodyStatus },
  });

  (prisma.circle.findUnique      as ReturnType<typeof vi.fn>).mockResolvedValue(circle);
  (prisma.circleMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(member);
  (prisma.circleMember.update    as ReturnType<typeof vi.fn>).mockResolvedValue({
    ...baseMember,
    status: bodyStatus,
  });
}

function makeRequest(body: object = { memberId: CM_ID, status: 'INACTIVE' }) {
  return new NextRequest(
    `http://localhost/api/circles/${CIRCLE_ID}/admin/update-member-role`,
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer mock-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
}

const resolvedParams = (id = CIRCLE_ID) => ({ params: Promise.resolve({ id }) });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/circles/[id]/admin/update-member-role', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // Happy-path: admin can perform all valid role transitions
  // ─────────────────────────────────────────────────────────────────────────

  it('admin (organizer) can deactivate a member (ACTIVE → INACTIVE)', async () => {
    await setupMocks({ bodyStatus: 'INACTIVE' });

    const res  = await POST(makeRequest({ memberId: CM_ID, status: 'INACTIVE' }), resolvedParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('INACTIVE');
    expect(prisma.circleMember.update).toHaveBeenCalledWith({
      where: { id: CM_ID },
      data:  { status: 'INACTIVE' },
    });
  });

  it('admin can suspend a member (ACTIVE → SUSPENDED)', async () => {
    await setupMocks({ bodyStatus: 'SUSPENDED' });

    const res  = await POST(makeRequest({ memberId: CM_ID, status: 'SUSPENDED' }), resolvedParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.circleMember.update).toHaveBeenCalledWith({
      where: { id: CM_ID },
      data:  { status: 'SUSPENDED' },
    });
  });

  it('admin can reactivate a member (INACTIVE → ACTIVE)', async () => {
    const inactiveMember = { ...baseMember, status: 'INACTIVE' };
    await setupMocks({ member: inactiveMember, bodyStatus: 'ACTIVE' });

    const res  = await POST(makeRequest({ memberId: CM_ID, status: 'ACTIVE' }), resolvedParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.circleMember.update).toHaveBeenCalledWith({
      where: { id: CM_ID },
      data:  { status: 'ACTIVE' },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Access-denial: non-admin users must be rejected
  // ─────────────────────────────────────────────────────────────────────────

  it('regular member is denied with 403 — database is NOT touched', async () => {
    // MEMBER_ID is not the organizer
    await setupMocks({ userId: MEMBER_ID });

    const res  = await POST(makeRequest(), resolvedParams());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/only the organizer/i);
    // Critical: the DB update must never be called for unauthorised requests
    expect(prisma.circleMember.update).not.toHaveBeenCalled();
  });

  it('a completely unrelated user is denied with 403', async () => {
    await setupMocks({ userId: 'random-stranger-id' });

    const res = await POST(makeRequest(), resolvedParams());

    expect(res.status).toBe(403);
    expect(prisma.circleMember.update).not.toHaveBeenCalled();
  });

  it('a circle member cannot change another member\'s role (403)', async () => {
    const anotherMemberId = 'another-circle-member-id';
    await setupMocks({ userId: anotherMemberId });

    const res  = await POST(makeRequest({ memberId: CM_ID, status: 'SUSPENDED' }), resolvedParams());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBeTruthy();
    expect(prisma.circleMember.update).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Authentication guards
  // ─────────────────────────────────────────────────────────────────────────

  it('returns 401 when no Authorization header is provided', async () => {
    const { extractToken } = await import('@/lib/auth');
    (extractToken as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const request = new NextRequest(
      `http://localhost/api/circles/${CIRCLE_ID}/admin/update-member-role`,
      { method: 'POST', body: JSON.stringify({ memberId: CM_ID, status: 'INACTIVE' }) },
    );

    const res  = await POST(request, resolvedParams());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(prisma.circleMember.update).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is expired or tampered', async () => {
    const { verifyToken, extractToken } = await import('@/lib/auth');
    const { applyRateLimit } = await import('@/lib/api-helpers');

    (extractToken as ReturnType<typeof vi.fn>).mockReturnValue('tampered-token');
    (verifyToken  as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (applyRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res  = await POST(makeRequest(), resolvedParams());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Invalid or expired token');
    expect(prisma.circleMember.update).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Resource-not-found guards
  // ─────────────────────────────────────────────────────────────────────────

  it('returns 404 when the circle does not exist', async () => {
    await setupMocks({ circle: null });

    const res  = await POST(makeRequest(), resolvedParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Circle not found');
    expect(prisma.circleMember.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the target member record does not exist', async () => {
    await setupMocks({ member: null });

    const res  = await POST(makeRequest(), resolvedParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Member not found');
    expect(prisma.circleMember.update).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Business-rule guards
  // ─────────────────────────────────────────────────────────────────────────

  it('prevents admin from modifying their own organizer membership record', async () => {
    // The targeted circle-member record belongs to the organizer themselves
    const organizerMemberRecord = { ...baseMember, userId: ADMIN_ID };
    await setupMocks({ member: organizerMemberRecord });

    const res  = await POST(makeRequest({ memberId: CM_ID, status: 'INACTIVE' }), resolvedParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/organizer/i);
    expect(prisma.circleMember.update).not.toHaveBeenCalled();
  });

  it('returns 400 when the member belongs to a different circle', async () => {
    const wrongCircleMember = { ...baseMember, circleId: 'completely-different-circle' };
    await setupMocks({ member: wrongCircleMember });

    const res  = await POST(makeRequest(), resolvedParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/belong to this circle/i);
    expect(prisma.circleMember.update).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Rate-limiting
  // ─────────────────────────────────────────────────────────────────────────

  it('returns 429 when the rate limit is exceeded', async () => {
    const { verifyToken, extractToken } = await import('@/lib/auth');
    const { applyRateLimit } = await import('@/lib/api-helpers');

    (extractToken as ReturnType<typeof vi.fn>).mockReturnValue('valid-token');
    (verifyToken  as ReturnType<typeof vi.fn>).mockReturnValue({ userId: ADMIN_ID });
    (applyRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: 'Too Many Requests' }, { status: 429 }),
    );

    const res = await POST(makeRequest(), resolvedParams());

    expect(res.status).toBe(429);
    expect(prisma.circleMember.update).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Database-integrity assertion
  // ─────────────────────────────────────────────────────────────────────────

  it('calls circleMember.update exactly once with correct args — no side effects', async () => {
    await setupMocks({ bodyStatus: 'SUSPENDED' });

    await POST(makeRequest({ memberId: CM_ID, status: 'SUSPENDED' }), resolvedParams());

    expect(prisma.circleMember.update).toHaveBeenCalledTimes(1);
    expect(prisma.circleMember.update).toHaveBeenCalledWith({
      where: { id: CM_ID },
      data:  { status: 'SUSPENDED' },
    });
    // Circle table must not be touched
    expect(prisma.circle.findUnique).toHaveBeenCalledTimes(1);
  });
});
