import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { checkRateLimit, getRateLimitKey, RateLimitConfig } from './rate-limit';

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
      error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 },
      ),
    };
  }

  return { data: result.data, error: null };
}
/**
 * Apply rate limiting to a request.
 * Returns a 429 NextResponse when the limit is exceeded, otherwise null.
 */
export function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  prefix: string,
  userId?: string,
): NextResponse | null {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const identifier = userId ?? ip;
  const key = getRateLimitKey(prefix, identifier);
  const limited = checkRateLimit(key, config);

  if (limited) {
    return NextResponse.json(
      { error: 'Too many requests, please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limited.retryAfter) },
      },
    );
  }

  return null;
}
