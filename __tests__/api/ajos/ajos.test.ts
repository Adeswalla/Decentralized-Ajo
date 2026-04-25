/**
 * Integration tests for POST /api/ajos
 *
 * Route handler is called directly (no HTTP server).
 * Prisma and rate-limit are mocked so no real DB is required.
 */

import '../mocks/prisma';
import { prismaMock } from '../mocks/prisma';
import { makeRequest } from '../helpers';
import {
  FIXTURE_USER,
  FIXTURE_AJO,
  ALICE_AUTH,
} from '../fixtures';

// Mock rate-limit so it never blocks during tests
jest.mock('@/lib/rate-limit', () => ({
  ...jest.requireActual('@/lib/rate-limit'),
  checkRateLimit: jest.fn().mockReturnValue(null),
}));

// Import the handler AFTER mocks are registered
import { POST } from '@/app/api/ajos/route';

// ─── helpers ────────────────────────────────────────────────────────────────

function postAjos(body: unknown, authHeader?: string) {
  const req = makeRequest('POST', 'http://localhost/api/ajos', {
    body,
    authHeader,
  });
  // Cast to NextRequest — the handler only uses .json() and .headers
  return POST(req as any);
}

// ─── POST /api/ajos ──────────────────────────────────────────────────────────

describe('POST /api/ajos', () => {
  // ── Auth guard ─────────────────────────────────────────────────────────────

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await postAjos({ name: 'My Ajo' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('returns 401 when the token is invalid', async () => {
    const res = await postAjos({ name: 'My Ajo' }, 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid or expired/i);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it('returns 422 when name is missing', async () => {
    const res = await postAjos({}, ALICE_AUTH);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/validation failed/i);
    expect(body.details).toBeDefined();
  });

  it('returns 422 when name is too short (< 2 chars)', async () => {
    const res = await postAjos({ name: 'A' }, ALICE_AUTH);
    expect(res.status).toBe(422);
  });

  it('returns 422 when name exceeds 100 characters', async () => {
    const res = await postAjos({ name: 'A'.repeat(101) }, ALICE_AUTH);
    expect(res.status).toBe(422);
  });

  it('returns 422 when description exceeds 500 characters', async () => {
    const res = await postAjos(
      { name: 'Valid Name', description: 'D'.repeat(501) },
      ALICE_AUTH,
    );
    expect(res.status).toBe(422);
  });

  it('returns 422 when maxMembers is below minimum (< 2)', async () => {
    const res = await postAjos({ name: 'Valid Name', maxMembers: 1 }, ALICE_AUTH);
    expect(res.status).toBe(422);
  });

  it('returns 422 when maxMembers exceeds maximum (> 100)', async () => {
    const res = await postAjos({ name: 'Valid Name', maxMembers: 101 }, ALICE_AUTH);
    expect(res.status).toBe(422);
  });

  it('returns 400 when the request body is not valid JSON', async () => {
    const req = new Request('http://localhost/api/ajos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: ALICE_AUTH,
        'x-forwarded-for': '127.0.0.1',
      },
      body: 'not-json',
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('creates an Ajo group and returns 201 with the new record', async () => {
    const created = {
      id: FIXTURE_AJO.id,
      name: FIXTURE_AJO.name,
      description: FIXTURE_AJO.description,
      contractAddress: null,
      organizerId: FIXTURE_USER.id,
      maxRounds: 10,
      status: 'ACTIVE',
      createdAt: FIXTURE_AJO.createdAt,
    };
    prismaMock.circle.create.mockResolvedValue(created);

    const res = await postAjos(
      { name: 'Test Ajo Group', description: 'A test savings circle', maxMembers: 10 },
      ALICE_AUTH,
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.ajo).toMatchObject({
      id: FIXTURE_AJO.id,
      name: 'Test Ajo Group',
      organizerId: FIXTURE_USER.id,
      maxRounds: 10,
    });
  });

  it('uses default maxRounds of 12 when maxMembers is not provided', async () => {
    prismaMock.circle.create.mockResolvedValue({
      ...FIXTURE_AJO,
      maxRounds: 12,
    });

    const res = await postAjos({ name: 'Default Cap Ajo' }, ALICE_AUTH);
    expect(res.status).toBe(201);

    // Verify prisma was called with maxRounds: 12
    expect(prismaMock.circle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ maxRounds: 12 }),
      }),
    );
  });

  it('passes contractAddress through when provided', async () => {
    const contractAddress = '0xDeAdBeEf00000000000000000000000000000001';
    prismaMock.circle.create.mockResolvedValue({
      ...FIXTURE_AJO,
      contractAddress,
    });

    const res = await postAjos(
      { name: 'On-chain Ajo', contractAddress },
      ALICE_AUTH,
    );
    expect(res.status).toBe(201);
    expect(prismaMock.circle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contractAddress }),
      }),
    );
  });

  // ── DB error handling ──────────────────────────────────────────────────────

  it('returns 400 when the database throws during creation', async () => {
    prismaMock.circle.create.mockRejectedValue(new Error('DB connection lost'));

    const res = await postAjos({ name: 'Failing Ajo' }, ALICE_AUTH);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ajo group creation failed/i);
  });
});
