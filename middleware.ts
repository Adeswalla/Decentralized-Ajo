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

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const { method, nextUrl } = request;
  const origin = request.headers.get('origin') ?? '';

  // ── CORS enforcement ────────────────────────────────────────────────────────
  // Only run origin check when an Origin header is present (i.e. cross-origin
  // browser requests). Server-to-server calls without Origin are unaffected.
  if (origin && !allowedOrigins.has(origin)) {
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403 },
    );
  }

  // Handle preflight (OPTIONS) immediately — no further processing needed.
  if (method === 'OPTIONS') {
    const preflight = new NextResponse(null, { status: 204 });
    if (origin) preflight.headers.set('Access-Control-Allow-Origin', origin);
    preflight.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
    preflight.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    preflight.headers.set('Access-Control-Allow-Credentials', 'true');
    preflight.headers.set('Access-Control-Max-Age', '86400');
    return preflight;
  }

  // ── Request logging ─────────────────────────────────────────────────────────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  console.log(JSON.stringify({ requestId, method, url: nextUrl.pathname, type: 'request' }));

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  const duration = Date.now() - startTime;
  console.log(
    JSON.stringify({ requestId, method, url: nextUrl.pathname, status: response.status, duration: `${duration}ms`, type: 'response' }),
  );

  // ── CORS response headers ───────────────────────────────────────────────────
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
