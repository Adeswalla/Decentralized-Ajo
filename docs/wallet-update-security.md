# Wallet Update Security Guide

This document explains the security model behind updating a user's wallet address via the API, and how the frontend should implement the flow correctly.

---

## Why Wallet Updates Need Extra Security

A wallet address is tied to on-chain identity and financial activity inside circles. Allowing a simple authenticated `PATCH` to swap it without proof-of-ownership would let an attacker who steals a JWT redirect payouts to a wallet they control. The solution is a **challenge-response signature flow** that proves the requester owns the private key of the new address before it is saved.

---

## The Two-Step Verified Flow

The secure path uses two endpoints in sequence:

### Step 1 — Request a Nonce

```
GET /api/auth/wallet/nonce
Authorization: Bearer <access_token>
```

The server:
1. Validates the JWT and identifies the user.
2. Generates a cryptographically random UUID (`crypto.randomUUID()`).
3. Persists the nonce to `user.nonce` in the database (overwriting any previous value).
4. Returns the nonce to the client.

```json
{ "success": true, "nonce": "a3f1c2d4-..." }
```

The nonce is **single-use and server-authoritative** — the client cannot fabricate or reuse one.

---

### Step 2 — Sign and Verify

```
POST /api/auth/wallet/verify
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "address": "<new_stellar_public_key>",
  "nonce": "<nonce_from_step_1>",
  "signature": "<base64_ed25519_signature>"
}
```

The server:
1. Re-authenticates the JWT.
2. Loads the stored nonce from the database and compares it to the submitted one — a mismatch or null value is rejected immediately.
3. Reconstructs the Stellar `Keypair` from `address` and calls `keypair.verify(Buffer.from(nonce), Buffer.from(signature, 'base64'))` using `@stellar/stellar-sdk`.
4. On success: sets `walletAddress = address`, `isWalletVerified = true`, and **nullifies `nonce`** so it cannot be replayed.
5. On any failure: returns a 400 with a specific error message — the nonce is not consumed, so the user can retry with a correct signature.

```json
{ "success": true, "message": "Wallet successfully verified" }
```

---

## The Simple (Unverified) Update Endpoint

```
PATCH /api/users/update-wallet
Authorization: Bearer <access_token>
Content-Type: application/json

{ "walletAddress": "<stellar_public_key>" }
```

This endpoint:
- Requires a valid JWT.
- Validates the address format with `isValidStellarAddress()`.
- Is rate-limited to **60 requests / 60 s** per user (`RATE_LIMITS.api`).
- Does **not** require a signature — it does not set `isWalletVerified`.

Use this only in contexts where proof-of-ownership is not required (e.g., initial address entry before verification). For any security-sensitive update, always use the two-step verified flow above.

---

## Security Controls Summary

| Control | Verified Flow | Simple Update |
|---|---|---|
| JWT authentication | ✅ | ✅ |
| Rate limiting | ✅ (via nonce endpoint) | ✅ 60 req/min |
| Stellar address format check | ✅ | ✅ |
| Proof of private key ownership | ✅ Ed25519 signature | ❌ |
| Nonce replay prevention | ✅ nullified after use | N/A |
| Sets `isWalletVerified` | ✅ | ❌ |

---

## Frontend Implementation

### Signing the Nonce with Freighter

```typescript
import { signTransaction } from '@stellar/freighter-api';

async function updateWalletVerified(accessToken: string, newAddress: string) {
  // 1. Get a fresh nonce
  const nonceRes = await fetch('/api/auth/wallet/nonce', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const { nonce } = await nonceRes.json();

  // 2. Sign the nonce with the user's wallet
  //    Freighter signs arbitrary data via signTransaction or signBlob depending on version.
  //    Here we encode the nonce as a UTF-8 buffer and sign it.
  const signedResult = await signTransaction(nonce, { networkPassphrase: 'Test SDF Network ; September 2015' });
  // signedResult.signedPayload is base64-encoded

  // 3. Submit for verification
  const verifyRes = await fetch('/api/auth/wallet/verify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      address: newAddress,
      nonce,
      signature: signedResult.signedPayload,
    }),
  });

  if (!verifyRes.ok) {
    const { error } = await verifyRes.json();
    throw new Error(error);
  }
}
```

### Error Handling

| HTTP Status | Cause | Recommended UX |
|---|---|---|
| 401 | Missing or expired JWT | Redirect to login / refresh token |
| 400 `Invalid, reused, or expired nonce` | Nonce was already consumed or tampered | Restart from Step 1 |
| 400 `Signature verification failed` | Wrong key signed the nonce | Show "Wallet mismatch" message |
| 400 `Invalid address or signature format` | Malformed public key or signature | Validate address client-side first |
| 429 | Rate limit exceeded | Show retry-after countdown |

---

## Notes for Developers

- **Nonce lifetime**: The nonce has no TTL enforced in code — it lives until replaced or consumed. If you need expiry, add a `nonceExpiresAt` timestamp to the `User` model and check it in the verify handler.
- **JWT staleness**: After a successful wallet update the JWT still carries the old `walletAddress` claim. Trigger a token refresh (`POST /api/auth/refresh`) so the client's token reflects the new address.
- **Production rate limiting**: The current rate limiter is in-memory. In a multi-instance deployment, replace the store with Redis/Upstash to share state across instances.
