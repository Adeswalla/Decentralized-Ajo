/**
 * Rate limiter with Upstash Redis (sliding window) for production
 * and an in-memory fallback for local development.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createChildLogger } from './logger';

const logger = createChildLogger({ service: 'rate-limit' });

export interface RateLimitConfig {
  /** Max requests allowed within the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitStore {
  check(key: string, config: RateLimitConfig): Promise<{ retryAfter: number } | null>;
}

/** In-memory sliding-window rate limiter for local development. */
class MemoryStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetAt: number }>();

  async check(key: string, config: RateLimitConfig): Promise<{ retryAfter: number } | null> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + config.windowMs });
      return null;
    }

    if (entry.count >= config.limit) {
      return { retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }

    entry.count += 1;
    return null;
  }
}

/**
 * Redis-backed rate limiter using @upstash/ratelimit sliding window.
 * Atomic by design — no race condition between incr and expire.
 */
class RedisStore implements RateLimitStore {
  // Cache Ratelimit instances keyed by "limit:windowMs" to avoid recreating per request.
  private limiters = new Map<string, Ratelimit>();
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  private getLimiter(config: RateLimitConfig): Ratelimit {
    const cacheKey = `${config.limit}:${config.windowMs}`;
    let limiter = this.limiters.get(cacheKey);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(config.limit, `${config.windowMs} ms`),
        prefix: 'rl',
      });
      this.limiters.set(cacheKey, limiter);
    }
    return limiter;
  }

  async check(key: string, config: RateLimitConfig): Promise<{ retryAfter: number } | null> {
    try {
      const { success, reset } = await this.getLimiter(config).limit(key);
      if (!success) {
        const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
        return { retryAfter };
      }
      return null;
    } catch (err) {
      // FAIL-OPEN: if Redis is unavailable, allow the request rather than blocking all users.
      logger.error('Redis rate limit error, failing open', { err, key });
      return null;
    }
  }
}

const store: RateLimitStore =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new RedisStore()
    : new MemoryStore();

/** Pre-configured limits for different route groups */
export const RATE_LIMITS = {
  /** Tight limit for auth endpoints to slow brute-force attacks */
  auth: { limit: 10, windowMs: 15 * 60 * 1000 } satisfies RateLimitConfig,
  /** General API limit */
  api: { limit: 100, windowMs: 15 * 60 * 1000 } satisfies RateLimitConfig,
  /** Sensitive operations like joining/creating circles */
  sensitive: { limit: 20, windowMs: 60 * 60 * 1000 } satisfies RateLimitConfig,
} as const;

/**
 * Returns `null` when the request is allowed, or `{ retryAfter }` (seconds)
 * when the limit is exceeded.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<{ retryAfter: number } | null> {
  return store.check(key, config);
}

/** Derive a rate-limit key from a prefix and identifier (user ID or IP). */
export function getRateLimitKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`;
}
