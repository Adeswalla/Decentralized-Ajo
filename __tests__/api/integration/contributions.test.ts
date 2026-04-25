import { TestDbHelper } from '../db-helper';
import { makeRequest } from '../helpers';
import { generateToken } from '@/lib/auth';
import { POST as postContribute } from '@/app/api/circles/[id]/contribute/route';

jest.mock('@/lib/email', () => ({
  sendContributionReminder: jest.fn().mockResolvedValue(null),
  sendPayoutAlert: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn().mockReturnValue(null),
  RATE_LIMITS: { api: { windowMs: 1000, max: 100 } },
}));

const dbHelper = new TestDbHelper();
const prisma = dbHelper.getPrisma();

describe('Contributions API Integration Tests', () => {
  let testUser: any;
  let authHeader: string;
  let testCircle: any;
  const contributionAmount = 1000000;

  beforeEach(async () => {
    await dbHelper.cleanup();
    
    testUser = await prisma.user.create({
      data: { email: 'contributor@example.com', address: 'GAX...CONTRIB', firstName: 'Contributor' },
    });

    authHeader = `Bearer ${generateToken({ userId: testUser.id, email: testUser.email })}`;

    testCircle = await prisma.circle.create({
      data: {
        name: 'Contribution Circle',
        contributionAmount: contributionAmount,
        organizerId: testUser.id,
        status: 'ACTIVE',
        members: {
          create: { userId: testUser.id, rotationOrder: 1 },
        },
      },
    });
  });

  afterAll(async () => {
    await dbHelper.disconnect();
  });

  describe('POST /api/circles/[id]/contribute', () => {
    it('should contribute successfully', async () => {
      const contributeData = { amount: contributionAmount };
      const req = makeRequest('POST', `http://localhost/api/circles/${testCircle.id}/contribute`, {
        body: contributeData,
        authHeader,
      });

      const res = await postContribute(req as any, { params: Promise.resolve({ id: testCircle.id }) } as any);
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify contribution in DB
      const dbContribution = await prisma.contribution.findFirst({
        where: {
          circleId: testCircle.id,
          userId: testUser.id,
        },
      });
      expect(dbContribution).toBeTruthy();
      expect(dbContribution?.amount).toBe(contributionAmount);

      // Verify member updated
      const dbMember = await prisma.circleMember.findUnique({
        where: {
          circleId_userId: {
            circleId: testCircle.id,
            userId: testUser.id,
          },
        },
      });
      expect(dbMember?.totalContributed).toBe(contributionAmount);
    });

    it('should return 400 for incorrect amount', async () => {
      const req = makeRequest('POST', `http://localhost/api/circles/${testCircle.id}/contribute`, {
        body: { amount: contributionAmount + 1 },
        authHeader,
      });

      const res = await postContribute(req as any, { params: Promise.resolve({ id: testCircle.id }) } as any);
      expect(res.status).toBe(400);
    });

    it('should return 403 for non-member', async () => {
      const otherUser = await prisma.user.create({
        data: { email: 'outsider@example.com', address: 'GAX...OUTSIDER' },
      });
      const otherAuthHeader = `Bearer ${generateToken({ userId: otherUser.id, email: otherUser.email })}`;

      const req = makeRequest('POST', `http://localhost/api/circles/${testCircle.id}/contribute`, {
        body: { amount: contributionAmount },
        authHeader: otherAuthHeader,
      });

      const res = await postContribute(req as any, { params: Promise.resolve({ id: testCircle.id }) } as any);
      expect(res.status).toBe(403);
    });
  });
});
