import { TestDbHelper } from '../db-helper';
import { makeRequest } from '../helpers';
import { generateToken } from '@/lib/auth';
import { GET as getProposals, POST as postProposal } from '@/app/api/circles/[id]/governance/route';
import { POST as postVote } from '@/app/api/circles/[id]/governance/[proposalId]/vote/route';

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn().mockReturnValue(null),
  RATE_LIMITS: { api: { windowMs: 1000, max: 100 } },
}));

const dbHelper = new TestDbHelper();
const prisma = dbHelper.getPrisma();

describe('Governance API Integration Tests', () => {
  let testUser: any;
  let otherUser: any;
  let authHeader: string;
  let testCircle: any;

  beforeEach(async () => {
    await dbHelper.cleanup();
    
    testUser = await prisma.user.create({
      data: { email: 'admin@example.com', address: 'GAX...ADMIN', firstName: 'Admin' },
    });

    otherUser = await prisma.user.create({
      data: { email: 'user@example.com', address: 'GAX...USER', firstName: 'User' },
    });

    authHeader = `Bearer ${generateToken({ userId: testUser.id, email: testUser.email })}`;

    testCircle = await prisma.circle.create({
      data: {
        name: 'Governance Circle',
        contributionAmount: 100,
        organizerId: testUser.id,
        status: 'ACTIVE',
        members: {
          create: [
            { userId: testUser.id, rotationOrder: 1 },
            { userId: otherUser.id, rotationOrder: 2 },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await dbHelper.disconnect();
  });

  describe('POST /api/circles/[id]/governance', () => {
    it('should create a new proposal successfully', async () => {
      const proposalData = {
        title: 'New Rule Change',
        description: 'We should change the contribution amount.',
        proposalType: 'RULE_CHANGE',
        votingEndDate: new Date(Date.now() + 86400000).toISOString(),
        requiredQuorum: 50,
      };

      const req = makeRequest('POST', `http://localhost/api/circles/${testCircle.id}/governance`, {
        body: proposalData,
        authHeader,
      });

      const res = await postProposal(req as any, { params: Promise.resolve({ id: testCircle.id }) } as any);
      expect(res.status).toBe(201);
      
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.proposal.title).toBe(proposalData.title);

      // Verify in DB
      const dbProposal = await prisma.governanceProposal.findUnique({
        where: { id: body.proposal.id },
      });
      expect(dbProposal).toBeTruthy();
    });
  });

  describe('POST /api/circles/[id]/governance/[proposalId]/vote', () => {
    it('should cast a vote successfully', async () => {
      // Create an active proposal
      const proposal = await prisma.governanceProposal.create({
        data: {
          circleId: testCircle.id,
          title: 'Active Proposal',
          description: 'Vote on this!',
          proposalType: 'RULE_CHANGE',
          status: 'ACTIVE',
          votingStartDate: new Date(),
          votingEndDate: new Date(Date.now() + 86400000),
        },
      });

      const voteData = { voteChoice: 'YES' };
      const req = makeRequest('POST', `http://localhost/api/circles/${testCircle.id}/governance/${proposal.id}/vote`, {
        body: voteData,
        authHeader,
      });

      const res = await postVote(req as any, { params: Promise.resolve({ id: testCircle.id, proposalId: proposal.id }) } as any);
      expect(res.status).toBe(201);
      
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify vote in DB
      const dbVote = await prisma.governanceVote.findUnique({
        where: {
          proposalId_userId: {
            proposalId: proposal.id,
            userId: testUser.id,
          },
        },
      });
      expect(dbVote).toBeTruthy();
      expect(dbVote?.voteChoice).toBe('YES');
    });

    it('should return 400 for voting on inactive proposal', async () => {
      const proposal = await prisma.governanceProposal.create({
        data: {
          circleId: testCircle.id,
          title: 'Pending Proposal',
          description: 'Cannot vote yet.',
          proposalType: 'RULE_CHANGE',
          status: 'PENDING',
          votingStartDate: new Date(),
          votingEndDate: new Date(Date.now() + 86400000),
        },
      });

      const req = makeRequest('POST', `http://localhost/api/circles/${testCircle.id}/governance/${proposal.id}/vote`, {
        body: { voteChoice: 'YES' },
        authHeader,
      });

      const res = await postVote(req as any, { params: Promise.resolve({ id: testCircle.id, proposalId: proposal.id }) } as any);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Proposal is not active');
    });
  });
});
