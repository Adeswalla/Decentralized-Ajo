jest.mock('@/lib/prisma', () => ({
  prisma: {
    refreshToken: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('lib/auth bcrypt rounds configuration', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.BCRYPT_SALT_ROUNDS;
  });

  it('uses the default bcrypt rounds when env var is missing', async () => {
    const auth = await import('@/lib/auth');

    expect(auth.BCRYPT_SALT_ROUNDS).toBe(10);
    const passwordHash = await auth.hashPassword('Password123!');
    expect(typeof passwordHash).toBe('string');
    expect(passwordHash).toMatch(/\$2[aby]\$10\$/);
  });

  it('clamps unsupported high bcrypt rounds to a safe maximum', async () => {
    process.env.BCRYPT_SALT_ROUNDS = '16';
    const auth = await import('@/lib/auth');

    expect(auth.BCRYPT_SALT_ROUNDS).toBe(12);
    const passwordHash = await auth.hashPassword('Password123!');
    expect(passwordHash).toMatch(/\$2[aby]\$12\$/);
  });

  it('clamps unsupported low bcrypt rounds to a safe minimum', async () => {
    process.env.BCRYPT_SALT_ROUNDS = '4';
    const auth = await import('@/lib/auth');

    expect(auth.BCRYPT_SALT_ROUNDS).toBe(8);
    const passwordHash = await auth.hashPassword('Password123!');
    expect(passwordHash).toMatch(/\$2[aby]\$08\$/);
  });
});
