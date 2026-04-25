/**
 * In-memory LRU cache with TTL support.
 *
 * Backed by `lru-cache`. For multi-instance deployments swap this out for a
 * Redis/Upstash adapter — the public API (`get`, `set`, `del`, `invalidatePrefix`)
 * is the same either way.
 *
 * Default TTL: 60 seconds
 * Max entries:  500
 */

import { LRUCache } from 'lru-cache';

const DEFAULT_TTL_MS = 60_000; // 60 s
const MAX_ITEMS = 500;

const store = new LRUCache<string, unknown>({
  max: MAX_ITEMS,
  ttl: DEFAULT_TTL_MS,
  // Allow stale reads while a fresh value is being fetched (optional, safe default)
  allowStale: false,
});

/** Retrieve a cached value, or `undefined` on miss / expiry. */
export function cacheGet<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

/** Store a value. `ttlMs` overrides the default 60 s TTL. */
export function cacheSet<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, value, { ttl: ttlMs });
}

/** Remove a single entry. */
export function cacheDel(key: string): void {
  store.delete(key);
}

/**
 * Invalidate all keys that start with `prefix`.
 * Useful for busting a whole resource group (e.g. `"circles:"`) after a write.
 */
export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
