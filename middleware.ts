import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const { method, nextUrl } = request;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  console.log(JSON.stringify({ requestId, method, url: nextUrl.pathname, type: 'request' }));

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  const duration = Date.now() - startTime;
  console.log(JSON.stringify({ requestId, method, url: nextUrl.pathname, status: response.status, duration: `${duration}ms`, type: 'response' }));

  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (handled by NextAuth if applicable, or keep it for general logging)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
