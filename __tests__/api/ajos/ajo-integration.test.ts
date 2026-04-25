/**
 * Integration tests for Ajo API
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

// Import the handlers AFTER mocks are registered
import { GET, POST } from '@/app/api/ajos/route';

// ─── helpers ────────────────────────────────────────────────────────────────

function getAjos(authHeader?: string) {
  const req = makeRequest('GET', 'http://localhost/api/ajos', {
    authHeader,
  });
  return GET(req as any);
}

function postAjos(body: unknown, authHeader?: string) {
  const req = makeRequest('POST', 'http://localhost/api/ajos', {
    body,
    authHeader,
  });
  return POST(req as any);
}

// ─── GET /api/ajos ──────────────────────────────────────────────────────────

describe('GET /api/ajos', () => {
  it('should return 200 with an array of Ajo groups', async () => {
    prismaMock.circle.findMany.mockResolvedValue([
      {
        ...FIXTURE_AJO,
        id: 'ajo-1',
        name: 'Ajo Group 1',
      },
      {
        ...FIXTURE_AJO,
        id: 'ajo-2',
        name: 'Ajo Group 2',
      },
    ]);

    const res = await getAjos(ALICE_AUTH);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.length).toBe(2);
    expect(body[0].name).toBe('Ajo Group 1');
  });

  it('should return 401 when unauthenticated', async () => {
    const res = await getAjos();
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/ajos ──────────────────────────────────────────────────────────

describe('POST /api/ajos', () => {
  it('should prevent unauthenticated creation', async () => {
    const res = await postAjos({ name: 'Test' });
    expect(res.status).toBe(401); // Unauthorized
  });

  it('should return 201 when creation is successful', async () => {
    const ajoData = {
      name: 'New Ajo',
      description: 'A new Ajo group',
      txHash: 'stellar-transaction-hash-here-12345',
    };

    prismaMock.circle.create.mockResolvedValue({
      id: 'new-ajo-id',
      ...ajoData,
      organizerId: FIXTURE_USER.id,
      status: 'PENDING',
      createdAt: new Date(),
    });

    const res = await postAjos(ajoData, ALICE_AUTH);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.ajo.name).toBe('New Ajo');
  });

  it('should return 400 when validation fails (missing txHash)', async () => {
    const res = await postAjos({ name: 'New Ajo' }, ALICE_AUTH);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
