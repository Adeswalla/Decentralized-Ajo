# Emergency Circle Dissolution

## Overview

The emergency dissolution mechanism allows circles to be dissolved in extreme cases, with all remaining funds distributed back to members based on their contribution history. This feature is designed to handle disputes, emergencies, or situations where the circle cannot continue normal operations.

## Triggering Mechanisms

### 1. Organizer Override
The circle organizer can trigger an emergency dissolution at any time through the admin panel.

**Authorization**: Organizer only

**Process**:
1. Navigate to circle admin panel
2. Click "Dissolve Circle" in the Danger Zone
3. Type "DELETE" to confirm
4. System automatically calculates and distributes refunds

### 2. Unanimous Vote (Future Enhancement)
A 100% unanimous vote from all active members can trigger dissolution.

**Authorization**: All active members must vote YES

**Process**:
1. Create an EMERGENCY_DISSOLUTION proposal
2. All members vote
3. If unanimous approval, dissolution can be executed
4. Any member or organizer can execute the dissolution

## Fund Distribution

### Calculation Method

Each member receives a refund based on their net contribution:

```
Refund Amount = totalContributed - totalWithdrawn
```

### Key Features

- **No Penalty**: Unlike early withdrawals (10% penalty), dissolution refunds have 0% penalty
- **Proportional Distribution**: Each member gets exactly what they put in minus what they already withdrew
- **Automatic Processing**: Refunds are created as approved withdrawals automatically
- **Full Transparency**: All refund amounts are logged and visible

### Example

Circle with 3 members:
- Member A: Contributed $1000, Withdrew $200 → Refund: $800
- Member B: Contributed $1000, Withdrew $0 → Refund: $1000
- Member C: Contributed $500, Withdrew $500 → Refund: $0

Total Pool Distributed: $1800

## State Changes

When a circle is dissolved:

1. **Circle Status**: Changed from ACTIVE/PENDING to DISSOLVED
2. **Member Status**: All active members changed to EXITED
3. **Member Timestamps**: `leftAt` timestamp set to dissolution time
4. **Withdrawal Records**: Created for each member with net positive contribution
5. **Notifications**: All members receive CIRCLE_DISSOLVED notification
6. **Proposal Status**: If triggered by vote, proposal marked as EXECUTED

## Database Schema

### CircleStatus Enum
```typescript
enum CircleStatus {
  PENDING
  ACTIVE
  COMPLETED
  CANCELLED
  DISSOLVED  // New status
  ACTION_REQUIRED
}
```

### ProposalType Enum
```typescript
enum ProposalType {
  RULE_CHANGE
  MEMBER_REMOVAL
  EMERGENCY_PAYOUT
  EMERGENCY_DISSOLUTION  // New type
  CIRCLE_DISSOLUTION
  CONTRIBUTION_ADJUSTMENT
}
```

## API Endpoint

### POST /api/circles/[id]/admin/dissolve

**Authorization**: Bearer token (organizer or unanimous vote)

**Request Body**:
```json
{
  "proposalId": "optional-proposal-id",
  "reason": "optional-reason-text"
}
```

**Response** (Success):
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
      },
      {
        "userId": "user-2",
        "email": "user2@example.com",
        "name": "Jane Smith",
        "amount": 1000,
        "withdrawalId": "withdrawal-2"
      }
    ]
  }
}
```

**Error Responses**:
- `400`: Circle already dissolved
- `403`: Unauthorized (not organizer and no unanimous vote)
- `404`: Circle not found
- `500`: Internal server error

## Smart Contract Integration

### Solidity Function

```solidity
function dissolveCircle(uint256 _circleId) 
    external 
    circleExists(_circleId)
    nonReentrant 
    whenNotPaused
```

**Features**:
- Reentrancy protection
- Pause-aware (cannot dissolve when paused)
- Organizer-only authorization
- Automatic refund distribution
- Event emission for transparency

**Events**:
```solidity
event CircleDissolved(uint256 indexed circleId, address indexed initiator, uint256 remainingPool);
event MemberRefunded(uint256 indexed circleId, address indexed member, uint256 amount);
```

## Security Considerations

### Authorization
- Organizer has unilateral dissolution power (admin override)
- Unanimous vote provides democratic alternative
- No single non-organizer member can dissolve

### Fund Safety
- All calculations use SafeMath (Solidity)
- Atomic transactions prevent partial failures
- Reentrancy guards prevent exploitation
- Member balances verified before refund

### Audit Trail
- All dissolutions logged with initiator
- Refund amounts recorded in withdrawal table
- Notifications sent to all members
- Blockchain events emitted for on-chain tracking

## User Interface

### Admin Panel
Located in circle detail page, visible only to organizer.

**Features**:
- Clear warning about irreversibility
- Confirmation dialog with "DELETE" typing requirement
- Detailed explanation of what happens
- Visual breakdown of fund distribution
- Success message with refund summary

### Notifications
All members receive:
- In-app notification
- Email notification (if enabled)
- Details about their refund amount
- Link to withdrawal page

## Testing

### Unit Tests
Located in: `app/api/circles/[id]/admin/dissolve/route.test.ts`

**Test Coverage**:
- ✅ Successful dissolution with multiple members
- ✅ Rejection if already dissolved
- ✅ Authorization checks (organizer vs non-organizer)
- ✅ Zero penalty verification
- ✅ Correct refund calculations
- ✅ Notification creation
- ✅ State transitions

### Integration Tests
- End-to-end dissolution flow
- Smart contract interaction
- Database consistency
- Cache invalidation

## Migration

Run the migration to add DISSOLVED status:

```bash
npx prisma migrate deploy
```

Migration file: `prisma/migrations/20260428000000_add_dissolved_status/migration.sql`

## Future Enhancements

1. **Partial Dissolution**: Allow partial refunds while keeping circle active
2. **Dispute Resolution**: Integration with arbitration system
3. **Cooling Period**: Mandatory waiting period before dissolution
4. **Refund Scheduling**: Staggered refunds for large circles
5. **Governance Integration**: More sophisticated voting mechanisms
6. **Multi-sig Approval**: Require multiple organizers for dissolution

## Related Documentation

- [Governance System](./GOVERNANCE_SYSTEM.md)
- [Withdrawal System](./WITHDRAWAL_SYSTEM.md)
- [Circle Lifecycle](./CIRCLE_LIFECYCLE.md)
- [Smart Contract Specification](./CONTRACT_SPECIFICATION.md)
