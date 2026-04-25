# Token Refresh Flow

## Overview

This document explains how token refresh works in Decentralized-Ajo: when the client should refresh, how server-side token rotation is enforced, and which security properties this design provides.

## Why Token Refresh?

JWT access tokens expire after 1 hour. Instead of forcing users to log in again every hour, the app uses a long-lived refresh token stored in an HttpOnly cookie to silently issue new access tokens.

## Token Lifetimes

| Token | Lifetime | Storage |
|---|---|---|
| Access token (JWT) | 1 hour | localStorage (key: token) |
| Refresh token | 30 days | HttpOnly cookie (name: refreshToken) |

## POST /api/auth/refresh

Issues a new access token using the refresh token cookie.

No request body or Authorization header is required. The refresh token is read automatically from the refreshToken HttpOnly cookie.

### Success Response (200)

```json
{
  "success": true,
  "token": "<new-jwt-access-token>"
}
```

A new refreshToken cookie is also set in the response with a fresh 30-day expiry.

### Error Response (401)

Returned when the refresh token is missing, expired, or invalid:

```json
{
  "error": "Invalid or expired refresh token"
}
```

On 401, the refreshToken cookie is cleared (maxAge: 0). The client should redirect the user to /auth/login.

## Server-Side Rotation Mechanism

The rotateRefreshToken function in lib/auth.ts handles refresh token rotation atomically:

1. Looks up the submitted token in the RefreshToken table.
2. Checks expiresAt > now.
3. If expired, deletes the token and returns null.
4. If valid, runs a Prisma transaction that:
   - Deletes the old token.
   - Creates a new token with a fresh 30-day expiry.
5. Returns { token: newToken, userId }.

This is done in a single database transaction to prevent race conditions where two simultaneous refresh requests could both succeed with the same old token.

## Client-Side Refresh Strategy

Recommended pattern: intercept 401 responses, attempt refresh, and retry the original request once.

```ts
// lib/auth-client.ts pattern
async function authenticatedFetch(url: string, options?: RequestInit) {
  const token = localStorage.getItem('token');
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    // Try to refresh
    const refreshResponse = await fetch('/api/auth/refresh', { method: 'POST' });
    if (refreshResponse.ok) {
      const { token: newToken } = await refreshResponse.json();
      localStorage.setItem('token', newToken);
      // Retry original request with new token
      return fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    } else {
      // Refresh failed - redirect to login
      window.location.href = '/auth/login';
    }
  }

  return response;
}
```

## Security Properties

- Replay prevention: Each refresh token can only be used once. Using it invalidates it and issues a new one.
- Theft detection: If an attacker steals and uses a refresh token before the legitimate user does, the legitimate user's next refresh attempt will fail (token already rotated), forcing re-authentication.
- HttpOnly cookie: The refresh token is inaccessible to JavaScript, reducing XSS exposure.
- Secure flag: In production (NODE_ENV === 'production'), the cookie is set with Secure: true and only sent over HTTPS.
- SameSite=Lax: Prevents the cookie from being sent in most cross-site requests, mitigating CSRF.

## Logout

POST /api/auth/logout revokes the refresh token by calling revokeRefreshToken(token), which deletes it from the RefreshToken table. The cookie is also cleared. After logout, the refresh token cannot be used to obtain new access tokens.
