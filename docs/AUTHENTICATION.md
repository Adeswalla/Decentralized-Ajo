# Authentication

Stellar Ajo uses two authentication mechanisms: email/password with JWT, and Stellar wallet signature verification.

---

## Part 1: Email / Password Authentication

### Registration

`POST /api/auth/register` — body: `{ email, password, firstName, lastName }`

1. Request body is validated against `RegisterSchema` in `lib/validations/auth.ts`.
2. Password is hashed with `bcryptjs` (salt factor 10) via `hashPassword` in `lib/auth.ts`.
3. A `User` record is created in the database.
4. A JWT access token and a refresh token are issued (`generateToken` / `generateRefreshToken`).
5. The refresh token is stored in the `RefreshToken` table with a 30-day expiry.
6. Response: JWT in the body + refresh token as an `HttpOnly` cookie.

### Login

`POST /api/auth/login` — body: `{ email, password }`

1. User is looked up by email (lowercased).
2. Password is verified via `verifyPassword` (`bcryptjs.compare`).
3. On success, a new JWT and refresh token are issued (same mechanism as registration).
4. Refresh token cookie: `HttpOnly`, `Secure` in production, `SameSite=Lax`, 30-day expiry.

### JWT Access Token

| Property | Value |
|----------|-------|
| Library  | `jsonwebtoken` |
| Secret   | `JWT_SECRET` env variable |
| Expiry   | `1h` (`JWT_EXPIRATION` in `lib/auth.ts`) |
| Storage  | `localStorage` under the key `token` |
| Usage    | `Authorization: Bearer <token>` on every authenticated request |

Payload:
```json
{
  "userId": "...",
  "email": "user@example.com",
  "walletAddress": "GABC...XYZ"
}
```

### Refresh Token Rotation

`POST /api/auth/refresh`

The `rotateRefreshToken` function in `lib/auth.ts`:
1. Reads the `refreshToken` `HttpOnly` cookie server-side.
2. Looks up the token in the `RefreshToken` table and checks it has not expired.
3. Deletes the old token and creates a new one in a single Prisma transaction (atomic rotation).
4. Returns the new token in the cookie and a new JWT in the response body.

Old refresh tokens are immediately invalidated on use, preventing replay attacks.

### Logout

`POST /api/auth/logout`

1. `revokeRefreshToken` deletes the token from the database.
2. The `refreshToken` cookie is cleared.

### Token Extraction & Validation

All protected API routes use these helpers from `lib/auth.ts`:

```ts
// Extract token from "Authorization: Bearer <token>" header
extractToken(authHeader: string | null): string | null

// Verify and decode the JWT; returns null if invalid or expired
verifyToken(token: string): JWTPayload | null
```

---

## Part 2: Wallet Signature Authentication

Proves ownership of a Stellar wallet address without storing any private key.

### Step 1 — Get a Nonce

```http
GET /api/auth/wallet/nonce
Authorization: Bearer <jwt>
```

- Server generates a UUID nonce via `crypto.randomUUID()`.
- Nonce is saved to `User.nonce` in the database and returned to the client.

### Step 2 — Sign the Nonce

The client uses the Freighter wallet extension (`lib/wallet-context.tsx`):

```ts
const signedXdr = await freighter.signTransaction(nonce, STELLAR_CONFIG.networkPassphrase);
```

The result is a base64-encoded Ed25519 signature of the nonce bytes.

### Step 3 — Verify the Signature

```http
POST /api/auth/wallet/verify
Authorization: Bearer <jwt>

{
  "address": "GABC...XYZ",
  "signature": "<base64-signature>",
  "nonce": "550e8400-e29b-41d4-a716-446655440000"
}
```

Server-side (`app/api/auth/wallet/verify/route.ts`):
1. Retrieves the user and checks `User.nonce` matches the submitted nonce.
2. Verifies the signature:
   ```ts
   Keypair.fromPublicKey(address).verify(
     Buffer.from(nonce),
     Buffer.from(signature, 'base64')
   )
   ```
3. On success: sets `User.walletAddress`, `User.isWalletVerified = true`, and `User.nonce = null`.

### Security Properties

- **Nonce is single-use**: nullified immediately after successful verification — cannot be replayed.
- **Nonce is user-scoped**: stored per user in the database; cannot be used by another user.
- **Signature is cryptographically verified**: Ed25519 via the Stellar SDK.
- **JWT required**: wallet verification endpoints require a valid JWT, so the wallet is always linked to an authenticated account.

---

## Part 3: WalletContext (Frontend)

`lib/wallet-context.tsx` provides a React context for wallet state throughout the app.

### Context Interface

```ts
interface WalletContextType {
  walletAddress: string | null;  // Connected Stellar public key
  publicKey: string | null;      // Same as walletAddress
  isConnected: boolean;          // true when walletAddress is set
  isLoading: boolean;            // true during connect/sign operations
  error: string | null;          // Last error message
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  signTransaction: (transactionXdr: string) => Promise<string>;
}
```

### `connectWallet()`

1. Checks for `window.freighter`.
2. Calls `freighter.getPublicKey()` to get the user's Stellar address.
3. Validates the address with `isValidStellarAddress` from `lib/stellar-config.ts`.
4. Saves the address to `localStorage` under `walletAddress`.
5. Calls `PATCH /api/users/update-wallet` to persist the address to the database.

### `signTransaction(transactionXdr)`

Calls `freighter.signTransaction(xdr, networkPassphrase)` and returns the signed XDR string.

### `disconnectWallet()`

Clears state and removes `walletAddress` from `localStorage`.

### On Mount

Checks `window.freighter.getPublicKey()` to restore a previously connected wallet session.

---

## Part 4: Stellar Address Validation

`lib/stellar-config.ts` exports:

```ts
isValidStellarAddress(address: string): boolean
```

Uses `StellarSdk.StrKey.decodeEd25519PublicKey(address)` — throws if the address is invalid, returns `true` if valid.
