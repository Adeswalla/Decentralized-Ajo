# Multisig Authorization for High-Value Payouts

## Overview

This implementation adds multi-signature (multisig) authorization for high-value withdrawals from circles. When enabled, withdrawals exceeding a configured threshold require approval from multiple authorized signers before being processed.

## Features

- **Configurable Threshold**: Set a custom amount above which multisig is required
- **M-of-N Authorization**: Require M approvals from N authorized approvers
- **Flexible Approver Management**: Organizers can designate which members can approve
- **Automatic Processing**: Withdrawals auto-approve once threshold is met
- **Audit Trail**: Complete history of all approvals and rejections
- **Backward Compatible**: Works alongside existing withdrawal system

## Database Schema

### New Tables

#### WithdrawalApproval
Tracks individual approval/rejection votes for withdrawals.

```prisma
model WithdrawalApproval {
  id          String   @id @default(cuid())
  withdrawalId String
  withdrawal  Withdrawal @relation(fields: [withdrawalId], references: [id])
  approverId  String
  approver    User @relation(fields: [approverId], references: [id])
  approved    Boolean
  comment     String?
  createdAt   DateTime @default(now())
  
  @@unique([withdrawalId, approverId])
}
```

### Updated Tables

#### Circle
Added multisig configuration fields:

- `multisigEnabled`: Boolean flag to enable/disable multisig
- `multisigThreshold`: Amount above which multisig is required
- `requiredApprovals`: Number of approvals needed (M in M-of-N)
- `approvers`: JSON array of user IDs who can approve (N in M-of-N)

## API Endpoints

### 1. Request Withdrawal

**POST** `/api/circles/[id]/withdraw`

Request a withdrawal from a circle. Automatically determines if multisig is required.

**Request Body:**
```json
{
  "amount": 5000000,
  "reason": "Emergency expense"
}
```

**Response:**
```json
{
  "withdrawal": {
    "id": "clx...",
    "amount": 4500000,
    "requestedAmount": 5000000,
    "status": "PENDING",
    "penaltyPercentage": 10
  },
  "requiresMultisig": true,
  "requiredApprovals": 2,
  "penalty": 500000,
  "finalAmount": 4500000
}
```

### 2. Get Withdrawals

**GET** `/api/circles/[id]/withdraw`

Get withdrawal requests. Members see their own, approvers see all.

**Response:**
```json
{
  "withdrawals": [
    {
      "id": "clx...",
      "amount": 4500000,
      "status": "PENDING",
      "user": {
        "id": "user123",
        "email": "user@example.com",
        "firstName": "John"
      },
      "approvals": [
        {
          "approverId": "approver1",
          "approved": true,
          "comment": "Approved",
          "createdAt": "2024-01-15T10:00:00Z"
        }
      ]
    }
  ]
}
```

### 3. Approve/Reject Withdrawal

**POST** `/api/circles/[id]/withdraw/[withdrawalId]/approve`

Approve or reject a pending withdrawal (approvers only).

**Request Body:**
```json
{
  "approved": true,
  "comment": "Verified and approved"
}
```

**Response:**
```json
{
  "approval": {
    "id": "clx...",
    "approved": true,
    "comment": "Verified and approved"
  },
  "status": {
    "approvedCount": 2,
    "rejectedCount": 0,
    "requiredApprovals": 2,
    "isApproved": true
  },
  "withdrawal": {
    "id": "clx...",
    "status": "APPROVED",
    "amount": 4500000
  }
}
```

### 4. Get Multisig Configuration

**GET** `/api/circles/[id]/multisig`

Get current multisig settings for a circle.

**Response:**
```json
{
  "multisigEnabled": true,
  "multisigThreshold": 1000000,
  "requiredApprovals": 2,
  "approvers": ["user1", "user2", "user3"],
  "isOrganizer": true
}
```

### 5. Update Multisig Configuration

**PUT** `/api/circles/[id]/multisig`

Update multisig settings (organizer only).

**Request Body:**
```json
{
  "multisigEnabled": true,
  "multisigThreshold": 1000000,
  "requiredApprovals": 2,
  "approvers": ["user1", "user2", "user3"]
}
```

## Usage Examples

### Example 1: Enable Multisig for Circle

```typescript
// Configure multisig requiring 2 of 3 approvers for amounts > 1M
const response = await fetch(`/api/circles/${circleId}/multisig`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    multisigEnabled: true,
    multisigThreshold: 1000000, // 1M stroops
    requiredApprovals: 2,
    approvers: [userId1, userId2, userId3]
  })
});
```

### Example 2: Request High-Value Withdrawal

```typescript
// Request withdrawal that requires multisig
const response = await fetch(`/api/circles/${circleId}/withdraw`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 5000000, // 5M stroops
    reason: 'Emergency medical expense'
  })
});

const { withdrawal, requiresMultisig, requiredApprovals } = await response.json();
// requiresMultisig: true
// requiredApprovals: 2
// withdrawal.status: "PENDING"
```

