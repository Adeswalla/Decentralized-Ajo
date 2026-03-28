# Ajo Circle Contract - Quick Reference

## Contract Summary

**Platform**: Stellar Soroban (Rust)  
**Purpose**: Decentralized Rotating Savings and Credit Association (ROSCA)  
**Status**: ✅ Production Ready

## Key Parameters

| Parameter | Type | Description | Constraints |
|-----------|------|-------------|-------------|
| `contribution_amount` | i128 | Per-round contribution | > 0 |
| `frequency_days` | u32 | Round duration (days) | > 0 |
| `max_rounds` | u32 | Total lifecycle rounds | > 0 |
| `max_members` | u32 | Member capacity | 1-100 (0=default 50) |
| `current_round` | u32 | Active round | 1-indexed |

## State Variables

### CircleData
```rust
organizer: Address          // Admin
token_address: Address      // Token contract
contribution_amount: i128   // Per-round amount
frequency_days: u32         // Round duration
max_rounds: u32            // Total rounds
current_round: u32         // Active round
member_count: u32          // Current members
max_members: u32           // Capacity
```

### MemberData
```rust
address: Address           // Member wallet
total_contributed: i128    // Cumulative contributions
total_withdrawn: i128      // Cumulative withdrawals
has_received_payout: bool  // Payout claimed
status: u32               // 0=Active, 1=Inactive, 2=Exited
```

### MemberStanding
```rust
missed_count: u32         // Consecutive misses
is_active: bool          // Eligibility
```

## Function Quick Reference

### Setup & Membership

```rust
// Initialize new circle
initialize_circle(
    organizer: Address,
    token_address: Address,
    contribution_amount: i128,
    frequency_days: u32,
    max_rounds: u32,
    max_members: u32
) -> Result<(), AjoError>

// Add member (organizer only)
join_circle(
    organizer: Address,
    new_member: Address
) -> Result<(), AjoError>
```

### Contributions

```rust
// Flexible contribution
contribute(
    member: Address,
    amount: i128
) -> Result<(), AjoError>

// Fixed deposit (preferred)
deposit(
    member: Address
) -> Result<(), AjoError>
```

### Payouts

```rust
// Shuffle payout order (once, before first payout)
shuffle_rotation(
    organizer: Address
) -> Result<(), AjoError>

// Claim payout (member's turn)
claim_payout(
    member: Address
) -> Result<i128, AjoError>
```

### Withdrawals

```rust
// Partial withdrawal (10% penalty)
partial_withdraw(
    member: Address,
    amount: i128
) -> Result<i128, AjoError>

// Emergency refund (panic state only, no penalty)
emergency_refund(
    member: Address
) -> Result<i128, AjoError>
```

### Governance

```rust
// Start dissolution vote
start_dissolution_vote(
    caller: Address,
    threshold_mode: u32  // 0=majority, 1=supermajority
) -> Result<(), AjoError>

// Vote YES for dissolution
vote_to_dissolve(
    member: Address
) -> Result<(), AjoError>

// Claim refund after dissolution
dissolve_and_refund(
    member: Address
) -> Result<i128, AjoError>
```

### Emergency

```rust
// Trigger emergency halt (admin only)
panic(
    admin: Address
) -> Result<(), AjoError>

// Check panic state
is_panicked() -> bool
```

### Administration

```rust
// Set KYC status
set_kyc_status(
    admin: Address,
    member: Address,
    is_verified: bool
) -> Result<(), AjoError>

// Slash member for missed contribution
slash_member(
    admin: Address,
    member: Address
) -> Result<(), AjoError>

// Remove dormant member
boot_dormant_member(
    admin: Address,
    member: Address
) -> Result<(), AjoError>
```

### Queries

```rust
// Get circle configuration
get_circle_state() -> Result<CircleData, AjoError>

// Get member data
get_member_balance(member: Address) -> Result<MemberData, AjoError>

// Get all members
get_members() -> Result<Vec<MemberData>, AjoError>

// Get circle status
get_circle_status() -> CircleStatus

// Get dissolution vote
get_dissolution_vote() -> Result<DissolutionVote, AjoError>

// Get total pool
get_total_pool() -> i128

// Get last deposit timestamp
get_last_deposit_timestamp(member: Address) -> Result<u64, AjoError>

// Check KYC status
is_kyc_verified(member: Address) -> bool
```

## Error Codes

| Code | Error | Meaning |
|------|-------|---------|
| 1 | NotFound | Resource doesn't exist |
| 2 | Unauthorized | Insufficient permissions |
| 3 | AlreadyExists | Duplicate resource |
| 4 | InvalidInput | Invalid parameter |
| 5 | AlreadyPaid | Payout already claimed |
| 6 | InsufficientFunds | Insufficient balance |
| 7 | Disqualified | Member disqualified |
| 8 | VoteAlreadyActive | Vote in progress |
| 9 | NoActiveVote | No active vote |
| 10 | AlreadyVoted | Already voted |
| 11 | CircleNotActive | Wrong state |
| 12 | CircleAlreadyDissolved | Already dissolved |
| 13 | CircleAtCapacity | Circle full |
| 14 | CirclePanicked | Emergency state |
| 15 | PriceUnavailable | Oracle unavailable |
| 16 | ArithmeticOverflow | Overflow |

