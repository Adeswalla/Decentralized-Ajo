import { TestDbHelper } from '../db-helper';
import { makeRequest } from '../helpers';
import { generateToken } from '@/lib/auth';
import { GET as getCircles, POST as postCircle } from '@/app/api/circles/route';
import { GET as getCircle, PATCH as patchCircle, DELETE as deleteCircle } from '@/app/api/circles/[id]/route';

// Mock dependencies that we don't want to use real versions of in integration tests
jest.mock('@/lib/redis', () => ({
  redisClient: {
    getCachedCircleList: jest.fn().mockResolvedValue(null),
    cacheCircleList: jest.fn().mockResolvedValue(null),
    invalidateUserCache: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn().mockReturnValue(null),
  RATE_LIMITS: {
    api: { windowMs: 1000, max: 100 },
  },
}));

const dbHelper = new TestDbHelper();
const prisma = dbHelper.getPrisma();

describe('Circles API Integration Tests', () => {
  let testUser: any;
  let authHeader: string;

  beforeAll(async () => {
    // Note: In a real environment, we'd run migrations here.
    // For this test, we assume the DB is ready or use prisma db push.
  });

  beforeEach(async () => {
    await dbHelper.cleanup();
    
    // Create a test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        address: 'GAX...TEST',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const token = generateToken({
      userId: testUser.id,
      email: testUser.email,
    });
    authHeader = `Bearer ${token}`;
  });

  afterAll(async () => {
    await dbHelper.disconnect();
  });

  describe('POST /api/circles', () => {
    it('should create a new circle successfully', async () => {
      const circleData = {
        name: 'Integration Test Circle',
        description: 'Testing real DB integration',
        contributionAmount: 100,
        contributionFrequencyDays: 7,
        maxRounds: 12,
      };

      const req = makeRequest('POST', 'http://localhost/api/circles', {
        body: circleData,
        authHeader,
      });

      const res = await postCircle(req as any);
      expect(res.status).toBe(201);
      
      const body = await res.json();
      expect(body.name).toBe(circleData.name);
      expect(body.organizerId).toBe(testUser.id);

      // Verify in DB
      const dbCircle = await prisma.circle.findUnique({
        where: { id: body.id },
      });
      expect(dbCircle).toBeTruthy();
      expect(dbCircle?.name).toBe(circleData.name);
    });

    it('should return 400 for missing required fields', async () => {
      const req = makeRequest('POST', 'http://localhost/api/circles', {
        body: { name: 'Incomplete Circle' },
        authHeader,
      });

      const res = await postCircle(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const req = makeRequest('POST', 'http://localhost/api/circles', {
        body: { name: 'Unauthorized' },
      });

      const res = await postCircle(req as any);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/circles', () => {
    it('should return a list of circles for the user', async () => {
      // Pre-seed a circle
      await prisma.circle.create({
        data: {
          name: 'Existing Circle',
          contributionAmount: 50,
          organizerId: testUser.id,
          status: 'ACTIVE',
        },
      });

      const req = makeRequest('GET', 'http://localhost/api/circles', {
        authHeader,
      });

      const res = await getCircles(req as any);
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].name).toBe('Existing Circle');
    });
  });

  describe('GET /api/circles/[id]', () => {
    it('should return circle details', async () => {
      const circle = await prisma.circle.create({
        data: {
          name: 'Detail Circle',
          contributionAmount: 50,
          organizerId: testUser.id,
          status: 'ACTIVE',
        },
      });

      const req = makeRequest('GET', `http://localhost/api/circles/${circle.id}`, {
        authHeader,
      });

      const res = await getCircle(req as any, { params: Promise.resolve({ id: circle.id }) } as any);
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.name).toBe('Detail Circle');
    });

    it('should return 404 for non-existent circle', async () => {
      const req = makeRequest('GET', 'http://localhost/api/circles/non-existent', {
        authHeader,
      });

      const res = await getCircle(req as any, { params: Promise.resolve({ id: 'non-existent' }) } as any);
      expect(res.status).toBe(404);
    });
  });
});
