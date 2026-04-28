# Multisig Withdrawal - Quick Start Guide

## Setup (5 minutes)

### 1. Run Database Migration

```bash
npx prisma migrate dev --name add_multisig_support
```

Or if you prefer to push directly:

```bash
npx prisma db push
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

## Usage

### For Circle Organizers

#### Step 1: Enable Multisig

```typescript
// Configure multisig for your circle
const response = await fetch(`/api/circles/${circleId}/multisig`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    multisigEnabled: true,
    multisigThreshold: 1000000000, // 100 XLM in stroops
    requiredApprovals: 2,
    approvers: [userId1, userId2, userId3] // User IDs of trusted members
  })
});
```

#### Step 2: Monitor Withdrawals

```typescript
// Get all pending withdrawals
const response = await fetch(`/api/circles/${circleId}/withdraw`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { withdrawals } = await response.json();
```

### For Circle Members

#### Request a Withdrawal

```typescript
// Request withdrawal
const response = await fetch(`/api/circles/${circleId}/withdraw`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 5000000000, // 500 XLM in stroops
    reason: 'Emergency medical expense'
  })
});

const { withdrawal, requiresMultisig, requiredApprovals } = await response.json();

if (requiresMultisig) {
  console.log(`Withdrawal requires ${requiredApprovals} approvals`);
}
```

### For Approvers

#### Approve or Reject Withdrawal

```typescript
// Approve withdrawal
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
      comment: 'Verified documentation, approved'
    })
  }
);

const { status } = await response.json();
console.log(`Approvals: ${status.approvedCount}/${status.requiredApprovals}`);
```

## UI Components

### Add to Circle Detail Page

```tsx
import MultisigConfig from './components/MultisigConfig';
import WithdrawalManager from './components/WithdrawalManager';

export default function CircleDetailPage({ circleId, userId, isOrganizer }) {
  return (
    <div className="space-y-6">
      {/* Existing circle components */}
      
      {/* Multisig Configuration (Organizer only) */}
      {isOrganizer && (
        <MultisigConfig
          circleId={circleId}
          members={circleMembers}
          isOrganizer={isOrganizer}
        />
      )}
      
      {/* Withdrawal Manager */}
      <WithdrawalManager
        circleId={circleId}
        userId={userId}
        availableBalance={memberBalance}
        isApprover={isApprover}
      />
    </div>
  );
}
```

## Testing

### Run Tests

```bash
npm test __tests__/api/multisig.test.ts
```

### Manual Testing Flow

1. **Setup Circle**
   - Create a circle with 5+ members
   - Configure multisig: threshold = 100 XLM, required = 2 approvals
   - Designate 3 members as approvers

2. **Test Low-Value Withdrawal**
   - Member requests 50 XLM withdrawal
   - Should auto-approve (below threshold)
   - Status: APPROVED immediately

3. **Test High-Value Withdrawal**
   - Member requests 500 XLM withdrawal
   - Should require multisig (above threshold)
   - Status: PENDING

4. **Test Approval Flow**
   - Approver 1 approves → Status: PENDING (1/2)
   - Approver 2 approves → Status: APPROVED (2/2)
   - Auto-approved when threshold met

5. **Test Rejection**
   - Member requests 300 XLM withdrawal
   - Approver 1 rejects with comment
   - Withdrawal remains PENDING (can still be approved by others)

## Common Scenarios

### Scenario 1: Small Circle (5 members)
```json
{
  "multisigEnabled": true,
  "multisigThreshold": 500000000,
  "requiredApprovals": 2,
  "approvers": ["organizer", "member1", "member2"]
}
```

### Scenario 2: Medium Circle (15 members)
```json
{
  "multisigEnabled": true,
  "multisigThreshold": 1000000000,
  "requiredApprovals": 3,
  "approvers": ["organizer", "m1", "m2", "m3", "m4"]
}
```

### Scenario 3: Large Circle (30 members)
```json
{
  "multisigEnabled": true,
  "multisigThreshold": 2000000000,
  "requiredApprovals": 4,
  "approvers": ["organizer", "m1", "m2", "m3", "m4", "m5", "m6"]
}
```

## Security Checklist

- ✅ Only organizer can configure multisig
- ✅ Only designated approvers can vote
- ✅ Each approver can vote only once
- ✅ Organizer is always an implicit approver
- ✅ Balance validation before withdrawal
- ✅ No duplicate pending withdrawals
- ✅ Atomic approval counting
- ✅ Complete audit trail

## Troubleshooting

### Issue: "Not authorized to approve"
**Solution**: Verify user is in the approvers list or is the organizer

### Issue: "Already voted on this withdrawal"
**Solution**: Each approver can only vote once per withdrawal

### Issue: "Required approvals cannot exceed number of approvers"
**Solution**: Reduce requiredApprovals or add more approvers

### Issue: Withdrawal stuck in PENDING
**Solution**: Check if enough approvers are configured and active

## Next Steps

1. ✅ Database migration complete
2. ✅ API endpoints ready
3. ✅ UI components created
4. ⏳ Add to circle detail page
5. ⏳ Test with real users
6. ⏳ Monitor and adjust thresholds

## Support

For detailed documentation, see [MULTISIG_IMPLEMENTATION.md](./MULTISIG_IMPLEMENTATION.md)