## Circle States

```
Active → VotingForDissolution → Dissolved
   ↓
Panicked
```

| State | Description | Allowed Operations |
|-------|-------------|-------------------|
| Active | Normal operation | All except emergency_refund |
| VotingForDissolution | Vote in progress | vote_to_dissolve, queries |
| Dissolved | Governance dissolution | dissolve_and_refund, queries |
| Panicked | Emergency halt | emergency_refund, queries |

## Common Workflows

### 1. Create Circle
```rust
// 1. Deploy contract
// 2. Initialize
client.initialize_circle(
    &organizer,
    &usdc_address,
    &100_0000000,  // 100 USDC
    &7,            // Weekly
    &12,           // 12 rounds
    &10            // 10 members
);

// 3. Add members
client.join_circle(&organizer, &member1);
client.join_circle(&organizer, &member2);

// 4. Shuffle rotation
client.shuffle_rotation(&organizer);
```

### 2. Regular Contribution
```rust
// Member deposits
client.deposit(&member);

// Or flexible amount
client.contribute(&member, &amount);
```

### 3. Claim Payout
```rust
// When it's member's turn
let payout = client.claim_payout(&member)?;
```

### 4. Emergency Dissolution
```rust
// 1. Start vote
client.start_dissolution_vote(&member1, &0);

// 2. Members vote
client.vote_to_dissolve(&member1);
client.vote_to_dissolve(&member2);
// ... auto-dissolves at threshold

// 3. Claim refunds
client.dissolve_and_refund(&member1);
```

### 5. Panic Recovery
```rust
// 1. Admin triggers panic
client.panic(&organizer);

// 2. Members claim refunds
client.emergency_refund(&member1);
client.emergency_refund(&member2);
```

## CLI Commands

### Build
```bash
cargo build --target wasm32-unknown-unknown --release
```

### Test
```bash
cargo test --lib
```

### Deploy
```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/ajo_circle.wasm \
  --source deployer \
  --network testnet
```

### Invoke
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source <SOURCE> \
  --network testnet \
  -- \
  <FUNCTION_NAME> \
  --arg1 value1 \
  --arg2 value2
```

## Token Decimals Reference

| Token | Decimals | Example Amount |
|-------|----------|----------------|
| USDC | 7 | 100_0000000 = 100 USDC |
| XLM | 7 | 50_0000000 = 50 XLM |
| Custom | Varies | Check token contract |

## Best Practices

### For Organizers
1. ✅ Set realistic `contribution_amount` and `frequency_days`
2. ✅ Call `shuffle_rotation()` before first payout
3. ✅ Monitor member activity and slash if needed
4. ✅ Use `panic()` only for emergencies
5. ✅ Keep KYC records updated

### For Members
1. ✅ Use `deposit()` for regular contributions
2. ✅ Contribute before round deadline
3. ✅ Claim payout when it's your turn
4. ✅ Avoid partial withdrawals (10% penalty)
5. ✅ Participate in dissolution votes

### For Developers
1. ✅ Always check return values
2. ✅ Handle all error cases
3. ✅ Use `get_circle_status()` before operations
4. ✅ Test with small amounts first
5. ✅ Monitor gas costs

## Security Checklist

- ✅ All functions use `require_auth()`
- ✅ Admin functions check `require_admin()`
- ✅ Arithmetic uses checked operations
- ✅ State validated before operations
- ✅ No reentrancy vulnerabilities
- ✅ Token transfers are atomic
- ✅ Emergency controls available

## Testing Checklist

- ✅ Initialize with valid parameters
- ✅ Initialize with invalid parameters (should fail)
- ✅ Add members up to capacity
- ✅ Exceed capacity (should fail)
- ✅ Contribute and track balances
- ✅ Claim payouts in rotation
- ✅ Claim out of turn (should fail)
- ✅ Vote and dissolve
- ✅ Panic and refund
- ✅ Slash and disqualify members

## Resources

- **Contract Code**: `contracts/ajo-circle/src/lib.rs`
- **Factory**: `contracts/ajo-circle/src/factory.rs`
- **Full Docs**: `contracts/ajo-circle/README.md`
- **Specification**: `contracts/CONTRACT_SPECIFICATION.md`
- **Setup Guide**: `contracts/SETUP_GUIDE.md`

## Support

For issues:
1. Check error code in table above
2. Review function requirements
3. Verify circle state
4. Check test cases for examples
5. Consult full documentation

## Version

**Contract Version**: 0.1.0  
**SDK Version**: soroban-sdk 20.0.0  
**Last Updated**: 2026-03-25
