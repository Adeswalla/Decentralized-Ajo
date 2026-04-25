# REST API Reference

This document is a complete reference of the backend HTTP API with request/response examples.

Base URL: `https://your-api.example.com` (adjust for deployment)

Global
- Health: `GET /api/health`

Example
```bash
curl -sS "https://your-api.example.com/api/health"
```
Response 200
```json
{ "status": "ok" }
```

Authentication Endpoints

POST /api/auth/register
Registers a new user.

Request
```bash
curl -X POST "https://your-api.example.com/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "firstName": "Jane",
    "lastName": "Doe"
  }'
```
Success 201
```json
{
  "success": true,
  "user": { "id": "...", "email": "user@example.com", "firstName": "Jane", "lastName": "Doe" },
  "token": "<jwt>"
}
```
Errors: 400 validation error, 409 email already exists, 429 rate limited.

POST /api/auth/login
Authenticates a user and returns a JWT and sets a refresh token cookie.

Request
```bash
curl -X POST "https://your-api.example.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com", "password": "SecurePassword123!" }'
```
Success 200
```json
{
  "success": true,
  "user": { "id": "...", "email": "...", "firstName": "...", "lastName": "...", "walletAddress": null },
  "token": "<jwt>"
}
```
Cookie: `refreshToken` — HttpOnly, Secure in production, SameSite=Lax, ~30d expiry.
Errors: 401 invalid credentials, 429 rate limited.

POST /api/auth/logout
Revokes refresh token, clears cookie.

Request
```bash
curl -X POST "https://your-api.example.com/api/auth/logout" \
  -H "Authorization: Bearer <token>"
```
Success 200
```json
{ "success": true }
```

POST /api/auth/refresh
Issues a new access token using the `refreshToken` cookie (rotation enabled).

Request
```bash
curl -X POST "https://your-api.example.com/api/auth/refresh" \
  -b "refreshToken=<cookie-value>"
```
Success 200
```json
{ "success": true, "token": "<new-jwt>" }
```
Errors: 401 missing/expired/invalid refresh token.

GET /api/auth/wallet/nonce
Generates a one-time nonce for wallet verification.

Request
```bash
curl "https://your-api.example.com/api/auth/wallet/nonce" \
  -H "Authorization: Bearer <token>"
```
Success 200
```json
{ "success": true, "nonce": "550e8400-e29b-41d4-a716-446655440000" }
```

POST /api/auth/wallet/verify
Verifies a Stellar wallet signature and associates wallet with user.

Request
```bash
curl -X POST "https://your-api.example.com/api/auth/wallet/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "address": "GABC...XYZ",
    "signature": "<base64-ed25519-signature>",
    "nonce": "550e8400-e29b-41d4-a716-446655440000"
  }'
```
Success 200
```json
{ "success": true, "message": "Wallet successfully verified" }
```
Errors: 400 missing/invalid fields, 404 user not found.

Circle Endpoints (require `Authorization: Bearer`)

POST /api/circles
Create a savings circle. Creator becomes member with rotationOrder 1.

Request
```bash
curl -X POST "https://your-api.example.com/api/circles" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Office Savings",
    "description": "Optional description",
    "contributionAmount": 100.00,
    "contributionFrequencyDays": 7,
    "maxRounds": 12
  }'
```
Success 201
```json
{
  "success": true,
  "circle": { "id": "...", "name": "Office Savings", "organizerId": "...", "contributionAmount": 100, "contributionFrequencyDays": 7, "maxRounds": 12, "currentRound": 1, "status": "ACTIVE", "organizer": { "id": "...", "email": "..." }, "members": [] }
}
```

GET /api/circles
List circles the user is organizer or member of. Supports `page`, `limit`, `status`.

Request
```bash
curl "https://your-api.example.com/api/circles?page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```
Success 200
```json
{
  "data": [ /* circles */ ],
  "meta": { "total": 42, "pages": 5, "currentPage": 1 }
}
```

GET /api/circles/:id
Get full circle details (members, contributions, payments).

Request
```bash
curl "https://your-api.example.com/api/circles/<id>" \
  -H "Authorization: Bearer <token>"
```

POST /api/circles/:id/join
Join an existing circle.

Request
```bash
curl -X POST "https://your-api.example.com/api/circles/<id>/join" \
  -H "Authorization: Bearer <token>"
```

POST /api/circles/:id/contribute
Record a contribution for the current round.

Request
```bash
curl -X POST "https://your-api.example.com/api/circles/<id>/contribute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{ "amount": 100.00 }'
```
Errors: 403 not a member, 404 circle not found.

GET /api/circles/:id/governance
List governance proposals with vote counts and the authenticated user's vote.

POST /api/circles/:id/governance
Create a governance proposal (members or organizer only).

Request
```bash
curl -X POST "https://your-api.example.com/api/circles/<id>/governance" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Increase contribution amount",
    "description": "Proposal to raise monthly contribution from 100 to 150 XLM",
    "proposalType": "CONTRIBUTION_ADJUSTMENT",
    "votingEndDate": "2026-04-30T00:00:00.000Z",
    "requiredQuorum": 60
  }'
```

POST /api/circles/:id/governance/:proposalId/vote
Cast a vote on a proposal.

Request
```bash
curl -X POST "https://your-api.example.com/api/circles/<id>/governance/<proposalId>/vote" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{ "voteChoice": "YES" }'
```
Valid choices: `YES`, `NO`, `ABSTAIN`.

User Endpoints (require `Authorization: Bearer`)

GET /api/users/profile
Patch /api/users/profile
Get or update user profile (firstName, lastName, phoneNumber, bio, profilePicture).

PATCH /api/users/update-wallet
Associate a Stellar wallet address.

Request
```bash
curl -X PATCH "https://your-api.example.com/api/users/update-wallet" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{ "walletAddress": "GABC...XYZ" }'
```

Transactions
GET /api/transactions
Returns contribution and withdrawal history for the authenticated user.

Rate Limiting
All endpoints are rate-limited. Auth endpoints have stricter limits. Exceeding the limit returns 429.

Global Error Format
Legacy responses used a simple shape: `{ "error": "Human-readable error message" }`.
New endpoints may use a standardized error envelope with `code`, `message`, `details`, and `requestId` where available.

---

Document maintained as `docs/API_REFERENCE.md` — update when endpoints change. If you want, I can also generate an OpenAPI YAML from the route schemas next.
