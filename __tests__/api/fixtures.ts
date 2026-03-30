/**
 * Test fixtures — seed data shapes used across API integration tests.
 * These mirror the Prisma model shapes returned by the mocked client.
 */

import { generateToken } from '@/lib/auth';

export const FIXTURE_USER = {
  id: 'user-fixture-001',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Test',
  walletAddress: null,
  password: 'hashed-password',
  verified: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

export const FIXTURE_USER_2 = {
  id: 'user-fixture-002',
  email: 'bob@example.com',
  firstName: 'Bob',
  lastName: 'Test',
  walletAddress: null,
  password: 'hashed-password',
  verified: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

export const FIXTURE_AJO = {
  id: 'ajo-fixture-001',
  name: 'Test Ajo Group',
  description: 'A test savings circle',
  contractAddress: null,
  organizerId: FIXTURE_USER.id,
  maxRounds: 10,
  contributionAmount: 0,
  contributionFrequencyDays: 7,
  currentRound: 1,
  status: 'ACTIVE' as const,
  contractDeployed: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

export const FIXTURE_AJO_FULL = {
  ...FIXTURE_AJO,
  _count: { ajoParticipants: 0 },
};

export const FIXTURE_PARTICIPATION = {
  id: 'participation-fixture-001',
  userId: FIXTURE_USER_2.id,
  ajoId: FIXTURE_AJO.id,
  status: 'PENDING' as const,
  onChainTxHash: null,
  confirmedAt: null,
  joinedAt: new Date('2024-01-02T00:00:00Z'),
  leftAt: null,
};

/** Generate a valid Bearer token for a fixture user. */
export function makeAuthHeader(userId: string, email: string): string {
  const token = generateToken({ userId, email });
  return `Bearer ${token}`;
}

export const ALICE_AUTH = makeAuthHeader(FIXTURE_USER.id, FIXTURE_USER.email);
export const BOB_AUTH = makeAuthHeader(FIXTURE_USER_2.id, FIXTURE_USER_2.email);
