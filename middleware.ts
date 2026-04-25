import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_METHODS = 'GET,POST,PUT,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type,Authorization,x-request-id';

/** Origins allowed to call backend operations. Evaluated once at cold-start. */
const allowedOrigins: ReadonlySet<string> = new Set(
  [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
  ].filter(Boolean) as string[],
);

// Simple in-memory rate limiter safe for the Edge Runtime (no Node.js APIs).
// For multi-instance production, replace with Upstash Redis via the HTTP SDK.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function edgeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { retryAfter: number } | null {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (entry.count >= limit) {
    return { retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return null;
}

export async function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const { method, nextUrl } = request;
  const origin = request.headers.get('origin') ?? '';

  // ── CORS enforcement ────────────────────────────────────────────────────────
  if (origin && !allowedOrigins.has(origin)) {
    const res = NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  // Handle preflight (OPTIONS) immediately.
  if (method === 'OPTIONS') {
    const preflight = new NextResponse(null, { status: 204 });
    if (origin) preflight.headers.set('Access-Control-Allow-Origin', origin);
    preflight.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
    preflight.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    preflight.headers.set('Access-Control-Allow-Credentials', 'true');
    preflight.headers.set('Access-Control-Max-Age', '86400');
    preflight.headers.set('x-request-id', requestId);
    return preflight;
  }

  // ── Rate Limiting ───────────────────────────────────────────────────────────
  if (nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
    const isAuthRoute = nextUrl.pathname.startsWith('/api/auth/');
    const limit = isAuthRoute ? 10 : 100;
    const windowMs = isAuthRoute ? 15 * 60 * 1000 : 15 * 60 * 1000;
    const prefix = isAuthRoute ? 'auth' : 'api';
    const limitKey = `${prefix}:${ip}`;

    const limitResult = edgeRateLimit(limitKey, limit, windowMs);
    if (limitResult) {
      const res = NextResponse.json(
        { error: 'Too many requests; please try again later.', retryAfter: limitResult.retryAfter },
        { status: 429, headers: { 'Retry-After': limitResult.retryAfter.toString() } },
      );
      res.headers.set('x-request-id', requestId);
      return res;
    }
  }

  // ── Forward request with ID ─────────────────────────────────────────────────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set('x-request-id', requestId);
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
    response.headers.set('Vary', 'Origin');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
