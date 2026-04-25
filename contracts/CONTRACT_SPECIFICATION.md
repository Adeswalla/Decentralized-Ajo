# Ajo Circle Contract Specification

## Executive Summary

The Ajo Circle smart contract is a fully-featured implementation of a decentralized Rotating Savings and Credit Association (ROSCA) on the Stellar blockchain. This document provides a comprehensive specification of the contract's architecture, functionality, and implementation details.

## Contract Overview

### Purpose
Enable trustless, transparent group savings where members contribute periodically and receive payouts in a predetermined rotation.

### Platform
- **Blockchain**: Stellar
- **Runtime**: Soroban
- **Language**: Rust
- **SDK Version**: soroban-sdk 20.0.0

### Key Characteristics
- Token-agnostic (supports any Stellar Asset Contract)
- Configurable parameters (contribution amount, frequency, member count)
- Built-in governance (dissolution voting)
- Emergency controls (panic button)
- Fair payout distribution (cryptographic shuffling)

## Architecture

### Contract Structure

```
AjoCircle Contract
├── State Management
│   ├── CircleData (configuration)
│   ├── Members (Map<Address, MemberData>)
│   ├── Standings (Map<Address, MemberStanding>)
│   └── CircleStatus (lifecycle state)
├── Core Functions
│   ├── initialize_circle()
│   ├── join_circle()
│   ├── contribute()
│   ├── deposit()
│   └── claim_payout()
├── Governance
│   ├── start_dissolution_vote()
│   ├── vote_to_dissolve()
│   └── dissolve_and_refund()
├── Emergency Controls
│   ├── panic()
│   └── emergency_refund()
└── Administrative
    ├── set_kyc_status()
    ├── slash_member()
    └── boot_dormant_member()
```

## Data Structures

### 1. CircleData
**Purpose**: Store circle configuration and state

```rust
pub struct CircleData {
    pub organizer: Address,           // Circle administrator
    pub token_address: Address,       // Token contract address
    pub contribution_amount: i128,    // Required per-round contribution
    pub frequency_days: u32,          // Round duration (days)
    pub max_rounds: u32,              // Total lifecycle rounds
    pub current_round: u32,           // Active round (1-indexed)
    pub member_count: u32,            // Current member count
    pub max_members: u32,             // Capacity limit
}
```

**Invariants**:
- `contribution_amount > 0`
- `frequency_days > 0`
- `max_rounds > 0`
- `0 < max_members <= HARD_CAP (100)`
- `1 <= current_round <= max_rounds`
- `member_count <= max_members`

### 2. MemberData
**Purpose**: Track individual member contributions and withdrawals

```rust
pub struct MemberData {
    pub address: Address,             // Member wallet address
    pub total_contributed: i128,      // Cumulative contributions
    pub total_withdrawn: i128,        // Cumulative withdrawals
    pub has_received_payout: bool,    // Payout claim flag
    pub status: u32,                  // 0=Active, 1=Inactive, 2=Exited
}
```

**Invariants**:
- `total_contributed >= 0`
- `total_withdrawn >= 0`
- `total_withdrawn <= total_contributed`
- `status ∈ {0, 1, 2}`

### 3. MemberStanding
**Purpose**: Monitor member activity and eligibility

```rust
pub struct MemberStanding {
    pub missed_count: u32,            // Consecutive missed rounds
    pub is_active: bool,              // Eligibility status
}
```

**Rules**:
- `missed_count >= 3` → `is_active = false` (auto-disqualification)
- Successful contribution → `missed_count = 0`

### 4. CircleStatus
**Purpose**: Represent circle lifecycle state

```rust
pub enum CircleStatus {
    Active,                   // Normal operations
    VotingForDissolution,     // Vote in progress
    Dissolved,                // Governance dissolution
    Panicked,                 // Emergency state
}
```

**State Transitions**:
```
Active → VotingForDissolution (via start_dissolution_vote)
VotingForDissolution → Dissolved (when threshold met)
Active → Panicked (via panic)
Any → Panicked (admin override)
```

