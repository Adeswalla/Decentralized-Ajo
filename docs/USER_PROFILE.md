# User Profile System

This document covers the user profile data model, API endpoints, validation rules, and the profile form component.

## Profile Fields

The following fields are stored on the `User` model and exposed via the profile API:

| Field            | Type     | Editable        | Notes                                              |
|------------------|----------|-----------------|----------------------------------------------------|
| `id`             | string   | No              | CUID, set on creation                              |
| `email`          | string   | No              | Set on registration, unique                        |
| `firstName`      | string   | Yes             | 2–50 characters                                    |
| `lastName`       | string   | Yes             | 2–50 characters                                    |
| `bio`            | string   | Yes             | Max 160 characters                                 |
| `phoneNumber`    | string   | Yes             | Max 20 characters                                  |
| `profilePicture` | string   | No*             | URL, not yet editable via API                      |
| `walletAddress`  | string   | Via wallet flow | Set via `PATCH /api/users/update-wallet`           |
| `createdAt`      | datetime | No              | Set on creation                                    |

> \* `profilePicture` is stored in the schema but not yet exposed for update via the profile endpoint.

---

## API Endpoints

### GET /api/users/profile

Returns the authenticated user's profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response `200`:**
```json
{
  "success": true,
  "user": {
    "id": "clxxx...",
    "email": "alice@example.com",
    "firstName": "Alice",
    "lastName": "Johnson",
    "bio": "Saving for the future.",
    "phoneNumber": "+1234567890",
    "profilePicture": null,
    "walletAddress": "GABC...XYZ",
    "createdAt": "2026-01-15T08:00:00.000Z"
  }
}
```

> Note: `password` is never included in the response. The route uses an explicit `select` object that excludes it.

---

### PUT /api/users/profile

Updates the authenticated user's profile. All fields are optional — only provided fields are updated.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body** (validated by `UpdateProfileSchema`, strict mode — no extra fields allowed):
```json
{
  "firstName": "Alice",
  "lastName": "Johnson",
  "bio": "Saving for the future.",
  "phoneNumber": "+1234567890"
}
```

**Validation Rules:**

| Field         | Rules                                    |
|---------------|------------------------------------------|
| `firstName`   | Optional, trimmed, 2–50 characters       |
| `lastName`    | Optional, trimmed, 2–50 characters       |
| `bio`         | Optional, trimmed, max 160 characters    |
| `phoneNumber` | Optional, trimmed, max 20 characters     |

> Strict mode: Any extra fields in the request body will cause a `400 Validation failed` error. Only the four fields above are accepted.

**Success Response `200`:**
```json
{
  "success": true,
  "user": { ...updated user object... }
}
```

**Error Responses:** `400` validation failed, `401` unauthorized, `404` user not found.

---

### PATCH /api/users/update-wallet

Associates a Stellar wallet address with the user account. This is called automatically by `WalletContext.connectWallet()` after the user connects their Freighter wallet.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "walletAddress": "GABC...XYZ"
}
```

**Validation:** `walletAddress` must be a non-empty string. Full Stellar address format validation is handled by `isValidStellarAddress` in `lib/stellar-config.ts` before this endpoint is called.

**Success Response `200`:**
```json
{
  "success": true
}
```

---

## Profile Form Component

**File:** `components/profile-form.tsx`  
**Route:** `/profile`

The `ProfileForm` component renders the profile edit form. It:

- Pre-fills fields with the current user data fetched from `GET /api/users/profile`
- Submits changes via `PUT /api/users/profile`
- Shows a success toast on save

---

## Example curl Commands

```bash
# Get profile
curl http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer <token>"

# Update profile
curl -X PUT http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Alice", "bio": "Saving for the future."}'

# Update wallet address
curl -X PATCH http://localhost:3000/api/users/update-wallet \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "GABC...XYZ"}'
```
