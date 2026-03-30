# Ajo Circle Smart Contract

## Overview

The Ajo Circle smart contract implements a decentralized Rotating Savings and Credit Association (ROSCA) on the Stellar blockchain using Soroban. This contract enables groups to pool funds periodically, with members taking turns receiving payouts in a fair and transparent manner.

## Architecture

### Technology Stack
- **Platform**: Stellar Soroban
- **Language**: Rust
- **SDK**: soroban-sdk 20.0.0
- **Token Standard**: Stellar Asset Contract (SAC)

### Core Components

1. **CircleData**: Main circle configuration
2. **MemberData**: Individual member tracking
3. **CircleStatus**: Lifecycle state management
4. **DissolutionVote**: Governance mechanism
5. **MemberStanding**: Activity and eligibility tracking

## Key Features

### 1. Circle Initialization
```rust
initialize_circle(
    organizer: Address,
    token_address: Address,
    contribution_amount: i128,
    frequency_days: u32,
    max_rounds: u32,
    max_members: u32
)
```

**Parameters:**
- `organizer`: Circle creator and administrator
- `token_address`: Token contract (USDC, XLM, etc.)
- `contribution_amount`: Required contribution per round
- `frequency_days`: Round duration in days
- `max_rounds`: Total number of rounds
- `max_members`: Maximum capacity (0 = default 50, max 100)

**State Variables:**
- `current_round`: Tracks active round (1-indexed)
- `member_count`: Current number of members
- `round_deadline`: Timestamp for round completion

### 2. Member Management

#### Join Circle
```rust
join_circle(organizer: Address, new_member: Address)
```
- Only organizer can add members
- Enforces capacity limits
- Initializes member standing

#### Member Standing
Each member has:
- `missed_count`: Consecutive missed contributions
- `is_active`: Eligibility status
- Automatic disqualification after 3 missed rounds

### 3. Contribution System

#### Standard Contribution
```rust
contribute(member: Address, amount: i128)
```
- Flexible contribution amounts
- Tracks cumulative contributions
- Resets missed count on contribution
- Auto-advances rounds when all members contribute

#### Fixed Deposit
```rust
deposit(member: Address)
```
- Deposits exact `contribution_amount`
- Records timestamp for tracking
- Updates total pool balance
- Preferred method for regular contributions

### 4. Payout Mechanism

#### Rotation Order
```rust
shuffle_rotation(organizer: Address)
```
- Uses Fisher-Yates shuffle algorithm
- Seeded with ledger sequence + transaction hash
- Must be called before first payout
- Ensures fair, unpredictable order

#### Claim Payout
```rust
claim_payout(member: Address)
```
- Enforces rotation order
- Payout = `member_count × contribution_amount`
- One-time payout per member
- Transfers tokens from contract to member

### 5. Withdrawal Options

#### Partial Withdrawal
```rust
partial_withdraw(member: Address, amount: i128)
```
- 10% penalty applied
- Available balance = contributed - withdrawn
- Blocked during panic state

#### Emergency Refund
```rust
emergency_refund(member: Address)
```
- Only available during panic state
- No penalty applied
- Returns full remaining balance

### 6. Governance

#### Dissolution Voting
```rust
start_dissolution_vote(caller: Address, threshold_mode: u32)
vote_to_dissolve(member: Address)
```

**Threshold Modes:**
- `0`: Simple majority (>50%)
- `1`: Supermajority (>66%)

**Process:**
1. Any member can initiate vote
2. Members cast YES votes
3. Auto-dissolves when threshold reached
4. Members can claim refunds after dissolution

### 7. Emergency Controls

#### Panic Button
```rust
panic(admin: Address)
```
- Admin-only emergency halt
- Blocks all normal operations
- Enables emergency refunds for all members

**Blocked Operations During Panic:**
- Contributions
- Deposits
- Payouts
- Partial withdrawals
- New member joins
- Rotation shuffles

### 8. Administrative Functions

#### KYC Management
```rust
set_kyc_status(admin: Address, member: Address, is_verified: bool)
is_kyc_verified(member: Address) -> bool
```

#### Member Slashing
```rust
slash_member(admin: Address, member: Address)
```
- Increments missed count
- Auto-disqualifies after 3 strikes

#### Boot Dormant Member
```rust
boot_dormant_member(admin: Address, member: Address)
```
- Marks member as inactive
- Sets status to Exited

### 9. Oracle Integration

#### Price Feed
```rust
set_eth_usd_price(admin: Address, price: i128, decimals: u32)
native_amount_for_usd(usd_amount: i128) -> i128
```
- Admin updates ETH/USD price
- Converts USD amounts to native tokens
- Supports configurable decimal precision

## Data Structures

### CircleData
```rust
pub struct CircleData {
    pub organizer: Address,           // Circle admin
    pub token_address: Address,       // Token contract
    pub contribution_amount: i128,    // Per-round contribution
    pub frequency_days: u32,          // Round duration
    pub max_rounds: u32,              // Total rounds
    pub current_round: u32,           // Active round
    pub member_count: u32,            // Current members
    pub max_members: u32,             // Capacity limit
}
```

