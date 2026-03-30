# Withdrawal Function Implementation

## Overview

This document describes the implementation of the enhanced `withdraw()` function in the Ajo Circle smart contract, which allows designated winners to withdraw collected pools for specific cycles with comprehensive security checks.

## Implementation Details

### New Function: `withdraw()`

**Location**: `contracts/ajo-circle/src/lib.rs`

**Signature**:
```rust
pub fn withdraw(env: Env, member: Address, cycle: u32) -> Result<i128, AjoError>
```

### Key Features

#### 1. Cycle-to-Recipient Mapping
- Uses the existing `RotationOrder` storage to track which member is designated for each cycle
- Enforces strict rotation order validation
- Prevents unauthorized withdrawals by non-designated members

#### 2. Cycle Maturity Check (Time-Based)
- Implements `get_cycle_deadline()` helper function
- Calculates deadline based on:
  - Initial round deadline
  - Cycle number
  - Frequency in days (converted to seconds)
- Rejects withdrawals before cycle maturity

#### 3. Pool Funding Verification
- Implements `is_cycle_fully_funded()` helper function
- Verifies all members have contributed required amount for the cycle
- Checks: `member.total_contributed >= (cycle * contribution_amount)`
- Ensures pool has sufficient funds before allowing withdrawal

#### 4. Reentrancy Protection
- Follows Checks-Effects-Interactions pattern
- Updates state BEFORE executing token transfer
- Stores withdrawal status in `CycleWithdrawals` mapping
- Prevents double-withdrawal attacks

### Storage Structure

#### New DataKey
```rust
pub enum DataKey {
    // ... existing keys
    /// Tracks withdrawals per cycle: Map<cycle_number, Map<member_address, withdrawn>>
    CycleWithdrawals,
}
```

This nested map structure allows:
- Tracking withdrawals per cycle
- Preventing double withdrawals
- Supporting multiple cycles independently

### Security Measures

1. **Authorization**: Requires member signature via `member.require_auth()`
2. **Panic Protection**: Blocks withdrawals during emergency panic state
3. **Cycle Validation**: Ensures cycle is within valid range (1 to max_rounds)
4. **Member Standing**: Verifies member is active and not disqualified
5. **Rotation Enforcement**: Validates member is designated recipient for cycle
6. **Double-Withdrawal Prevention**: Checks withdrawal history per cycle
7. **State-Before-Transfer**: Updates all state before executing token transfer

### Helper Functions

#### `get_cycle_deadline()`
Calculates the deadline timestamp for a specific cycle:
```rust
fn get_cycle_deadline(env: &Env, cycle: u32) -> Result<u64, AjoError>
```

#### `is_cycle_fully_funded()`
Verifies all members have contributed enough for the cycle:
```rust
fn is_cycle_fully_funded(env: &Env, cycle: u32, required_amount: i128) -> Result<bool, AjoError>
```

### Backward Compatibility

The existing `claim_payout()` function has been refactored to wrap `withdraw()`:
```rust
pub fn claim_payout(env: Env, member: Address) -> Result<i128, AjoError> {
    let circle: CircleData = env.storage().instance().get(&DataKey::Circle)?;
    Self::withdraw(env, member, circle.current_round)
}
```

This ensures:
- Existing integrations continue to work
- All security improvements apply to legacy calls
- Consistent behavior across both functions

## Usage Examples

### Basic Withdrawal
```rust
// Member withdraws for cycle 1
let payout = contract.withdraw(&member_address, &1_u32)?;
```

### Prerequisites
1. Circle must be initialized
2. Rotation order must be shuffled (via `shuffle_rotation()`)
3. Cycle must have matured (time check)
4. Pool must be fully funded
5. Member must be designated recipient for that cycle
6. Member must not have already withdrawn for that cycle

## Testing

Comprehensive test suite added covering:

1. **Happy Path**: Successful withdrawal with all conditions met
2. **Double-Withdrawal Prevention**: Second withdrawal for same cycle fails
3. **Rotation Enforcement**: Wrong member cannot withdraw
4. **Rotation Requirement**: Fails if rotation not set
5. **Cycle Validation**: Invalid cycle numbers rejected
6. **Panic Protection**: Withdrawals blocked during panic
7. **Member Standing**: Inactive members cannot withdraw
8. **Backward Compatibility**: `claim_payout()` still works

### Running Tests

```bash
# Navigate to contract directory
cd contracts/ajo-circle

# Run all tests
cargo test

# Run specific withdrawal tests
cargo test test_withdraw
```

## Error Handling

The function returns appropriate errors for various failure scenarios:

- `CirclePanicked`: Circle is in emergency panic state
- `InvalidInput`: Invalid cycle number or cycle not mature
- `Disqualified`: Member is inactive or disqualified
- `InsufficientFunds`: Pool not fully funded for cycle
- `Unauthorized`: Member not designated for this cycle
- `AlreadyPaid`: Member already withdrew for this cycle
- `NotFound`: Circle, member, or rotation data not found

## Gas Optimization

The implementation is optimized for gas efficiency:
- Single storage read for circle data
- Lazy loading of standings and members
- Early returns on validation failures
- Minimal storage writes (only withdrawal tracking and member data)

## Future Enhancements

Potential improvements for future versions:

1. **Partial Cycle Withdrawals**: Allow withdrawing portion of cycle payout
2. **Grace Period**: Configurable grace period after cycle maturity
3. **Automatic Advancement**: Auto-advance to next cycle after withdrawal
4. **Withdrawal Events**: Emit events for off-chain tracking
5. **Multi-Cycle Batch**: Allow withdrawing multiple cycles in one transaction

## Integration Guide

### Frontend Integration

```typescript
// Example: Withdraw for cycle 1
const result = await contract.withdraw({
  member: userAddress,
  cycle: 1
});

console.log(`Withdrawn: ${result} stroops`);
```

### API Integration

```typescript
// API route example
export async function POST(request: Request) {
  const { cycle } = await request.json();
  const userAddress = await getUserAddress(request);
  
  const contract = new Contract(CONTRACT_ADDRESS);
  const result = await contract.withdraw({
    member: userAddress,
    cycle: cycle
  });
  
  return Response.json({ success: true, amount: result });
}
```

## Security Audit Checklist

- [x] Reentrancy protection implemented
- [x] Authorization checks in place
- [x] Input validation for all parameters
- [x] State updates before external calls
- [x] Double-withdrawal prevention
- [x] Cycle maturity verification
- [x] Pool funding verification
- [x] Member standing checks
- [x] Rotation order enforcement
- [x] Panic state handling
- [x] Comprehensive test coverage

## Conclusion

The `withdraw()` function provides a secure, robust mechanism for cycle-based withdrawals with:
- Comprehensive security checks
- Reentrancy protection
- Time-based maturity validation
- Pool funding verification
- Full backward compatibility

The implementation follows Soroban best practices and provides a solid foundation for the Ajo Circle savings system.
