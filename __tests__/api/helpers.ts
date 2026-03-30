/**
 * Lightweight helpers for constructing NextRequest objects in tests.
 * Avoids a full HTTP server — we call route handlers directly.
 */

export function makeRequest(
  method: string,
  url: string,
  options: { body?: unknown; authHeader?: string } = {},
): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-forwarded-for': '127.0.0.1',
  };

  if (options.authHeader) {
    headers['authorization'] = options.authHeader;
  }

  return new Request(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}
