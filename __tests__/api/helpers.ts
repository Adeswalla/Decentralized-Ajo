/**
 * Lightweight helpers for constructing NextRequest objects in tests.
 * Avoids a full HTTP server — we call route handlers directly.
 */

export function makeRequest(
  method: string,
  url: string,
  options: { body?: unknown; authHeader?: string; cookies?: Record<string, string> } = {},
): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-forwarded-for': '127.0.0.1',
  };

  if (options.authHeader) {
    headers['authorization'] = options.authHeader;
  }

  if (options.cookies) {
    const cookieStr = Object.entries(options.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    headers['cookie'] = cookieStr;
  }

  const req = new Request(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // Next.js NextRequest uses a special cookies property.
  // We mock it here for route handler tests.
  if (options.cookies) {
    (req as any).cookies = {
      get: (name: string) => {
        const value = options.cookies![name];
        return value ? { name, value } : undefined;
      },
    };
  } else {
    (req as any).cookies = {
      get: () => undefined,
    };
  }

  return req;
}
