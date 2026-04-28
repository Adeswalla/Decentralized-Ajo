# Emergency Dissolution - Quick Reference

## For Organizers

### How to Dissolve a Circle

1. Navigate to your circle's detail page
2. Scroll to the "Admin Controls" section
3. Click "Dissolve Circle" button in the Danger Zone
4. Read the dissolution details carefully
5. Type "DELETE" in the confirmation box
6. Click "Dissolve Circle" to confirm

### What Happens

- Circle status changes to DISSOLVED
- All active members are exited
- Each member gets a refund: `totalContributed - totalWithdrawn`
- No penalty applied (0% fee)
- All members receive notifications
- You're redirected to the dashboard

### Example Refund Calculation

```
Member A:
  Contributed: $1,000
  Withdrawn:   $200
  Refund:      $800 ✅

Member B:
  Contributed: $1,000
  Withdrawn:   $0
  Refund:      $1,000 ✅

Member C:
  Contributed: $500
  Withdrawn:   $500
  Refund:      $0 (already withdrew everything)
```

## For Developers

### API Endpoint

```bash
POST /api/circles/{circleId}/admin/dissolve
Authorization: Bearer {token}
Content-Type: application/json

{
  "proposalId": "optional-proposal-id",
  "reason": "optional-reason"
}
```

### Response

```json
{
  "success": true,
  "message": "Circle dissolved successfully",
  "data": {
    "remainingPool": 1800,
    "refunds": [
      {
        "userId": "user-1",
        "email": "user1@example.com",
        "name": "John Doe",
        "amount": 800,
        "withdrawalId": "withdrawal-1"
      }
    ]
  }
}
```

### Smart Contract

```solidity
// Dissolve circle and refund all members
function dissolveCircle(uint256 _circleId) external;

// Events emitted
event CircleDissolved(uint256 indexed circleId, address indexed initiator, uint256 remainingPool);
event MemberRefunded(uint256 indexed circleId, address indexed member, uint256 amount);
```

### Database Changes

```sql
-- Circle status
UPDATE circles SET status = 'DISSOLVED' WHERE id = ?;

-- Member status
UPDATE circle_members SET status = 'EXITED', left_at = NOW() WHERE circle_id = ?;

-- Create refund withdrawals
INSERT INTO withdrawals (circle_id, user_id, amount, penalty_percentage, status)
VALUES (?, ?, ?, 0, 'APPROVED');
```

## For Testing

### Run Tests

```bash
npm test app/api/circles/[id]/admin/dissolve/route.test.ts
```

### Test Scenarios

1. ✅ Successful dissolution with multiple members
2. ✅ Already dissolved rejection
3. ✅ Unauthorized user rejection
4. ✅ Zero penalty verification
5. ✅ Correct refund calculations

## Key Differences: Dissolution vs Early Withdrawal

| Feature | Early Withdrawal | Emergency Dissolution |
|---------|-----------------|----------------------|
| Penalty | 10% | 0% |
| Authorization | Member | Organizer or Unanimous Vote |
| Circle Status | Remains ACTIVE | Changes to DISSOLVED |
| Member Status | Remains ACTIVE | Changes to EXITED |
| Scope | Individual | All members |
| Reversible | No | No |

## Security Notes

- ✅ Organizer-only authorization (or unanimous vote)
- ✅ Reentrancy protection in smart contract
- ✅ Atomic database transactions
- ✅ Rate limiting applied
- ✅ Full audit trail with logging
- ✅ All members notified

## Troubleshooting

### "Circle is already dissolved"
The circle has already been dissolved. Check circle status.

### "Only the organizer or a unanimous vote can dissolve"
You must be the organizer or have a passed unanimous dissolution proposal.

### "Circle not found"
Invalid circle ID. Verify the circle exists.

### Refund not showing
Check the withdrawals table for approved withdrawal records. Refunds are created as approved withdrawals.

## Related Documentation

- Full Documentation: `docs/EMERGENCY_DISSOLUTION.md`
- Implementation Summary: `EMERGENCY_DISSOLUTION_IMPLEMENTATION.md`
- Governance System: `docs/GOVERNANCE_SYSTEM.md`
- Withdrawal System: `docs/WITHDRAWAL_SYSTEM.md`
