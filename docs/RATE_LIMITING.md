# Production Rate Limiting

The Stellar Ajo backend uses a production-grade rate limiting system designed to work across multiple serverless instances.

## Architecture

The system uses a pluggable store architecture defined in `lib/rate-limit.ts`:

1.  **Shared Store (Production)**: Uses **Upstash Redis** (via `@upstash/redis`) to coordinate request counts across all running instances (Vercel, AWS Lambda, etc.).
2.  **In-Memory Store (Development)**: Falls back to a local `Map` when Redis credentials are not provided, ensuring zero-config local development.

## Environment Variables

To enable the shared store in production, the following environment variables must be set:

| Variable | Description | Source |
|----------|-------------|--------|
| `UPSTASH_REDIS_REST_URL` | The REST API URL for your Redis instance | Upstash Console |
| `UPSTASH_REDIS_REST_TOKEN` | The REST API Token for your Redis instance | Upstash Console |

If these variables are missing, the system will automatically fall back to `MemoryStore`.

## Rate Limit Classes

We use three distinct classes of limits to balance security and usability:

-   **`auth`**: 10 requests / 15 minutes. Applied to login, register, and refresh routes to mitigate brute-force attacks.
-   **`api`**: 100 requests / 15 minutes. Default for general read-only and low-impact API calls.
-   **`sensitive`**: 20 requests / 1 hour. Applied to high-impact operations like joining circles, contributing funds, or administrative actions.

## Reliability & Error Handling

### Fail-Open Policy
The rate limiter is designed with a **Fail-Open** policy. If the Redis store is unreachable or returns an error:
1.  The error is logged via the internal logger.
2.  The request is **allowed** to proceed.

This prioritizes application availability over strict rate limit enforcement. We assume that a temporary infrastructure failure should not prevent legitimate users from accessing the service.

### Cost Expectations
Upstash Redis is priced per request. The rate limiter performs approximately 1-2 Redis calls per HTTP request to the backend. In a typical production environment with moderate traffic, this remains well within the free tier or low-cost pay-as-you-go tiers.
