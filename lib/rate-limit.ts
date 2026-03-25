/**
 * In-memory sliding-window rate limiter.
 * For production with multiple instances, swap the store for a Redis/Upstash backend.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  /** Max requests allowed within the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/** Pre-configured limits for different route groups */
export const RATE_LIMITS = {
  /** Tight limit for auth endpoints to slow brute-force attacks */
  auth: { limit: 10, windowMs: 60_000 } satisfies RateLimitConfig,
  /** General API limit */
  api: { limit: 60, windowMs: 60_000 } satisfies RateLimitConfig,
} as const;

/**
 * Returns `null` when the request is allowed, or a `{ retryAfter }` object
 * (seconds until reset) when the limit is exceeded.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { retryAfter: number } | null {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  if (entry.count >= config.limit) {
    return { retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return null;
}

/**
 * Derive a rate-limit key from a NextRequest.
 * Uses the authenticated user ID when available, falls back to IP.
 */
export function getRateLimitKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`;
}
