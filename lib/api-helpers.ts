import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { checkRateLimit, getRateLimitKey, RateLimitConfig } from './rate-limit';
import { extractToken, verifyToken, JWTPayload } from './auth';

export type ErrorEnvelope = {
  code: string;
  message?: string;
  details?: unknown;
  requestId?: string | null;
};

/** Build a standardized error response and attach `x-request-id` header when available. */
export function errorResponse(
  request: NextRequest | null,
  { code, message, details }: { code: string; message: string; details?: unknown },
  status = 500,
) {
  const requestId = request?.headers.get('x-request-id') ?? null;
  const payload: ErrorEnvelope = { code, message, details, requestId };
  const res = NextResponse.json(payload, { status });
  if (requestId) res.headers.set('x-request-id', requestId);
  return res;
}

/** Validate a route ID parameter; returns a 404 response if invalid. */
export function validateId(
  request: NextRequest,
  id: string | undefined,
): NextResponse | null {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return errorResponse(request, { code: 'not_found', message: 'Circle not found' }, 404);
  }
  return null;
}

/** Parse and validate a request body against a Zod schema. */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      data: null,
      error: errorResponse(request, { code: 'invalid_json', message: 'Invalid JSON body' }, 400),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      data: null,
      error: errorResponse(
        request,
        { code: 'validation_failed', message: 'Validation failed', details: result.error.flatten() },
        400,
      ),
    };
  }

  return { data: result.data, error: null };
}
/**
 * Apply rate limiting to a request.
 * Returns a 429 NextResponse when the limit is exceeded, otherwise null.
 *
 * NOTE: This is now asynchronous.
 */
export async function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  prefix: string,
  userId?: string,
): Promise<NextResponse | null> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const identifier = userId ?? ip;
  const key = getRateLimitKey(prefix, identifier);
  const limited = await checkRateLimit(key, config);

  if (limited) {
    const res = NextResponse.json(
      { error: 'Too many requests, please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limited.retryAfter) },
      },
    );
    const requestId = request.headers.get('x-request-id');
    if (requestId) res.headers.set('x-request-id', requestId);
    return res;
  }

  return null;
}

/**
 * Validates the JWT from the Authorization header and checks if it contains
 * all the required scopes. Supports both user and service tokens.
 */
export async function authorize(
  request: NextRequest,
  requiredScopes: string[] = [],
): Promise<{ payload: JWTPayload; error: null } | { payload: null; error: NextResponse }> {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) {
    return {
      payload: null,
      error: errorResponse(
        request,
        { code: 'unauthorized', message: 'Missing authorization token' },
        401,
      ),
    };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return {
      payload: null,
      error: errorResponse(
        request,
        { code: 'unauthorized', message: 'Invalid or expired token' },
        401,
      ),
    };
  }

  // Scope validation
  if (requiredScopes.length > 0) {
    const hasAllScopes = requiredScopes.every((scope) =>
      payload.scopes.includes(scope),
    );

    if (!hasAllScopes) {
      return {
        payload: null,
        error: errorResponse(
          request,
          { code: 'forbidden', message: 'Insufficient permissions (missing required scopes)' },
          403,
        ),
      };
    }
  }

  return { payload, error: null };
}
