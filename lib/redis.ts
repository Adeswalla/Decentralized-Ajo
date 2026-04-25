import Redis from 'ioredis';
import { createChildLogger } from '@/lib/logger';

// Redis client configuration for caching dashboard statistics
const logger = createChildLogger({ service: 'lib', module: 'redis' });

class RedisClient {
  private client: Redis | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.connect();
  }

  private async connect() {
    try {
      // Use environment variables for Redis configuration
      const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
      
      if (redisUrl) {
        this.client = new Redis(redisUrl, {
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
      } else {
        // Fallback to local Redis for development
        this.client = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
      }

      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        logger.error('Redis connection error', { err });
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.info('Redis connection closed');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis', { err: error });
      this.isConnected = false;
    }
  }

  public getClient(): Redis | null {
    return this.client;
  }

  public isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Cache dashboard statistics with TTL
  public async cacheStats(userId: string, stats: any, ttlSeconds: number = 300): Promise<void> {
    if (!this.isReady()) return;

    try {
      const key = `dashboard:stats:${userId}`;
      await this.client!.setex(key, ttlSeconds, JSON.stringify(stats));
    } catch (error) {
      logger.error('Failed to cache stats', { err: error, userId });
    }
  }

  // Get cached dashboard statistics
  public async getCachedStats(userId: string): Promise<any | null> {
    if (!this.isReady()) return null;

    try {
      const key = `dashboard:stats:${userId}`;
      const cached = await this.client!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Failed to get cached stats', { err: error, userId });
      return null;
    }
  }

  // Invalidate user's dashboard cache
  public async invalidateUserCache(userId: string): Promise<void> {
    if (!this.isReady()) return;

    try {
      const pattern = `dashboard:stats:${userId}`;
      await this.client!.del(pattern);
    } catch (error) {
      logger.error('Failed to invalidate user cache', { err: error, userId });
    }
  }

  // Cache circle list with pagination
  public async cacheCircleList(userId: string, params: string, data: any, ttlSeconds: number = 180): Promise<void> {
    if (!this.isReady()) return;

    try {
      const key = `circles:list:${userId}:${Buffer.from(params).toString('base64')}`;
      await this.client!.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      logger.error('Failed to cache circle list', { err: error, userId });
    }
  }

  // Get cached circle list
  public async getCachedCircleList(userId: string, params: string): Promise<any | null> {
    if (!this.isReady()) return null;

    try {
      const key = `circles:list:${userId}:${Buffer.from(params).toString('base64')}`;
      const cached = await this.client!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Failed to get cached circle list', { err: error, userId });
      return null;
    }
  }

  // Close Redis connection
  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export const redisClient = new RedisClient();
export default redisClient;
