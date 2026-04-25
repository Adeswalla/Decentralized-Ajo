# Joining a Circle

This document covers the end-to-end flow for joining a savings circle — from the preview step through to membership confirmation — including API behaviour, UI pages, and the rules that govern who can join.

---

## Join Flow Overview

```
User visits /circles/join
        |
        v
Enters circle ID → GET /api/circles/:id/join  (preview)
        |
        v
Reviews circle details and member count
        |
        v
Clicks "Confirm Join" → POST /api/circles/:id/join
        |
        v
Redirected to /circles/:id  (circle detail page)
```

---

## GET /api/circles/:id/join — Preview

Returns circle details so the user can review before committing to join.

**Headers**

| Header          | Value              |
|-----------------|--------------------|
| `Authorization` | `Bearer <token>`   |

**Success Response — 200**

```json
{
  "success": true,
  "circle": {
    "id": "...",
    "name": "Office Team Savings",
    "description": "Monthly savings circle",
    "contributionAmount": 100,
    "contributionFrequencyDays": 7,
    "maxRounds": 12,
    "currentRound": 1,
    "status": "ACTIVE",
    "organizer": {
      "firstName": "Alice",
      "lastName": "Johnson",
      "email": "alice@example.com"
    },
    "members": [{ "id": "..." }, { "id": "..." }]
  },
  "alreadyMember": false
}
```

The `alreadyMember` flag tells the UI whether to show the **Confirm Join** button or a "you're already a member" message.

**Error Responses**

| Status | Condition              |
|--------|------------------------|
| `401`  | No or invalid token    |
| `404`  | Circle not found       |

---

## POST /api/circles/:id/join — Join

Adds the authenticated user to the circle as a new member.

**Headers**

| Header          | Value              |
|-----------------|--------------------|
| `Authorization` | `Bearer <token>`   |

No request body is required.

**What happens**

1. Verifies the circle exists.
2. Checks the user is not already a member — returns `409 Conflict` if they are.
3. Checks the circle status is `ACTIVE` or `PENDING` — returns `403` if `COMPLETED` or `CANCELLED`.
4. Checks the current member count has not reached the maximum of **50 members** — returns `403` if at capacity.
5. Creates a `CircleMember` record with `rotationOrder = circle.members.length + 1`.

**Success Response — 201**

```json
{
  "success": true,
  "member": {
    "id": "...",
    "circleId": "...",
    "userId": "...",
    "rotationOrder": 4,
    "status": "ACTIVE",
    "totalContributed": 0,
    "totalWithdrawn": 0,
    "hasReceivedPayout": false,
    "user": {
      "id": "...",
      "email": "user@example.com",
      "firstName": "Jane",
      "lastName": "Doe"
    }
  }
}
```

**Error Responses**

| Status | Condition                              |
|--------|----------------------------------------|
| `401`  | No or invalid token                    |
| `403`  | Circle is `COMPLETED` or `CANCELLED`   |
| `403`  | Circle has reached the 50-member cap   |
| `404`  | Circle not found                       |
| `409`  | User is already a member               |

---

## Rotation Order Assignment

When a member joins, their `rotationOrder` is set to `circle.members.length + 1` at the time of joining. This means:

- The **organizer** always has `rotationOrder: 1` (set at circle creation).
- The first member to join after the organizer gets `rotationOrder: 2`.
- The second gets `rotationOrder: 3`, and so on.

> **Note on on-chain rotation:** If `shuffle_rotation()` is called on the Soroban smart contract before round 1 begins, the on-chain rotation order is randomised independently of the database `rotationOrder` values. The database values reflect the join order; the contract values reflect the shuffled payout schedule.

---

## Join Page — `/circles/join`

The join page (`app/circles/join/page.tsx`) allows users to enter a circle ID and join it. It uses the preview endpoint to show circle details before the user confirms.

**Behaviour**

- If the URL contains a `?id=` query parameter (e.g. from an invite link), the preview is fetched automatically on page load.
- The user can also paste a circle ID into the input field and click **Look Up** to trigger the preview manually.
- Once the preview loads, the page shows:
  - Circle name, description, and status badge.
  - Contribution amount per round, current member count, and round progress.
  - Organizer name and contribution frequency.
- If `alreadyMember` is `true`, a **View Circle** button is shown instead of **Confirm Join**.
- If the circle status is not `ACTIVE` or `PENDING`, a message is shown indicating the circle is not accepting new members.
- On a successful join, the user is redirected to `/circles/:id`.

A `joinRequestInFlightRef` guard prevents duplicate POST requests if the user clicks the button multiple times.

---

## Circle Detail Page — Non-Member View

When a user visits `/circles/:id` but is not a member (and is not the organizer), the **Overview** tab shows:

```
You are not a member of this circle yet.
[Join This Circle]  →  links to /circles/:id/join
```

Members and the organizer see the full circle information and contribution form instead.

---

## On-Chain Counterpart

Joining a circle off-chain via the API does **not** automatically register the member on-chain. The organizer must separately call `add_member(organizer, newMemberAddress)` on the Soroban contract to register the member for on-chain contributions and payouts.

This is a known gap between off-chain and on-chain state. Bridging this automatically is tracked as a future integration task.

**On-chain membership rules (from the contract)**

- `circle.member_count` must be less than `circle.max_members` at the time `add_member` is called.
- The default `max_members` is `50`; the absolute hard cap is `100`.
- If `max_members = 0` is passed at circle initialisation, the contract defaults to `50`.
- Attempting to add a member beyond capacity returns `Err(AjoError::CircleAtCapacity)`.
