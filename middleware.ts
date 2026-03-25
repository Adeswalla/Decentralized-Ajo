import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const { method, url, nextUrl } = request;

  try {
    // Add requestId to request headers for downstream tracing
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-request-id', requestId);

    const host = request.headers.get('host');

    // Log the incoming request
    logger.info({
      requestId,
      method,
      url: nextUrl.pathname,
      host,
      type: 'request',
    }, `Incoming ${method} ${nextUrl.pathname}`);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Log the response
    const duration = Date.now() - startTime;
    logger.info({
      requestId,
      method,
      url: nextUrl.pathname,
      status: response.status,
      duration: `${duration}ms`,
      type: 'response',
    }, `Completed ${method} ${nextUrl.pathname} with ${response.status} in ${duration}ms`);

    // Add requestId to response headers
    response.headers.set('x-request-id', requestId);

    return response;
  } catch (error) {
    // Catch unhandled errors in middleware and log them
    logger.error({
      err: error,
      requestId,
      method,
      url: nextUrl.pathname,
      type: 'middleware_error',
    }, 'Unhandled error in middleware');

    // Fallback response in case of middleware crash
    return NextResponse.next();
  }
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
