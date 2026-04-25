import { TestDbHelper } from '../db-helper';
import { makeRequest } from '../helpers';
import { generateRefreshToken, rotateRefreshToken, REFRESH_TOKEN_COOKIE_NAME } from '@/lib/auth';
import { POST as refreshHandler } from '@/app/api/auth/refresh/route';

const dbHelper = new TestDbHelper();
const prisma = dbHelper.getPrisma();

describe('Auth Token Rotation Integration Tests', () => {
  let testUser: any;

  beforeEach(async () => {
    await dbHelper.cleanup();
    
    testUser = await prisma.user.create({
      data: {
        email: 'auth@example.com',
        address: 'GAX...AUTH',
        password: 'HashedPassword123',
      },
    });
  });

  afterAll(async () => {
    await dbHelper.disconnect();
  });

  it('should rotate refresh token on use', async () => {
    // 1. Generate initial refresh token
    const token1 = await generateRefreshToken(testUser.id);
    
    // 2. Use it to refresh
    const req1 = makeRequest('POST', 'http://localhost/api/auth/refresh', {
      cookies: { [REFRESH_TOKEN_COOKIE_NAME]: token1 }
    });
    
    const res1 = await refreshHandler(req1 as any);
    expect(res1.status).toBe(200);
    
    const cookies1 = res1.headers.get('set-cookie');
    expect(cookies1).toContain(REFRESH_TOKEN_COOKIE_NAME);
    
    // Extract new token from cookie
    const token2 = cookies1!.split(';')[0].split('=')[1];
    expect(token2).not.toBe(token1);

    // 3. Verify token1 is marked as rotated in DB
    const dbToken1 = await prisma.refreshToken.findUnique({ where: { token: token1 } });
    expect(dbToken1?.rotatedAt).not.toBeNull();

    // 4. Verify token2 exists and is NOT rotated
    const dbToken2 = await prisma.refreshToken.findUnique({ where: { token: token2 } });
    expect(dbToken2).toBeTruthy();
    expect(dbToken2?.rotatedAt).toBeNull();
    expect(dbToken2?.familyId).toBe(dbToken1?.familyId);
  });

  it('should invalidate entire family on reuse detection', async () => {
    // 1. Generate token chain: token1 -> token2
    const token1 = await generateRefreshToken(testUser.id);
    const rotated1 = await rotateRefreshToken(token1);
    const token2 = rotated1!.token;
    
    // 2. Try to reuse token1 (which is already rotated)
    const reqReuse = makeRequest('POST', 'http://localhost/api/auth/refresh', {
      cookies: { [REFRESH_TOKEN_COOKIE_NAME]: token1 }
    });
    
    const resReuse = await refreshHandler(reqReuse as any);
    expect(resReuse.status).toBe(401);

    // 3. Verify all tokens in the family are deleted
    const dbToken1 = await prisma.refreshToken.findUnique({ where: { token: token1 } });
    const dbToken2 = await prisma.refreshToken.findUnique({ where: { token: token2 } });
    
    expect(dbToken1).toBeNull();
    expect(dbToken2).toBeNull();
  });
});
