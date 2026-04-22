# Ajo Circle Smart Contract

**Location:** `contracts/ajo-circle/src/lib.rs`  
**Runtime:** Soroban SDK · Rust · `wasm32-unknown-unknown`

This document is the authoritative reference for every public function, data structure, error code, storage key, and lifecycle state in the Ajo Circle smart contract. Read this before writing any on-chain integration or test.

---

## Table of Contents

1. [Constants](#constants)
2. [Data Structures](#data-structures)
3. [Storage Keys](#storage-keys)
4. [Error Codes](#error-codes)
5. [Functions](#functions)
   - [Initialization](#initialization)
   - [Membership](#membership)
   - [Contributions & Deposits](#contributions--deposits)
   - [Rotation & Payouts](#rotation--payouts)
   - [Admin & Emergency Controls](#admin--emergency-controls)
   - [Role Management](#role-management)
   - [Query Functions](#query-functions)
6. [Circle Lifecycle](#circle-lifecycle)
7. [Security Model](#security-model)
8. [Events](#events)
9. [Factory Contract](#factory-contract)
10. [Building the Contract](#building-the-contract)

---

## Constants

| Constant | Value | Description |
|---|---|---|
| `MAX_MEMBERS` | `50` | Default maximum members per circle |
| `MIN_CONTRIBUTION_AMOUNT` | `1_000_000` | Minimum contribution in token stroops |
| `MAX_CONTRIBUTION_AMOUNT` | `10_000_000_000` | Maximum contribution in token stroops |
| `MIN_FREQUENCY_DAYS` | `1` | Minimum round duration in days |
| `MAX_FREQUENCY_DAYS` | `365` | Maximum round duration in days |
| `MIN_ROUNDS` | `2` | Minimum number of rounds |
| `MAX_ROUNDS` | `100` | Maximum number of rounds |
| `WITHDRAWAL_PENALTY_PERCENT` | `10` | Penalty applied to partial withdrawals |

> **Note:** A `HARD_CAP` constant is referenced in validation logic to cap `max_members`. Ensure your deployment sets this appropriately.

---

## Data Structures

### `CircleData`

Stored under `DataKey::Circle`. Represents the circle's configuration and runtime state.

| Field | Type | Description |
|---|---|---|
| `organizer` | `Address` | The account that initialized the circle |
| `token_address` | `Address` | The Stellar asset contract address used for contributions and payouts |
| `contribution_amount` | `i128` | Required contribution per member per round, in token stroops |
| `frequency_days` | `u32` | Number of days between rounds |
| `max_rounds` | `u32` | Total number of payout rounds |
| `current_round` | `u32` | The active round number, starts at `1` |
| `member_count` | `u32` | Current number of members including organizer |
| `max_members` | `u32` | Maximum allowed members; defaults to `MAX_MEMBERS` (50) if `0` is passed at init |

---

### `MemberData`

Stored in a `Map<Address, MemberData>` under `DataKey::Members`.

| Field | Type | Description |
|---|---|---|
| `address` | `Address` | Member's Stellar address |
| `total_contributed` | `i128` | Cumulative tokens contributed |
| `total_withdrawn` | `i128` | Cumulative tokens withdrawn or paid out |
| `has_received_payout` | `bool` | Whether this member has claimed their rotation payout |
| `status` | `u32` | `0` = Active, `1` = Inactive, `2` = Exited |

---

### `MemberStanding`

Stored in a `Map<Address, MemberStanding>` under `DataKey::Standings`. Tracks participation health separately from `MemberData`.

| Field | Type | Description |
|---|---|---|
| `missed_count` | `u32` | Number of consecutive missed contribution rounds |
| `is_active` | `bool` | Whether the member is currently eligible to contribute and claim payouts |

A member is automatically disqualified (`is_active = false`) when `missed_count >= 3`. A successful contribution resets `missed_count` to `0`.

---

### `CircleStatus`

Stored as a `bool` under `DataKey::CircleStatus`. The contract uses a boolean pause flag rather than a full enum in storage.

| Value | Meaning |
|---|---|
| `false` | Circle is active — normal operations allowed |
| `true` | Circle is paused / panicked — only emergency operations allowed |

> **Note:** The `CircleStatus` enum (`Active`, `VotingForDissolution`, `Dissolved`, `Panicked`) is defined in the source but the current storage implementation uses a boolean flag. Dissolution voting functions are not present in the current contract version; the enum is reserved for future use.

---

### `DissolutionVote`

Defined in source but not yet wired to storage in the current contract version. Reserved for future governance features.

| Field | Type | Description |
|---|---|---|
| `votes_for` | `u32` | Number of YES votes cast |
| `total_members` | `u32` | Snapshot of member count at vote start |
| `threshold_mode` | `u32` | `0` = simple majority (>50%), `1` = supermajority (>66%) |

---

### `FeeConfig`

Optional fee configuration stored under `DataKey::FeeConfig`.

| Field | Type | Description |
|---|---|---|
| `treasury` | `Address` | Address that receives protocol fees |
| `fee_bps` | `u32` | Fee in basis points (e.g., `100` = 1%) |

---

## Storage Keys

All storage uses `env.storage().instance()`.

| Key | Stores | Description |
|---|---|---|
| `DataKey::Circle` | `CircleData` | Circle configuration and runtime state |
| `DataKey::Members` | `Map<Address, MemberData>` | All member records |
| `DataKey::Standings` | `Map<Address, MemberStanding>` | Member participation health |
| `DataKey::CircleStatus` | `bool` | Pause flag (`true` = paused) |
| `DataKey::RotationOrder` | `Vec<Address>` | Shuffled payout order set by `shuffle_rotation` |
| `DataKey::RoundDeadline` | `u64` | Unix timestamp of the current round's deadline |
| `DataKey::RoundContribCount` | `u32` | Number of members who have completed contributions in the current round |
| `DataKey::TotalPool` | `i128` | Running total of tokens deposited via `deposit` |
| `DataKey::LastDepositAt` | `Map<Address, u64>` | Last deposit timestamp per member |
| `DataKey::CycleWithdrawals` | *(reserved)* | Reserved for per-cycle withdrawal tracking |
| `DataKey::KycStatus` | `Map<Address, bool>` | Off-chain KYC verification status per member |
| `DataKey::RoleMembers` | `Map<Symbol, Vec<Address>>` | Role-based access control lists |
| `DataKey::Deployer` | `Address` | Immutable deployer address set at initialization |
| `DataKey::Admin` | `Address` | Legacy admin key (kept for backward compatibility) |
| `DataKey::FeeConfig` | `FeeConfig` | Optional fee configuration |

---

## Error Codes

| Code | Name | When it occurs |
|---|---|---|
| `1` | `NotFound` | Circle or member does not exist in storage |
| `2` | `Unauthorized` | Caller is not the organizer, admin, or an authorized member |
| `3` | `AlreadyExists` | Member is already in the circle |
| `4` | `InvalidInput` | Zero/negative amounts, invalid parameters |
| `5` | `AlreadyPaid` | Member already claimed their rotation payout |
| `6` | `InsufficientFunds` | Withdrawal or payout exceeds available pool balance |
| `7` | `Disqualified` | Member is inactive due to missed contributions |
| `8` | `VoteAlreadyActive` | A dissolution vote is already in progress *(reserved)* |
| `9` | `NoActiveVote` | No dissolution vote is currently active *(reserved)* |
| `10` | `AlreadyVoted` | Member has already cast a vote *(reserved)* |
| `11` | `CircleNotActive` | Operation requires Active status |
| `12` | `CircleAlreadyDissolved` | Circle has already been dissolved |
| `13` | `CircleAtCapacity` | Member count has reached `max_members` |
| `14` | `CirclePanicked` | Circle is in emergency halt state |
| `15` | `PriceUnavailable` | Oracle price data is unavailable *(reserved)* |
| `16` | `ArithmeticOverflow` | A checked arithmetic operation would overflow |
| `17` | `Paused` | Circle is paused; returned by `contribute` and `deposit` when the pause flag is set |

> Codes 8–10 and 15 are defined but not yet triggered by any current function. They are reserved for future governance and oracle features.

---

## Functions

### Initialization

#### `initialize_circle`

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

Creates a new savings circle. The organizer becomes the first member, the deployer, and holds both `ADMIN` and `MANAGER` roles.

**Auth:** `organizer.require_auth()`

**Validation:**
- `contribution_amount > 0`
- `frequency_days > 0`
- `max_rounds > 0`
- `max_members` must not exceed `HARD_CAP`; if `0` is passed, defaults to `MAX_MEMBERS` (50)

**Side effects:**
- Sets `DataKey::Deployer` to `organizer` (immutable after this call)
- Bootstraps `ADMIN` and `MANAGER` role lists with `organizer`
- Sets `DataKey::RoundDeadline` to `now + frequency_days * 86400` seconds
- Adds `organizer` as the first member with `total_contributed = 0`
- Initializes `organizer`'s `MemberStanding` as active with `missed_count = 0`
- Emits a `created` event

**Errors:** `InvalidInput`

---

### Membership

#### `join_circle`

```rust
pub fn join_circle(
    env: Env,
    organizer: Address,
    new_member: Address,
) -> Result<(), AjoError>
```

Adds a new member to the circle. Only the organizer can call this.

**Auth:** `organizer.require_auth()`

**Validation:**
- Caller must match `circle.organizer`
- `new_member` must not already be in the members map
- `circle.member_count` must be less than `circle.max_members`

**Side effects:**
- Adds `new_member` to `DataKey::Members` with zeroed balances and `status = 0`
- Increments `circle.member_count`
- Initializes `new_member`'s `MemberStanding` as active
- Emits a `join` event

**Errors:** `NotFound`, `Unauthorized`, `AlreadyExists`, `CircleAtCapacity`

---

#### `add_member`

```rust
pub fn add_member(
    env: Env,
    organizer: Address,
    new_member: Address,
) -> Result<(), AjoError>
```

Backward-compatible alias for `join_circle`. Identical behavior.

---

### Contributions & Deposits

There are two contribution entry points. Use `contribute` for explicit-amount contributions and `deposit` for fixed-amount deposits that also track the pool balance and deposit timestamps.

#### `contribute`

```rust
pub fn contribute(
    env: Env,
    member: Address,
    amount: i128,
) -> Result<(), AjoError>
```

Records a contribution of `amount` tokens from `member`. The amount must be positive; the contract does not enforce that it equals `contribution_amount` exactly, but the round-completion logic compares `total_contributed` against `current_round * contribution_amount`.

**Auth:** `member.require_auth()`

**Blocked when:** `CircleStatus` pause flag is `true` → returns `Paused`

**Validation:**
- `amount > 0`
- Member must exist in `DataKey::Standings` and have `is_active = true`
- Member must have `missed_count < 3`

**Side effects:**
- Transfers `amount` tokens from `member` to the contract via the token client
- Increments `member_data.total_contributed`
- Resets `standing.missed_count` to `0`
- If this contribution causes the member to reach the round target (`current_round * contribution_amount`) and all members have now reached it, advances `current_round` and extends `RoundDeadline` by `frequency_days * 86400` seconds

**Errors:** `Paused`, `InvalidInput`, `NotFound`, `Disqualified`, `ArithmeticOverflow`

---

#### `deposit`

```rust
pub fn deposit(
    env: Env,
    member: Address,
) -> Result<(), AjoError>
```

Deposits exactly `circle.contribution_amount` tokens. Unlike `contribute`, this function also updates `DataKey::TotalPool` and records the deposit timestamp in `DataKey::LastDepositAt`. It also checks round completion by counting members whose `total_contributed >= current_round * contribution_amount`.

**Auth:** `member.require_auth()`

**Blocked when:** `CircleStatus` pause flag is `true` → returns `Paused`

**Validation:**
- Member must exist in `DataKey::Standings` and have `is_active = true`
- Member must have `missed_count < 3`

**Side effects:**
- Transfers `contribution_amount` tokens from `member` to the contract
- Increments `member_data.total_contributed`
- Resets `standing.missed_count` to `0`
- Updates `DataKey::TotalPool`
- Records `env.ledger().timestamp()` in `DataKey::LastDepositAt` for the member
- Advances `RoundDeadline` if all members have completed the current round
- Emits a `deposit` event

**Errors:** `Paused`, `InvalidInput`, `NotFound`, `Disqualified`

---

### Rotation & Payouts

#### `shuffle_rotation`

```rust
pub fn shuffle_rotation(
    env: Env,
    organizer: Address,
) -> Result<(), AjoError>
```

Shuffles the payout rotation order using a Fisher-Yates algorithm. Must be called by the organizer before the first round begins.

**Auth:** `organizer.require_auth()`

**Validation:** Caller must match `circle.organizer`

**Shuffle seed:** The ledger sequence number is hashed with SHA-256. Each swap index `i` uses `hash_bytes[i % 32] % (i + 1)` as the swap target, cycling through the 32 hash bytes for unpredictability.

**Side effects:**
- Stores the shuffled `Vec<Address>` in `DataKey::RotationOrder`

**Errors:** `NotFound`, `Unauthorized`

---

#### `claim_payout`

```rust
pub fn claim_payout(
    env: Env,
    member: Address,
    cycle: u32,
) -> Result<i128, AjoError>
```

Claims the rotating payout for a specific cycle. Follows the Checks-Effects-Interactions (CEI) pattern: all state mutations happen before the token transfer.

**Auth:** `member.require_auth()`

**Blocked when:** `CircleStatus` pause flag is `true` → returns `CirclePanicked`

**Validation (Checks):**
1. `cycle` must be between `1` and `circle.max_rounds` inclusive
2. Member must exist in `DataKey::Standings` with `is_active = true`
3. Member must exist in `DataKey::Members`
4. `member_data.has_received_payout` must be `false` — otherwise returns `AlreadyPaid`
5. If `DataKey::RotationOrder` is set, `rotation[cycle - 1]` must equal `member` — otherwise returns `Unauthorized`
6. `DataKey::TotalPool` must be `>= member_count * contribution_amount` — otherwise returns `InsufficientFunds`

**Payout amount:** `member_count * contribution_amount`

**Effects (before transfer):**
- Sets `member_data.has_received_payout = true`
- Adds payout to `member_data.total_withdrawn`
- Deducts payout from `DataKey::TotalPool`
- Persists updated members map

**Interactions (after state):**
- Transfers payout tokens from contract to `member`
- Emits a `withdraw` event

**Returns:** `Ok(payout_amount)`

**Errors:** `CirclePanicked`, `InvalidInput`, `NotFound`, `Disqualified`, `AlreadyPaid`, `Unauthorized`, `InsufficientFunds`, `ArithmeticOverflow`

---

#### `withdraw`

```rust
pub fn withdraw(
    env: Env,
    member: Address,
    cycle: u32,
) -> Result<i128, AjoError>
```

Alias for `claim_payout`. Identical behavior.

---

### Admin & Emergency Controls

#### `panic`

```rust
pub fn panic(
    env: Env,
    admin: Address,
) -> Result<(), AjoError>
```

Sets the pause flag to `true`, halting all contributions and payouts. Any address with the `ADMIN` role (or the deployer) can call this.

**Auth:** `require_admin` — verifies `admin` is the deployer or holds `ADMIN` role

**Side effects:**
- Sets `DataKey::CircleStatus` to `true`
- Emits a `panic` event

**Errors:** `Unauthorized`

---

#### `resume`

```rust
pub fn resume(
    env: Env,
    admin: Address,
) -> Result<(), AjoError>
```

Clears the pause flag, restoring normal operations.

**Auth:** `require_admin`

**Side effects:** Sets `DataKey::CircleStatus` to `false`

**Errors:** `Unauthorized`

---

#### `emergency_stop`

Alias for `panic`. Identical behavior.

---

#### `resume_operations`

Alias for `resume`. Identical behavior.

---

#### `emergency_panic`

```rust
pub fn emergency_panic(
    env: Env,
    caller: Address,
) -> Result<(), AjoError>
```

Deployer-only emergency halt. Stricter than `panic` — only the original deployer address can call this.

**Auth:** `require_deployer` — caller must exactly match `DataKey::Deployer`

**Side effects:**
- Sets `DataKey::CircleStatus` to `true`
- Emits an `emrg_panic` event

**Errors:** `Unauthorized`

---

#### `slash_member`

```rust
pub fn slash_member(
    env: Env,
    admin: Address,
    member: Address,
) -> Result<(), AjoError>
```

Increments a member's `missed_count`. If `missed_count >= 3`, sets `is_active = false`, disqualifying the member from future contributions and payouts.

**Auth:** `require_admin`

**Errors:** `Unauthorized`, `NotFound`

---

#### `boot_dormant_member`

```rust
pub fn boot_dormant_member(
    env: Env,
    admin: Address,
    member: Address,
) -> Result<(), AjoError>
```

Immediately deactivates a member by setting `is_active = false` in their standing and `status = 2` (Exited) in their member data. Does not require `missed_count` to reach the threshold.

**Auth:** `require_admin`

**Errors:** `Unauthorized`, `NotFound`

---

#### `set_kyc_status`

```rust
pub fn set_kyc_status(
    env: Env,
    admin: Address,
    member: Address,
    is_verified: bool,
) -> Result<(), AjoError>
```

Records an off-chain KYC verification result for a member. The contract itself does not gate any operations on KYC status — this is informational storage for off-chain consumers.

**Auth:** `require_admin`

**Errors:** `Unauthorized`

---

#### `upgrade`

```rust
pub fn upgrade(
    env: Env,
    admin: Address,
    new_wasm_hash: BytesN<32>,
) -> Result<(), AjoError>
```

Upgrades the contract's WASM code in place using Soroban's `update_current_contract_wasm`. All storage is preserved.

**Auth:** `require_admin`

**Errors:** `Unauthorized`

---

### Role Management

The contract uses two built-in roles: `ADMIN` (`symbol_short!("ADMIN")`) and `MANAGER` (`symbol_short!("MANAGER")`). The deployer implicitly holds all roles and cannot have their `ADMIN` role revoked.

#### `grant_role`

```rust
pub fn grant_role(
    env: Env,
    caller: Address,
    role: Symbol,
    new_member: Address,
) -> Result<(), AjoError>
```

Adds `new_member` to the specified role list.

**Auth:** `require_deployer` — only the original deployer can grant roles

**Errors:** `Unauthorized`, `AlreadyExists`

---

#### `revoke_role`

```rust
pub fn revoke_role(
    env: Env,
    caller: Address,
    role: Symbol,
    member: Address,
) -> Result<(), AjoError>
```

Removes `member` from the specified role list. The deployer's own `ADMIN` role cannot be revoked.

**Auth:** `require_deployer`

**Errors:** `Unauthorized`, `NotFound`

---

#### `has_role`

```rust
pub fn has_role(
    env: Env,
    role: Symbol,
    member: Address,
) -> bool
```

Read-only check. Returns `true` if `member` holds `role` or is the deployer.

---

#### `get_deployer`

```rust
pub fn get_deployer(env: Env) -> Result<Address, AjoError>
```

Returns the immutable deployer address.

**Errors:** `NotFound`

---

### Query Functions

#### `get_circle_state`

```rust
pub fn get_circle_state(env: Env) -> Result<CircleData, AjoError>
```

Returns the full `CircleData` struct.

**Errors:** `NotFound`

---

#### `get_member_balance`

```rust
pub fn get_member_balance(env: Env, member: Address) -> Result<MemberData, AjoError>
```

Returns the `MemberData` for a specific member.

**Errors:** `NotFound`

---

#### `get_total_pool`

```rust
pub fn get_total_pool(env: Env) -> i128
```

Returns the running total of tokens deposited via `deposit`. Returns `0` if no deposits have been made. Note: this value is only updated by `deposit`, not by `contribute`.

---

#### `get_last_deposit_timestamp`

```rust
pub fn get_last_deposit_timestamp(env: Env, member: Address) -> Result<u64, AjoError>
```

Returns the ledger timestamp of the member's most recent `deposit` call.

**Errors:** `NotFound`

---

#### `get_fee_config`

```rust
pub fn get_fee_config(env: Env) -> Option<FeeConfig>
```

Returns the fee configuration if one has been set, otherwise `None`.

---

## Circle Lifecycle

```
initialize_circle()
        |
        v
   [Active / unpaused]
        |
        |── join_circle() ──────────────────────────────────────────────────┐
        |                                                                    │
        |── shuffle_rotation() (organizer, before first round)              │
        |                                                                    │
        |── contribute() / deposit() ──── (round advances automatically)    │
        |                                                                    │
        |── claim_payout(member, cycle) ──────────────────────────────────┘
        |
        |── panic() / emergency_stop() / emergency_panic()
        |           |
        |           v
        |      [Paused = true]
        |           |
        |           |── resume() / resume_operations()
        |           |           |
        |           |           v
        |           |      [Active again]
        |           |
        |           └── (while paused: contribute/deposit/claim_payout blocked)
        |
        └── upgrade(new_wasm_hash) ── contract code replaced, storage intact
```

**Round advancement** happens automatically inside `contribute` and `deposit` when all `member_count` members have contributed `current_round * contribution_amount` tokens. The deadline is extended by `frequency_days * 86400` seconds and `current_round` increments.

---

## Security Model

### Authentication

Every state-mutating function requires explicit auth from the relevant party:
- Member operations (`contribute`, `deposit`, `claim_payout`) require `member.require_auth()`
- Organizer operations (`join_circle`, `shuffle_rotation`) require `organizer.require_auth()` and verify `organizer == circle.organizer`
- Admin operations use `require_admin`, which accepts the deployer or any address in the `ADMIN` role list
- Deployer-only operations use `require_deployer`, which only accepts the exact deployer address

### CEI Pattern in `claim_payout`

`claim_payout` follows Checks-Effects-Interactions strictly:
1. **Checks** — auth, pause state, member existence, `AlreadyPaid` guard, rotation enforcement, pool sufficiency
2. **Effects** — `has_received_payout = true`, `total_withdrawn` updated, pool decremented, all persisted to storage
3. **Interactions** — token transfer executed last

The `has_received_payout` flag is written before the transfer, so any re-entry attempt would be rejected by the `AlreadyPaid` check.

### Member Disqualification

A member is disqualified when `missed_count >= 3`. Disqualified members cannot call `contribute`, `deposit`, or `claim_payout`. The admin can also immediately deactivate a member via `boot_dormant_member`.

### Overflow Protection

All arithmetic uses Rust's `checked_add`, `checked_mul`, and `checked_sub`. Any overflow returns `AjoError::ArithmeticOverflow` (code 16) rather than wrapping or panicking.

---

## Events

| Topic | Data | Emitted by |
|---|---|---|
| `("created", organizer)` | `(contribution_amount, max_members, max_rounds, frequency_days, timestamp)` | `initialize_circle` |
| `("join", new_member)` | `(member_count, timestamp)` | `join_circle` |
| `("deposit", member)` | `(amount, current_round)` | `deposit` |
| `("contrib", member)` | `(amount, current_round, timestamp)` | `contribute` (first impl) |
| `("withdraw", member)` | `(payout, cycle, current_round, timestamp)` | `claim_payout` |
| `("panic", admin)` | `timestamp` | `panic` |
| `"emrg_panic"` | `(caller, timestamp)` | `emergency_panic` |
| `("booted", member)` | `(admin, timestamp)` | `boot_dormant_member` |
| `("slash", member)` | `(missed_count, is_active)` | `slash_member` |
| `("role_grnt", new_member)` | `(role, timestamp)` | `grant_role` |
| `("role_rvk", member)` | `(role, timestamp)` | `revoke_role` |

---

## Factory Contract

**Location:** `contracts/ajo-circle/src/factory.rs`

`AjoFactory` provides a single-transaction deployment path that creates a new `AjoCircle` instance and calls `initialize_circle` in one step.

### `create_ajo`

```rust
pub fn create_ajo(
    env: Env,
    organizer: Address,
    ajo_wasm_hash: BytesN<32>,
    token_address: Address,
    contribution_amount: i128,
    frequency_days: u32,
    max_rounds: u32,
    max_members: u32,
) -> Result<Address, AjoError>
```

**Auth:** `organizer.require_auth()`

**Behavior:**
1. Reads the current registry length from `FactoryDataKey::Registry` to derive a deterministic salt
2. Deploys a new contract instance from `ajo_wasm_hash` using `env.deployer().with_current_contract(salt).deploy(...)`
3. Calls `initialize_circle` on the new instance with the provided parameters
4. Appends the new contract address to the registry
5. Returns the new circle's `Address`

The salt is derived from the registry length encoded as big-endian bytes, ensuring each deployment gets a unique address.

---

## Building the Contract

```bash
cd contracts/ajo-circle
cargo build --target wasm32-unknown-unknown --release
```

Output: `target/wasm32-unknown-unknown/release/ajo_circle.wasm`

To run the test suite:

```bash
cd contracts/ajo-circle
cargo test
```

Test modules:
- `test` — general integration tests
- `deposit_tests` — deposit and pool tracking tests
- `withdrawal_tests` — payout and withdrawal tests
