# Circle Update and Detail API

## Overview

This document explains the circle update flow: how organizers can modify circle metadata and status after creation, which fields are editable, and what access control rules apply.

## PUT /api/circles/:id

Updates an existing circle. Only the organizer can call this endpoint.

Headers:

- Authorization: Bearer

Request body (validated by UpdateCircleSchema in lib/validations/circle.ts):

```json
{
  "name": "Updated Circle Name",
  "description": "Updated description",
  "status": "COMPLETED"
}
```

All fields are optional. Only provided fields are updated. Omitted fields retain their current values.

### Validation Rules

| Field | Rule |
|---|---|
| name | Optional, 3-50 characters |
| description | Optional, max 500 characters |
| status | Optional, one of PENDING, ACTIVE, COMPLETED, CANCELLED |

### Access Control

Only the circle organizer can update the circle. Any other authenticated user receives 403 Forbidden.

### Success Response (200)

```json
{
  "success": true,
  "circle": {
    "id": "...",
    "name": "Updated Circle Name",
    "description": "Updated description",
    "status": "COMPLETED",
    "organizerId": "...",
    "organizer": {
      "id": "...",
      "email": "...",
      "firstName": "...",
      "lastName": "..."
    },
    "members": [
      "..."
    ]
  }
}
```

### Error Responses

| Status | Condition |
|---|---|
| 400 | Validation failed |
| 401 | No or invalid token |
| 403 | Authenticated user is not the organizer |
| 404 | Circle not found |

## GET /api/circles/:id

Returns full circle details. Accessible to the organizer or any circle member.

Headers:

- Authorization: Bearer

Response includes:

- Full circle fields including contractAddress and contractDeployed.
- organizer: id, email, firstName, lastName, walletAddress.
- members: each with full user details and walletAddress.
- contributions: ordered by createdAt descending, each with user name.
- payments: payment schedule ordered by dueDate ascending.

Access control: returns 403 Forbidden if the authenticated user is neither the organizer nor a member.

## What Cannot Be Changed

The following fields are set at creation and cannot be updated via this API:

| Field | Reason |
|---|---|
| contributionAmount | Changing this mid-circle breaks payout math and member expectations |
| contributionFrequencyDays | Affects round schedule and requires governance proposal |
| maxRounds | Determines circle duration and cannot be shortened or extended |
| organizerId | Circle ownership cannot be transferred via this endpoint |
| contractAddress | Set when the smart contract is deployed |

Changes to contributionAmount or contributionFrequencyDays should go through governance using a CONTRIBUTION_ADJUSTMENT or RULE_CHANGE proposal.

## Status Transitions

The organizer can manually set circle status. Recommended transitions:

| From | To | When |
|---|---|---|
| PENDING | ACTIVE | When enough members have joined and the circle is ready to start |
| ACTIVE | COMPLETED | When all rounds have finished |
| ACTIVE | CANCELLED | When the circle needs to be shut down without completing |
| PENDING | CANCELLED | When the circle is abandoned before starting |

Note: setting status to CANCELLED does not automatically trigger refunds. Refunds must be handled separately via smart contract functions dissolve_and_refund or emergency_refund.

## Example curl

```bash
# Update circle name and description
curl -X PUT http://localhost:3000/api/circles/<circle-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Name", "description": "Updated description"}'

# Mark circle as completed
curl -X PUT http://localhost:3000/api/circles/<circle-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "COMPLETED"}'

# Get circle details
curl http://localhost:3000/api/circles/<circle-id> \
  -H "Authorization: Bearer <token>"
```