### MemberData
```rust
pub struct MemberData {
    pub address: Address,             // Member wallet
    pub total_contributed: i128,      // Cumulative contributions
    pub total_withdrawn: i128,        // Cumulative withdrawals
    pub has_received_payout: bool,    // Payout claimed flag
    pub status: u32,                  // 0=Active, 1=Inactive, 2=Exited
}
```

### MemberStanding
```rust
pub struct MemberStanding {
    pub missed_count: u32,            // Consecutive misses
    pub is_active: bool,              // Eligibility status
}
```

## Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 1 | NotFound | Resource does not exist |
| 2 | Unauthorized | Insufficient permissions |
| 3 | AlreadyExists | Duplicate resource |
| 4 | InvalidInput | Invalid parameter |
| 5 | AlreadyPaid | Payout already claimed |
| 6 | InsufficientFunds | Insufficient balance |
| 7 | Disqualified | Member disqualified |
| 8 | VoteAlreadyActive | Vote in progress |
| 9 | NoActiveVote | No active vote |
| 10 | AlreadyVoted | Already cast vote |
| 11 | CircleNotActive | Wrong circle state |
| 12 | CircleAlreadyDissolved | Circle dissolved |
| 13 | CircleAtCapacity | Member limit reached |
| 14 | CirclePanicked | Emergency state active |
| 15 | PriceUnavailable | Oracle data missing |
| 16 | ArithmeticOverflow | Calculation overflow |

## Storage Keys

The contract uses instance storage for all data:

- `Circle`: CircleData configuration
- `Members`: Map<Address, MemberData>
- `Standings`: Map<Address, MemberStanding>
- `Admin`: Administrator address
- `KycStatus`: Map<Address, bool>
- `CircleStatus`: Current lifecycle state
- `DissolutionVote`: Active vote data
- `VoteCast`: Map<Address, bool>
- `RotationOrder`: Vec<Address>
- `RoundDeadline`: u64 timestamp
- `RoundContribCount`: u32 counter
- `EthUsdPrice`: i128 oracle price
- `EthUsdDecimals`: u32 precision
- `LastDepositAt`: Map<Address, u64>
- `TotalPool`: i128 balance

## Usage Examples

### Creating a Circle
```rust
// Initialize with USDC, 100 tokens per round, weekly rounds, 12 rounds, 10 members
client.initialize_circle(
    &organizer,
    &usdc_token_address,
    &100_0000000, // 100 USDC (7 decimals)
    &7,           // Weekly
    &12,          // 12 rounds
    &10           // 10 members
);
```

### Adding Members
```rust
client.join_circle(&organizer, &member1);
client.join_circle(&organizer, &member2);
```

### Contributing
```rust
// Flexible amount
client.contribute(&member1, &50_0000000);

// Fixed deposit
client.deposit(&member1);
```

### Setting Up Payouts
```rust
// Shuffle rotation order (do this once before first payout)
client.shuffle_rotation(&organizer);

// Members claim in rotation order
client.claim_payout(&member1); // Round 1
client.claim_payout(&member2); // Round 2
```

### Emergency Dissolution
```rust
// Start vote
client.start_dissolution_vote(&member1, &0); // Simple majority

// Members vote
client.vote_to_dissolve(&member1);
client.vote_to_dissolve(&member2);
// ... auto-dissolves when threshold reached

// Claim refunds
client.dissolve_and_refund(&member1);
```

### Panic Recovery
```rust
// Admin triggers panic
client.panic(&organizer);

// All members can claim emergency refunds
client.emergency_refund(&member1);
client.emergency_refund(&member2);
```

## Testing

Run the test suite:
```bash
cd contracts/ajo-circle
cargo test --lib
```

### Test Coverage
- Circle initialization and validation
- Member capacity enforcement
- Contribution tracking and round advancement
- Payout rotation and claiming
- Dissolution voting mechanics
- Panic state and emergency refunds
- Deposit tracking and pool accounting

## Security Considerations

1. **Authorization**: All sensitive operations require `require_auth()`
2. **Overflow Protection**: All arithmetic uses checked operations
3. **State Validation**: Operations validate circle status before execution
4. **Reentrancy**: Soroban's execution model prevents reentrancy attacks
5. **Emergency Controls**: Panic button provides last-resort fund recovery

## Deployment

### Using the Factory
```rust
factory.create_ajo(
    organizer,
    ajo_wasm_hash,
    token_address,
    contribution_amount,
    frequency_days,
    max_rounds,
    max_members
);
```

The factory:
- Deploys new circle instances
- Maintains registry of all circles
- Uses deterministic salts for deployment

## Constants

- `MAX_MEMBERS`: 50 (default capacity)
- `HARD_CAP`: 100 (absolute maximum)

## License

This contract is part of the Decentralized Ajo project.