### 5. DissolutionVote
**Purpose**: Track dissolution voting progress

```rust
pub struct DissolutionVote {
    pub votes_for: u32,               // YES vote count
    pub total_members: u32,           // Eligible voters
    pub threshold_mode: u32,          // 0=majority, 1=supermajority
}
```

**Threshold Calculations**:
- Simple majority: `votes_for * 2 > total_members` (>50%)
- Supermajority: `votes_for * 100 > total_members * 66` (>66%)

## Function Specifications

### Core Functions

#### initialize_circle
**Signature**:
```rust
pub fn initialize_circle(
    env: Env,
    organizer: Address,
    token_address: Address,
    contribution_amount: i128,
    frequency_days: u32,
    max_rounds: u32,
    max_members: u32,
) -> Result<(), AjoError>
```

**Preconditions**:
- Caller must be `organizer`
- `contribution_amount > 0`
- `frequency_days > 0`
- `max_rounds > 0`
- `0 < max_members <= HARD_CAP` (or 0 for default)

**Postconditions**:
- CircleData stored with provided parameters
- Organizer added as first member
- Admin set to organizer
- CircleStatus = Active
- Round deadline = now + frequency_days

**Side Effects**:
- Initializes Members map with organizer
- Initializes Standings map with organizer
- Sets RoundContribCount = 0

#### join_circle
**Signature**:
```rust
pub fn join_circle(
    env: Env,
    organizer: Address,
    new_member: Address,
) -> Result<(), AjoError>
```

**Preconditions**:
- Caller must be organizer
- `new_member` not already in circle
- `member_count < max_members`
- CircleStatus ≠ Panicked

**Postconditions**:
- Member added to Members map
- Member added to Standings map
- `member_count` incremented

**Errors**:
- `Unauthorized`: Caller not organizer
- `AlreadyExists`: Member already in circle
- `CircleAtCapacity`: Circle full
- `CirclePanicked`: Emergency state active

#### contribute
**Signature**:
```rust
pub fn contribute(
    env: Env,
    member: Address,
    amount: i128,
) -> Result<(), AjoError>
```

**Preconditions**:
- Caller must be `member`
- `amount > 0`
- Member exists in circle
- Member is active (not disqualified)
- CircleStatus ≠ Panicked

**Postconditions**:
- Tokens transferred from member to contract
- `total_contributed` increased by `amount`
- `missed_count` reset to 0
- If round complete: advance to next round

**Side Effects**:
- May increment `RoundContribCount`
- May advance `current_round`
- May update `RoundDeadline`

#### deposit
**Signature**:
```rust
pub fn deposit(env: Env, member: Address) -> Result<(), AjoError>
```

**Preconditions**:
- Caller must be `member`
- Member exists and is active
- CircleStatus ≠ Panicked

**Postconditions**:
- Exactly `contribution_amount` transferred
- `total_contributed` increased by `contribution_amount`
- `missed_count` reset to 0
- Timestamp recorded in `LastDepositAt`
- `TotalPool` incremented

**Advantages over contribute**:
- Fixed amount (no calculation errors)
- Timestamp tracking
- Pool accounting

#### shuffle_rotation
**Signature**:
```rust
pub fn shuffle_rotation(
    env: Env,
    organizer: Address,
) -> Result<(), AjoError>
```

**Preconditions**:
- Caller must be organizer
- CircleStatus ≠ Panicked

**Algorithm**:
1. Collect all member addresses
2. Generate seed from ledger sequence + tx hash
3. Apply Fisher-Yates shuffle
4. Store rotation order

**Postconditions**:
- `RotationOrder` contains shuffled member list
- Order is deterministic but unpredictable

#### claim_payout
**Signature**:
```rust
pub fn claim_payout(
    env: Env,
    member: Address,
) -> Result<i128, AjoError>
```

**Preconditions**:
- Caller must be `member`
- Member is active
- Member has not claimed payout
- If rotation set: member's turn in rotation
- CircleStatus ≠ Panicked

