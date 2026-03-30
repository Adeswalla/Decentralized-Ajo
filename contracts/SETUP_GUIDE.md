# Smart Contract Setup Guide

## Current Implementation: Stellar Soroban (Rust)

This project currently uses **Stellar Soroban** smart contracts written in Rust, not Ethereum/Solidity. The Ajo Circle contract is fully implemented and production-ready.

## Project Structure

```
contracts/
├── ajo-circle/
│   ├── src/
│   │   ├── lib.rs          # Main Ajo Circle contract
│   │   └── factory.rs      # Factory contract for deployment
│   ├── Cargo.toml          # Rust dependencies
│   ├── rust-toolchain.toml # Rust version specification
│   └── README.md           # Contract documentation
```

## Prerequisites

### Required Tools

1. **Rust** (via rustup)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Soroban CLI**
   ```bash
   cargo install --locked soroban-cli
   ```

3. **Stellar SDK** (for frontend integration)
   ```bash
   npm install @stellar/stellar-sdk
   ```

## Building the Contracts

### 1. Navigate to Contract Directory
```bash
cd contracts/ajo-circle
```

### 2. Build Optimized WASM
```bash
cargo build --target wasm32-unknown-unknown --release
```

The compiled WASM will be in:
```
target/wasm32-unknown-unknown/release/ajo_circle.wasm
```

### 3. Optimize WASM (Optional)
```bash
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/ajo_circle.wasm
```

## Testing

### Run Unit Tests
```bash
cargo test --lib
```

### Run Specific Test
```bash
cargo test test_panic_happy_path
```

### Run with Output
```bash
cargo test -- --nocapture
```

## Deployment

### 1. Configure Network

**Testnet:**
```bash
soroban config network add \
  --global testnet \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"
```

**Mainnet:**
```bash
soroban config network add \
  --global mainnet \
  --rpc-url https://soroban-mainnet.stellar.org:443 \
  --network-passphrase "Public Global Stellar Network ; September 2015"
```

### 2. Create Identity
```bash
soroban config identity generate deployer
```

### 3. Fund Account (Testnet)
```bash
soroban config identity fund deployer --network testnet
```

### 4. Deploy Contract
```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/ajo_circle.wasm \
  --source deployer \
  --network testnet
```

### 5. Install WASM (for Factory Pattern)
```bash
soroban contract install \
  --wasm target/wasm32-unknown-unknown/release/ajo_circle.wasm \
  --source deployer \
  --network testnet
```

This returns a WASM hash that can be used with the factory contract.

## Interacting with Deployed Contract

### Initialize Circle
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- \
  initialize_circle \
  --organizer <ORGANIZER_ADDRESS> \
  --token_address <TOKEN_CONTRACT_ID> \
  --contribution_amount 100000000 \
  --frequency_days 7 \
  --max_rounds 12 \
  --max_members 10
```

### Add Member
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- \
  join_circle \
  --organizer <ORGANIZER_ADDRESS> \
  --new_member <MEMBER_ADDRESS>
```

### Contribute
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source member \
  --network testnet \
  -- \
  contribute \
  --member <MEMBER_ADDRESS> \
  --amount 100000000
```

### Get Circle State
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- \
  get_circle_state
```

## Frontend Integration

### Install Dependencies
```bash
npm install @stellar/stellar-sdk
```

### Example: Initialize Circle
```typescript
import { Contract, SorobanRpc, TransactionBuilder, Networks } from '@stellar/stellar-sdk';

const contract = new Contract(contractId);
const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');

// Build transaction
const account = await server.getAccount(organizerPublicKey);
const transaction = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    contract.call(
      'initialize_circle',
      organizerAddress,
      tokenAddress,
      contributionAmount,
      frequencyDays,
      maxRounds,
      maxMembers
    )
  )
  .setTimeout(30)
  .build();

// Sign and submit
transaction.sign(organizerKeypair);
const response = await server.sendTransaction(transaction);
```

## Alternative: Ethereum/Solidity Setup (Not Implemented)

If you want to migrate to Ethereum, here's what you would need:

### Hardhat Setup
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
```

### Foundry Setup
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge init
```

### Example Solidity Structure
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Ajo Circle
/// @notice Rotating savings and credit association
contract AjoCircle {
    /// @notice Circle configuration
    struct CircleData {
        address organizer;
        address tokenAddress;
        uint256 contributionAmount;
        uint256 frequencyDays;
        uint256 maxRounds;
        uint256 currentRound;
        uint256 memberCount;
        uint256 maxMembers;
    }
    
    /// @notice Member contribution tracking
    struct MemberData {
        address memberAddress;
        uint256 totalContributed;
        uint256 totalWithdrawn;
        bool hasReceivedPayout;
        uint8 status;
    }
    
    // State variables
    CircleData public circle;
    mapping(address => MemberData) public members;
    
    /// @notice Initialize new circle
    /// @param _tokenAddress Token contract address
    /// @param _contributionAmount Required contribution per round
    /// @param _frequencyDays Round duration in days
    /// @param _maxRounds Total number of rounds
    /// @param _maxMembers Maximum member capacity
    constructor(
        address _tokenAddress,
        uint256 _contributionAmount,
        uint256 _frequencyDays,
        uint256 _maxRounds,
        uint256 _maxMembers
    ) {
        // Implementation
    }
}
```

## Environment Variables

Create `.env` file:
```bash
# Stellar
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
DEPLOYER_SECRET_KEY=S...

# Token Contracts
USDC_CONTRACT_ID=C...
XLM_CONTRACT_ID=C...

# Deployed Contracts
AJO_CIRCLE_CONTRACT_ID=C...
AJO_FACTORY_CONTRACT_ID=C...
```

## Verification

### Verify Contract on Stellar Expert
1. Go to https://stellar.expert/explorer/testnet
2. Search for your contract ID
3. View contract code and transactions

## Troubleshooting

### Build Errors
```bash
# Clean and rebuild
cargo clean
cargo build --target wasm32-unknown-unknown --release
```

### Test Failures
```bash
# Run with verbose output
cargo test -- --nocapture --test-threads=1
```

### Deployment Issues
```bash
# Check account balance
soroban config identity address deployer
# Fund if needed
soroban config identity fund deployer --network testnet
```

## Resources

- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Soroban Examples](https://github.com/stellar/soroban-examples)
- [Stellar Expert](https://stellar.expert/)

## Next Steps

1. ✅ Contract implementation complete
2. ✅ Unit tests passing
3. 🔄 Deploy to testnet
4. 🔄 Frontend integration
5. 🔄 Mainnet deployment

## Support

For issues or questions:
- Check the contract README: `contracts/ajo-circle/README.md`
- Review test cases: `contracts/ajo-circle/src/lib.rs` (tests module)
- Consult Soroban docs: https://soroban.stellar.org
