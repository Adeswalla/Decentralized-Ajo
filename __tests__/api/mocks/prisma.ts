/**
 * Shared Prisma mock factory.
 * Import `prismaMock` in tests to control DB responses without a real database.
 *
 * Usage:
 *   import { prismaMock } from '../mocks/prisma';
 *   prismaMock.circle.create.mockResolvedValue(FIXTURE_AJO);
 */

// Auto-mock the prisma module so every test file gets the same mock instance
jest.mock('@/lib/prisma', () => ({
  prisma: {
    circle: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userAjoParticipation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}));

// Re-export the mock so tests can set return values
import { prisma } from '@/lib/prisma';

export const prismaMock = prisma as {
  circle: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
  };
  userAjoParticipation: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
  };
  notification: {
    create: jest.Mock;
  };
};