**Postconditions**:
- Payout = `member_count × contribution_amount`
- Tokens transferred from contract to member
- `has_received_payout` = true
- `total_withdrawn` increased by payout

**Returns**: Payout amount

### Governance Functions

#### start_dissolution_vote
**Signature**:
```rust
pub fn start_dissolution_vote(
    env: Env,
    caller: Address,
    threshold_mode: u32,
) -> Result<(), AjoError>
```

**Preconditions**:
- Caller is member or organizer
- CircleStatus = Active
- `threshold_mode ∈ {0, 1}`

**Postconditions**:
- CircleStatus = VotingForDissolution
- DissolutionVote initialized
- VoteCast map cleared

#### vote_to_dissolve
**Signature**:
```rust
pub fn vote_to_dissolve(
    env: Env,
    member: Address,
) -> Result<(), AjoError>
```

**Preconditions**:
- Caller is member
- CircleStatus = VotingForDissolution
- Member has not voted

**Postconditions**:
- `votes_for` incremented
- Member marked as voted
- If threshold met: CircleStatus = Dissolved

**Auto-dissolution**:
- Checks threshold after each vote
- Automatically transitions to Dissolved

#### dissolve_and_refund
**Signature**:
```rust
pub fn dissolve_and_refund(
    env: Env,
    member: Address,
) -> Result<i128, AjoError>
```

**Preconditions**:
- Caller is member
- CircleStatus = Dissolved

**Postconditions**:
- Refund = `total_contributed - total_withdrawn`
- Tokens transferred to member
- `total_withdrawn` updated
- `status` = 2 (Exited)

**Returns**: Refund amount

### Emergency Functions

#### panic
**Signature**:
```rust
pub fn panic(env: Env, admin: Address) -> Result<(), AjoError>
```

**Preconditions**:
- Caller is admin
- CircleStatus ≠ Dissolved
- CircleStatus ≠ Panicked

**Postconditions**:
- CircleStatus = Panicked
- All normal operations blocked
- Emergency refunds enabled

**Use Cases**:
- Smart contract vulnerability discovered
- Regulatory compliance issue
- Critical operational failure

#### emergency_refund
**Signature**:
```rust
pub fn emergency_refund(
    env: Env,
    member: Address,
) -> Result<i128, AjoError>
```

**Preconditions**:
- Caller is member
- CircleStatus = Panicked

**Postconditions**:
- Refund = `total_contributed - total_withdrawn`
- Tokens transferred (no penalty)
- `total_withdrawn` updated
- `status` = 2 (Exited)

**Returns**: Refund amount

### Administrative Functions

#### set_kyc_status
**Signature**:
```rust
pub fn set_kyc_status(
    env: Env,
    admin: Address,
    member: Address,
    is_verified: bool,
) -> Result<(), AjoError>
```

**Purpose**: Track off-chain KYC verification

**Preconditions**:
- Caller is admin

**Postconditions**:
- KYC status updated for member

#### slash_member
**Signature**:
```rust
pub fn slash_member(
    env: Env,
    admin: Address,
    member: Address,
) -> Result<(), AjoError>
```

**Purpose**: Penalize member for missed contribution

**Preconditions**:
- Caller is admin
- Member exists

**Postconditions**:
- `missed_count` incremented
- If `missed_count >= 3`: `is_active` = false

#### boot_dormant_member
**Signature**:
```rust
pub fn boot_dormant_member(
    env: Env,
    admin: Address,
    member: Address,
) -> Result<(), AjoError>
```

**Purpose**: Remove inactive member

**Preconditions**:
- Caller is admin
- Member exists

**Postconditions**:
- `is_active` = false
- `status` = 2 (Exited)

## Security Model

### Authorization
- **require_auth()**: All functions validate caller identity
- **require_admin()**: Admin-only functions check stored admin address