### Example 3: Approve Withdrawal

```typescript
// Approver votes on withdrawal
const response = await fetch(
  `/api/circles/${circleId}/withdraw/${withdrawalId}/approve`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${approverToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      approved: true,
      comment: 'Verified emergency expense documentation'
    })
  }
);

const { status } = await response.json();
// status.approvedCount: 1
// status.requiredApprovals: 2
// status.isApproved: false (needs one more approval)
```

### Example 4: Check Withdrawal Status

```typescript
// Get all withdrawals (as approver)
const response = await fetch(`/api/circles/${circleId}/withdraw`, {
  headers: {
    'Authorization': `Bearer ${approverToken}`
  }
});

const { withdrawals } = await response.json();
withdrawals.forEach(w => {
  console.log(`Withdrawal ${w.id}: ${w.status}`);
  console.log(`Approvals: ${w.approvals.length}`);
});
```

## Security Features

### 1. Authorization Checks
- Only circle members can request withdrawals
- Only designated approvers can vote on withdrawals
- Organizer is always an implicit approver
- Each approver can vote only once per withdrawal

### 2. Balance Validation
- Validates sufficient balance before creating withdrawal
- Prevents multiple pending withdrawals per user
- Applies withdrawal penalty (10% by default)

### 3. Atomic Operations
- Uses database transactions for consistency
- Auto-approval when threshold is met
- Prevents race conditions in approval counting

### 4. Audit Trail
- Complete history of all approvals/rejections
- Timestamps for all actions
- Optional comments for transparency

## Configuration Best Practices

### Threshold Setting
- Set threshold based on circle's typical contribution amount
- Example: For 100 XLM contributions, set threshold at 500 XLM (5x)
- Consider circle size and risk tolerance

### Approver Selection
- Choose trusted, active members
- Minimum 3 approvers recommended for redundancy
- Include organizer and senior members

### Required Approvals
- **2-of-3**: Good for small circles (5-10 members)
- **3-of-5**: Recommended for medium circles (10-20 members)
- **4-of-7**: Suitable for large circles (20+ members)

### Example Configurations

#### Small Circle (5 members)
```json
{
  "multisigEnabled": true,
  "multisigThreshold": 500000000, // 50 XLM
  "requiredApprovals": 2,
  "approvers": ["organizer", "member1", "member2"]
}
```

#### Medium Circle (15 members)
```json
{
  "multisigEnabled": true,
  "multisigThreshold": 1000000000, // 100 XLM
  "requiredApprovals": 3,
  "approvers": ["organizer", "member1", "member2", "member3", "member4"]
}
```

#### Large Circle (30 members)
```json
{
  "multisigEnabled": true,
  "multisigThreshold": 2000000000, // 200 XLM
  "requiredApprovals": 4,
  "approvers": ["organizer", "m1", "m2", "m3", "m4", "m5", "m6"]
}
```

## Migration

Run the database migration to add multisig support:

```bash
npx prisma migrate dev --name add_multisig_support
```

Or apply manually:

```bash
npx prisma db push
```

## Testing

### Unit Tests
Test the multisig service functions:

```typescript
import { checkMultisigRequired, processApproval } from '@/lib/services/multisig';

// Test multisig check
const result = await checkMultisigRequired(circleId, 5000000);
expect(result.requiresMultisig).toBe(true);
expect(result.requiredApprovals).toBe(2);

// Test approval processing
const approval = await processApproval(withdrawalId, approverId, true);
expect(approval.status.approvedCount).toBe(1);
```

### Integration Tests
Test the complete withdrawal flow:

1. Configure multisig for circle
2. Request high-value withdrawal
3. Verify status is PENDING
4. Submit approvals from multiple approvers
5. Verify auto-approval when threshold met

## Monitoring

### Key Metrics
- Pending withdrawal count
- Average approval time
- Rejection rate
- Threshold breach frequency

### Logging
All operations are logged with:
- Withdrawal ID
- User/Approver ID
- Action taken
- Timestamps

## Future Enhancements

1. **Time-based Auto-approval**: Auto-approve after X hours if no rejections
2. **Weighted Voting**: Different approvers have different vote weights
3. **Rejection Threshold**: Auto-reject if too many rejections
4. **Notification System**: Alert approvers of pending withdrawals
5. **Blockchain Integration**: Record approvals on-chain for transparency
6. **Emergency Override**: Allow organizer to override in emergencies

## Troubleshooting

### Withdrawal Stuck in PENDING
- Check if enough approvers are configured
- Verify approvers are active members
- Check approval count vs required approvals

### Cannot Approve Withdrawal
- Verify user is in approvers list
- Check if user already voted
- Ensure withdrawal is still PENDING

### Configuration Update Fails
- Verify user is organizer
- Check all approvers are circle members
- Ensure requiredApprovals ≤ approver count

## Support

For issues or questions:
1. Check logs for error details
2. Verify database schema is up to date
3. Review API response error messages
4. Contact development team with withdrawal ID
