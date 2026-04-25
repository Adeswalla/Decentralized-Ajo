# Event Emissions Implementation

## Overview
This document describes the implementation of event emissions for key deposit and withdrawal actions in the Ajo Circle smart contract. These events enable off-chain systems (like The Graph indexers or the Node.js backend) to track state changes efficiently.

## Changes Made

### 1. Added Event Support
- **File**: `contracts/ajo-circle/src/lib.rs`
- **Change**: Added `symbol_short` to the imports from `soroban_sdk`
- **Line**: 5

```rust
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, Map, Vec};
```

### 2. Deposit Event Emission

#### Function: `deposit()`
- **Location**: End of the `deposit` function (after line 485)
- **Event Name**: `"deposit"`
- **Indexed Parameter**: Member address
- **Data Parameters**: 
  - `amount`: The deposit amount (i128)
  - `cycleId`: Current round number (u32)

```rust
// Emit DepositReceived event
env.events().publish(
    (symbol_short!("deposit"), member.clone()),
    (amount, circle.current_round)
);
```

### 3. Withdrawal Event Emissions

#### Function: `claim_payout()`
- **Location**: End of the `claim_payout` function (after line 717)
- **Event Name**: `"withdraw"`
- **Indexed Parameter**: Member address
- **Data Parameters**:
  - `payout`: The withdrawal amount (i128)
  - `cycleId`: Current round number (u32)

```rust
// Emit FundsWithdrawn event
env.events().publish(
    (symbol_short!("withdraw"), member.clone()),
    (payout, circle.current_round)
);
```

#### Function: `partial_withdraw()`
- **Location**: End of the `partial_withdraw` function (after line 772)
- **Event Name**: `"withdraw"`
- **Indexed Parameter**: Member address
- **Data Parameters**:
  - `net_amount`: The net withdrawal amount after penalty (i128)
  - `cycleId`: Current round number (u32)

```rust
// Emit FundsWithdrawn event for partial withdrawal
env.events().publish(
    (symbol_short!("withdraw"), member.clone()),
    (net_amount, circle.current_round)
);
```

#### Function: `dissolve_and_refund()`
- **Location**: End of the `dissolve_and_refund` function (after line 1000)
- **Event Name**: `"withdraw"`
- **Indexed Parameter**: Member address
- **Data Parameters**:
  - `refund`: The refund amount (i128)
  - `cycleId`: Current round number (u32)

```rust
// Emit FundsWithdrawn event for dissolution refund
env.events().publish(
    (symbol_short!("withdraw"), member.clone()),
    (refund, circle.current_round)
);
```

#### Function: `emergency_refund()`
- **Location**: End of the `emergency_refund` function (after line 1086)
- **Event Name**: `"withdraw"`
- **Indexed Parameter**: Member address
- **Data Parameters**:
  - `refund`: The refund amount (i128)
  - `cycleId`: Current round number (u32)

```rust
// Emit FundsWithdrawn event for emergency refund
env.events().publish(
    (symbol_short!("withdraw"), member.clone()),
    (refund, circle.current_round)
);
```

## Event Structure

### Soroban Event Format
In Soroban, events are published using the following pattern:
```rust
env.events().publish(topics, data);
```

Where:
- **Topics**: Used for indexing and filtering (includes event name and indexed parameters)
- **Data**: The actual event data payload

### Event Topics
Both events use a tuple format for topics:
- First element: Event name as a short symbol (`symbol_short!("deposit")` or `symbol_short!("withdraw")`)
- Second element: Member address (indexed for easy filtering)

### Event Data
Both events include:
- **amount/payout/net_amount/refund**: The token amount involved in the transaction
- **cycleId**: The current round number when the event occurred

## Benefits

1. **Off-chain Indexing**: The Graph or custom indexers can efficiently track all deposits and withdrawals
2. **Address Filtering**: Member addresses are indexed, allowing frontends to query events by specific members
3. **Audit Trail**: Complete history of all financial transactions in the circle
4. **Real-time Updates**: Backends can listen for events to update their databases in real-time
5. **Transparency**: All financial movements are publicly verifiable on-chain

## Usage for Off-chain Systems

### Filtering Events
Off-chain systems can filter events by:
- Event type (`"deposit"` or `"withdraw"`)
- Member address (indexed in topics)
- Block range or timestamp

### Example Use Cases
1. **User Dashboard**: Show a member's complete transaction history
2. **Circle Analytics**: Calculate total deposits and withdrawals per round
3. **Notifications**: Alert users when deposits or withdrawals occur
4. **Compliance**: Track all financial movements for regulatory purposes
5. **Data Synchronization**: Keep off-chain database in sync with on-chain state

## Testing Recommendations

1. **Unit Tests**: Add tests to verify events are emitted with correct parameters
2. **Integration Tests**: Verify off-chain indexers can capture and parse events
3. **Event Ordering**: Ensure events are emitted after state changes are committed
4. **Gas Costs**: Measure the gas impact of event emissions (should be minimal)

## Next Steps

1. Deploy the updated contract to testnet
2. Configure The Graph subgraph to index these events
3. Update the Node.js backend to listen for and process events
4. Add event monitoring to the frontend for real-time updates
5. Create comprehensive event documentation for API consumers
