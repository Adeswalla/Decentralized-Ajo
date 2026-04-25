import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

/**
 * Helper to manage a real database for integration tests.
 */
export class TestDbHelper {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Resets the database by running prisma migrate reset.
   * This ensures a clean slate for tests.
   */
  async resetDb() {
    try {
      // In a real CI environment, you might use a separate DATABASE_URL
      // Here we assume DATABASE_URL is already set to a test DB
      execSync('npx prisma migrate reset --force --skip-seed', { stdio: 'inherit' });
    } catch (error) {
      console.error('Failed to reset test database:', error);
      throw error;
    }
  }

  /**
   * Generic cleanup that works for both Postgres and SQLite.
   */
  async cleanup() {
    const isSQLite = process.env.DATABASE_URL?.startsWith('file:');
    
    if (isSQLite) {
      await this.cleanupSQLite();
    } else {
      await this.cleanupPostgres();
    }
  }

  /**
   * Cleans up all data from the database without resetting schema.
   * Faster than resetDb() for between-test cleanup.
   */
  async cleanupPostgres() {
    const tablenames = await this.prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public'`,
    );

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        try {
          await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
        } catch (error) {
          // Some tables might not exist or be system tables
        }
      }
    }
  }

  /**
   * For SQLite support
   */
  async cleanupSQLite() {
    // Order matters for foreign keys if not using CASCADE (SQLite doesn't support TRUNCATE CASCADE)
    const tables = [
      'DeadlineReminder',
      'GovernanceVote',
      'GovernanceProposal',
      'Contribution',
      'PaymentSchedule',
      'CircleMember',
      'Circle',
      'RefreshToken',
      'Notification',
      'User',
    ];
    
    for (const table of tables) {
      try {
        await (this.prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)].deleteMany();
      } catch (error) {
        // Table might not exist in this schema version
      }
    }
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  getPrisma() {
    return this.prisma;
  }
}
