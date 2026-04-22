# Security Architecture: Auth, Rate Limiting, Smart Contract, and Pre-Mainnet Checklist

## Authentication Security

### Password Hashing
Passwords are hashed using `bcryptjs` with a salt factor of 10 before storage. Plain-text passwords are never stored or logged.

```typescript
// lib/auth.ts
const salt = await bcrypt.genSalt(10);
return bcrypt.hash(password, salt);
```

### JWT Access Tokens
- Signed with HS256 using `JWT_SECRET`
- Expire after 1 hour
- Payload contains `userId`, `email`, and optionally `walletAddress`
- Extracted from the `Authorization: Bearer` header on every protected request

### Refresh Token Security
- Stored in the database as UUID strings (not JWTs)
- Sent as an **HttpOnly**, **Secure** (production), **SameSite=Lax** cookie — inaccessible to JavaScript
- 30-day expiry
- **Token rotation**: the old token is deleted and a new one is issued atomically in a Prisma transaction on every refresh, preventing replay attacks
- All tokens for a user are revoked on logout via `revokeUserRefreshTokens`

### Wallet Signature Verification
- Uses Ed25519 cryptography via `@stellar/stellar-sdk`
- Nonce is a UUID generated server-side and stored in the database
- Nonce is nullified immediately after successful verification (**single-use**)
- Prevents replay attacks: a captured signature cannot be reused

## API Security

### Rate Limiting
All endpoints are rate-limited using an in-memory sliding-window limiter:

- **Auth endpoints**: 10 requests per minute per IP/user
- **All other endpoints**: 60 requests per minute per IP/user
- Returns `429 Too Many Requests` with `Retry-After` header when exceeded

**Production note**: The current rate limiter is in-memory and does not share state across multiple server instances. For multi-instance deployments, replace with a Redis-backed limiter (e.g., Upstash).

### Input Validation
Every API route validates request bodies using Zod schemas before processing. Invalid requests return `400 Validation failed` with field-level error details. This prevents malformed data from reaching the database.

### Authorization Checks
Every protected route:
1. Extracts and verifies the JWT
2. Checks that the authenticated user has permission for the specific resource (e.g., must be a circle member to contribute, must be the organizer to add members)

### Request Tracing
Every request is assigned a UUID `x-request-id` by the middleware. This ID is attached to both the request and response headers, enabling log correlation for debugging.

## Database Security

### Cascade Deletes
All foreign keys use `onDelete: Cascade`. Deleting a user removes all their circles, contributions, votes, and tokens. Deleting a circle removes all its members, contributions, and proposals.

### Sensitive Field Exclusion
API responses never include the `password` field. Prisma select statements explicitly exclude it:

```typescript
select: { id: true, email: true, firstName: true, lastName: true }
// password is never selected
```

### Database Indexes
Performance indexes are defined on all foreign keys and frequently filtered fields (`status`, `circleId`, `userId`) to prevent slow queries that could be exploited for denial-of-service.

## Smart Contract Security

### Authorization
Every state-changing function requires `address.require_auth()` — the Soroban SDK enforces that the transaction is signed by the correct account.

### Overflow Protection
Arithmetic uses `checked_add` and `checked_sub` where applicable to prevent integer overflow.

### Capacity Limits
- Default max members: 50
- Hard cap: 100 (enforced at contract level, not just application level)

### Emergency Halt
The organizer can call `panic()` to immediately freeze all operations. This is a last-resort mechanism for critical bugs or exploits.

### Penalty Enforcement
Partial withdrawals enforce a 10% penalty at the contract level — it cannot be bypassed by calling the API directly.

### Static Analysis / Formal Methods Evaluation (Issue #350)
- Decision record: `contracts/ajo-circle/adr/0001-static-analysis-formal-methods-evaluation.md`
- Security review tracker: GitHub issue #342 (`[Contracts] External security review prep`)
- Current decision: adopt `cargo clippy` as an automated baseline check now; defer Kani/MIRAI rollout until toolchain support for Soroban targets is more mature.

## Known Limitations and Risks

| Risk | Severity | Notes |
|------|----------|-------|
| In-memory rate limiter | Medium | Does not work across multiple server instances. Replace with Redis for production |
| No email verification | Medium | Users can register with any email address. Email verification flow is not yet implemented |
| JWT stored in localStorage | Medium | Vulnerable to XSS. Consider moving to memory storage or HttpOnly cookies |
| No CSRF protection | Low | SameSite=Lax on the refresh token cookie provides partial protection |
| Smart contract not audited | **High** | Must be professionally audited before mainnet deployment |
| No contract upgrade mechanism | Medium | Contract cannot be upgraded after deployment. Bugs require redeployment and migration |
| Shuffle uses ledger sequence | Low | Rotation shuffle seed is predictable by validators. Acceptable for savings circles but not for high-stakes randomness |

## Pre-Mainnet Security Checklist

- [ ] Change `JWT_SECRET` to a cryptographically random 32-byte hex string
- [ ] Verify `RESEND_API_KEY` is set and FROM address uses a verified domain
- [ ] Replace in-memory rate limiter with Redis/Upstash for multi-instance deployments
- [ ] Enable HTTPS and verify SSL certificate is valid
- [ ] Set `DATABASE_URL` to a PostgreSQL instance with SSL enabled
- [ ] Enable automated database backups
- [ ] Have the Soroban smart contract audited by a professional security firm
- [ ] Test all contract functions on testnet with real Freighter wallets
- [ ] Implement email verification for new user registrations
- [ ] Review all API routes for missing authorization checks
- [ ] Set up error monitoring (e.g., Sentry) to catch runtime exceptions
- [ ] Configure Content Security Policy headers
- [ ] Review and restrict CORS origins to your production domain
- [ ] Ensure no secrets are committed to the Git repository
- [ ] Rotate all secrets if any were ever accidentally committed

## Reporting Security Issues

**Do not open public GitHub issues for security vulnerabilities.** Instead, contact the maintainers directly via the email listed in the repository. Include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix

