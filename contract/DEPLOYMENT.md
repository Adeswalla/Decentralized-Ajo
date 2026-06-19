# DecentralisedAjo Soroban Smart Contract

## Overview

The DecentralisedAjo platform uses Soroban smart contracts on the Stellar network to manage rotating savings groups in a decentralized and transparent manner.

## Contract Architecture

### Main Contract: `AjoGroup`

The core contract manages a single savings group with the following functionality:

#### Data Structures

```rust
struct GroupData {
    admin: Address,
    name: String,
    description: String,
    total_pool: i128,
    currency: String, // "XLM" or "USDC"
    cycle_frequency: u32, // days
    max_members: u32,
    payout_order: PayoutOrder,
    members: Vec<Address>,
    member_contributions: Map<Address, i128>,
    current_cycle: u32,
    is_active: bool,
}

enum PayoutOrder {
    Random,
    Fixed,
}
```

#### Key Functions

##### 1. `initialize()`
- **Purpose**: Deploy and initialize a new group
- **Parameters**:
  - `admin`: Admin wallet address
  - `name`: Group name
  - `description`: Group description
  - `cycle_frequency`: Contribution frequency in days
  - `max_members`: Maximum number of members
  - `payout_order`: Random or Fixed payout order
- **Returns**: Group contract address

##### 2. `contribute()`
- **Purpose**: Submit contribution to group
- **Parameters**:
  - `member`: Contributing member address
  - `amount`: Contribution amount in stroops
- **Validation**:
  - Member must be registered
  - Amount must match cycle requirement
  - Within contribution deadline
- **Events**: Emits `ContributionMade(member, amount, cycle)`

##### 3. `process_payout()`
- **Purpose**: Distribute payout to next member in rotation
- **Prerequisites**:
  - All members have contributed for current cycle
  - Enough time has passed since cycle start
- **Logic**:
  - Calculate total pool
  - Select next recipient (random or fixed)
  - Transfer funds to recipient
  - Mark cycle as complete
- **Events**: Emits `PayoutProcessed(recipient, amount, cycle)`

##### 4. `add_member()`
- **Purpose**: Add new member to group
- **Parameters**:
  - `member_address`: New member wallet
- **Requirements**:
  - Only admin can call
  - Not exceeding max_members limit
  - Member not already in group
- **Events**: Emits `MemberAdded(member_address)`

##### 5. `remove_member()`
- **Purpose**: Remove member from group
- **Parameters**:
  - `member_address`: Member to remove
- **Requirements**:
  - Only admin can call
  - Cannot remove during active cycle
- **Events**: Emits `MemberRemoved(member_address)`

##### 6. `get_balance()`
- **Purpose**: Get current group pool balance
- **Returns**: Total amount in contract (in stroops)

##### 7. `get_member_contribution()`
- **Purpose**: Get specific member's contribution for current cycle
- **Parameters**:
  - `member_address`: Member address
- **Returns**: Contribution amount

##### 8. `close_group()`
- **Purpose**: Deactivate group (all payouts complete)
- **Requirements**:
  - All members have received payout
  - Only admin can call
- **Events**: Emits `GroupClosed()`

## Deployment Process

### Prerequisites
```bash
# Install Stellar CLI
brew install stellar/tap/soroban-cli

# Set network (testnet for development)
soroban config network add --name testnet \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"
```

### Contract Deployment

```bash
# Navigate to contract directory
cd contract/

# Build the contract
soroban contract build

# Deploy to testnet
soroban contract deploy \
  --network testnet \
  --source <ADMIN_PUBLIC_KEY> \
  --wasm target/wasm32-unknown-unknown/release/decentralised_ajo.wasm

# Output example:
# Contract deployed successfully!
# Contract ID: CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJW3Z5
```

### Contract Invocation Example

```bash
# Initialize a new group
soroban contract invoke \
  --network testnet \
  --id CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJW3Z5 \
  --source <ADMIN_KEY> \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --name "Tech Friends Savings" \
  --description "Monthly savings for tech professionals" \
  --cycle_frequency 30 \
  --max_members 5 \
  --payout_order Fixed

# Make a contribution
soroban contract invoke \
  --network testnet \
  --id CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJW3Z5 \
  --source <MEMBER_KEY> \
  -- contribute \
  --member <MEMBER_ADDRESS> \
  --amount 500000000  # 50 XLM in stroops
```

## Security Considerations

1. **Input Validation**
   - All amounts validated against stroops (1 XLM = 10,000,000 stroops)
   - Member addresses verified against contract registry
   - Cycle timing enforced at contract level

2. **Access Control**
   - Only admin can add/remove members
   - Only registered members can contribute
   - Payout processing has time-based guards

3. **Fund Safety**
   - Funds locked in contract until payout
   - No arbitrary fund transfers
   - Clear audit trail via events

4. **Reentrancy Protection**
   - State changes before external calls
   - Atomic operations (contribute + update)

## Event Logs

All significant actions are logged as contract events:

- `ContributionMade(member, amount, cycle)`
- `PayoutProcessed(recipient, amount, cycle)`
- `MemberAdded(member_address)`
- `MemberRemoved(member_address)`
- `GroupClosed()`
- `CycleStarted(cycle_number)`

## Testing

```bash
# Run unit tests
soroban contract test

# Run integration tests
cargo test --test integration_tests
```

## Contract Verification

View deployed contract on Stellar Expert:
```
https://stellar.expert/explorer/testnet/contract/{CONTRACT_ID}
```

## Update Process

To upgrade contract logic:
1. Deploy new version with different contract ID
2. Migrate member data via script
3. Update frontend environment variables
4. Keep old contract for audit trail

## Support

For contract questions or issues:
- Stellar Documentation: https://developers.stellar.org/docs/smart-contracts
- Soroban GitHub: https://github.com/stellar/rs-soroban-sdk
- Discord: https://discord.gg/stellardev
