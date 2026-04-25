/**
 * Integration tests for POST /api/ajos/:id/join
 *
 * Route handler is called directly (no HTTP server).
 * Prisma and rate-limit are mocked so no real DB is required.
 */

import '../mocks/prisma';
import { prismaMock } from '../mocks/prisma';
import { makeRequest } from '../helpers';
import {
  FIXTURE_AJO_FULL,
  FIXTURE_PARTICIPATION,
  FIXTURE_USER,
  FIXTURE_USER_2,
  ALICE_AUTH,
  BOB_AUTH,
} from '../fixtures';

jest.mock('@/lib/rate-limit', () => ({
  ...jest.requireActual('@/lib/rate-limit'),
  checkRateLimit: jest.fn().mockReturnValue(null),
}));

import { POST } from '@/app/api/ajos/[id]/join/route';

// ─── helpers ────────────────────────────────────────────────────────────────

function postJoin(ajoId: string, authHeader?: string) {
  const req = makeRequest('POST', `http://localhost/api/ajos/${ajoId}/join`, {
    authHeader,
  });
  return POST(req as any, { params: Promise.resolve({ id: ajoId }) });
}

// ─── POST /api/ajos/:id/join ─────────────────────────────────────────────────

describe('POST /api/ajos/:id/join', () => {
  // ── Auth guard ─────────────────────────────────────────────────────────────

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await postJoin(FIXTURE_AJO_FULL.id);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('returns 401 when the token is invalid', async () => {
    const res = await postJoin(FIXTURE_AJO_FULL.id, 'Bearer bad.token');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid or expired/i);
  });

  // ── Not found ──────────────────────────────────────────────────────────────

  it('returns 404 when the Ajo group does not exist', async () => {
    prismaMock.circle.findUnique.mockResolvedValue(null);

    const res = await postJoin('non-existent-id', BOB_AUTH);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  // ── Status guard ───────────────────────────────────────────────────────────

  it('returns 403 when the Ajo group is COMPLETED', async () => {
    prismaMock.circle.findUnique.mockResolvedValue({
      ...FIXTURE_AJO_FULL,
      status: 'COMPLETED',
    });

    const res = await postJoin(FIXTURE_AJO_FULL.id, BOB_AUTH);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not accepting new participants/i);
  });

  it('returns 403 when the Ajo group is CANCELLED', async () => {
    prismaMock.circle.findUnique.mockResolvedValue({
      ...FIXTURE_AJO_FULL,
      status: 'CANCELLED',
    });

    const res = await postJoin(FIXTURE_AJO_FULL.id, BOB_AUTH);
    expect(res.status).toBe(403);
  });

  // ── Duplicate guard ────────────────────────────────────────────────────────

  it('returns 409 when the user is already participating', async () => {
    prismaMock.circle.findUnique.mockResolvedValue(FIXTURE_AJO_FULL);
    prismaMock.userAjoParticipation.findUnique.mockResolvedValue(FIXTURE_PARTICIPATION);

    const res = await postJoin(FIXTURE_AJO_FULL.id, BOB_AUTH);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already participating/i);
    expect(body.participation).toBeDefined();
  });

  // ── Member cap ─────────────────────────────────────────────────────────────

  it('returns 403 when the Ajo group is at full capacity', async () => {
    prismaMock.circle.findUnique.mockResolvedValue({
      ...FIXTURE_AJO_FULL,
      maxRounds: 2,
      _count: { ajoParticipants: 2 }, // already at cap
    });
    prismaMock.userAjoParticipation.findUnique.mockResolvedValue(null);

    const res = await postJoin(FIXTURE_AJO_FULL.id, BOB_AUTH);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/maximum number of participants/i);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('creates a PENDING participation record and returns 201', async () => {
    prismaMock.circle.findUnique.mockResolvedValue(FIXTURE_AJO_FULL);
    prismaMock.userAjoParticipation.findUnique.mockResolvedValue(null);
    prismaMock.userAjoParticipation.create.mockResolvedValue(FIXTURE_PARTICIPATION);
    prismaMock.notification.create.mockResolvedValue({});

    const res = await postJoin(FIXTURE_AJO_FULL.id, BOB_AUTH);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.participation).toMatchObject({
      userId: FIXTURE_USER_2.id,
      ajoId: FIXTURE_AJO_FULL.id,
      status: 'PENDING',
    });
  });

  it('notifies the organizer after a successful join', async () => {
    prismaMock.circle.findUnique.mockResolvedValue(FIXTURE_AJO_FULL);
    prismaMock.userAjoParticipation.findUnique.mockResolvedValue(null);
    prismaMock.userAjoParticipation.create.mockResolvedValue(FIXTURE_PARTICIPATION);
    prismaMock.notification.create.mockResolvedValue({});

    await postJoin(FIXTURE_AJO_FULL.id, BOB_AUTH);

    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: FIXTURE_USER.id, // organizer
          type: 'MEMBER_JOINED',
          circleId: FIXTURE_AJO_FULL.id,
        }),
      }),
    );
  });

  it('allows joining a PENDING status Ajo group', async () => {
    prismaMock.circle.findUnique.mockResolvedValue({
      ...FIXTURE_AJO_FULL,
      status: 'PENDING',
    });
    prismaMock.userAjoParticipation.findUnique.mockResolvedValue(null);
    prismaMock.userAjoParticipation.create.mockResolvedValue({
      ...FIXTURE_PARTICIPATION,
      userId: FIXTURE_USER_2.id,
    });
    prismaMock.notification.create.mockResolvedValue({});

    const res = await postJoin(FIXTURE_AJO_FULL.id, BOB_AUTH);
    expect(res.status).toBe(201);
  });

  // ── DB error handling ──────────────────────────────────────────────────────

  it('returns 500 when the database throws unexpectedly', async () => {
    prismaMock.circle.findUnique.mockRejectedValue(new Error('Unexpected DB error'));

    const res = await postJoin(FIXTURE_AJO_FULL.id, BOB_AUTH);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/internal server error/i);
  });
});