### Arithmetic Safety
- All operations use checked arithmetic
- Overflow returns `ArithmeticOverflow` error
- No unchecked casts or conversions

### State Validation
- Functions validate CircleStatus before execution
- Panic state blocks all normal operations
- Dissolution state enables refunds only

### Token Safety
- Uses Stellar Asset Contract standard
- All transfers are atomic
- No reentrancy risk (Soroban execution model)

### Access Control Matrix

| Function | Organizer | Member | Anyone |
|----------|-----------|--------|--------|
| initialize_circle | ✓ | - | - |
| join_circle | ✓ | - | - |
| contribute | - | ✓ (self) | - |
| deposit | - | ✓ (self) | - |
| claim_payout | - | ✓ (self) | - |
| shuffle_rotation | ✓ | - | - |
| start_dissolution_vote | ✓ | ✓ | - |
| vote_to_dissolve | - | ✓ | - |
| dissolve_and_refund | - | ✓ (self) | - |
| panic | ✓ | - | - |
| emergency_refund | - | ✓ (self) | - |
| set_kyc_status | ✓ | - | - |
| slash_member | ✓ | - | - |
| boot_dormant_member | ✓ | - | - |
| get_circle_state | - | - | ✓ |
| get_member_balance | - | - | ✓ |
| get_members | - | - | ✓ |

## Gas Optimization

### Storage Efficiency
- Uses instance storage (cheaper than persistent)
- Maps for O(1) member lookups
- Minimal storage writes

### Computation Efficiency
- Early returns on validation failures
- Batch operations where possible
- Efficient iteration patterns

## Testing Strategy

### Unit Tests
- ✅ Circle initialization
- ✅ Member capacity enforcement
- ✅ Contribution tracking
- ✅ Payout claiming
- ✅ Dissolution voting
- ✅ Panic state handling
- ✅ Emergency refunds
- ✅ Deposit tracking

### Integration Tests
- Token contract interaction
- Factory deployment
- Multi-circle scenarios

### Edge Cases
- Maximum member capacity
- Arithmetic overflow scenarios
- Concurrent operations
- State transition boundaries

## Deployment Considerations

### Network Requirements
- Stellar Testnet (for testing)
- Stellar Mainnet (for production)

### Dependencies
- Token contract must be deployed first
- Factory contract (optional, for multi-circle deployment)

### Configuration
- Choose appropriate `max_members` for use case
- Set `contribution_amount` based on token decimals
- Configure `frequency_days` for target cadence

### Monitoring
- Track CircleStatus changes
- Monitor member activity
- Watch for panic triggers

## Future Enhancements

### Potential Features
1. **Dynamic Contributions**: Allow variable contribution amounts
2. **Partial Payouts**: Enable fractional payout distribution
3. **Automated Slashing**: Auto-slash on missed deadlines
4. **Multi-Token Support**: Accept multiple token types
5. **Reputation System**: Track member reliability scores
6. **Insurance Pool**: Reserve fund for defaults
7. **Delegation**: Allow proxy voting
8. **Time-Locked Withdrawals**: Add withdrawal delays

### Upgrade Path
- Deploy new contract version
- Migrate state via factory
- Maintain backward compatibility

## Compliance Considerations

### KYC/AML
- `set_kyc_status()` for verification tracking
- Off-chain identity verification required
- Admin controls for compliance

### Regulatory
- Panic button for emergency compliance
- Audit trail via blockchain
- Transparent operations

## Conclusion

The Ajo Circle contract provides a robust, secure, and feature-complete implementation of a decentralized ROSCA. The contract includes:

✅ **Core Functionality**: Contributions, payouts, member management  
✅ **Governance**: Democratic dissolution voting  
✅ **Safety**: Emergency controls and panic mechanism  
✅ **Administration**: KYC tracking and member management  
✅ **Security**: Authorization, overflow protection, state validation  
✅ **Testing**: Comprehensive test coverage  
✅ **Documentation**: Inline NatSpec-style comments  

The contract is production-ready and follows Stellar/Soroban best practices.
