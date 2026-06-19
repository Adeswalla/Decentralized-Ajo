# DecentralisedAjo Soroban Smart Contract

This directory contains the Soroban smart contract for the DecentralisedAjo rotating savings platform.

## Contract Features

### Group Management
- Create rotating savings groups with configurable parameters
- Support for multiple payment cycles (weekly, biweekly, monthly)
- Admin-controlled member management
- Flexible member count (2-100 members)

### Contribution Tracking
- Record member contributions per cycle
- Track contribution status (paid/pending)
- Ensure all members contribute before payout
- Prevent double-contributions in same cycle

### Payout Processing
- Two payout methods: Random or Fixed order
- Automatic recipient selection
- Atomic fund transfer to recipient
- Cycle completion tracking

### Fund Security
- All funds held in smart contract escrow
- Only authorized operations can move funds
- No manual fund extraction (except by payout)
- Complete transaction audit trail

## File Structure

```
contract/
├── README.md                 # This file
├── DEPLOYMENT.md            # Deployment guide and API reference
├── src/                      # Smart contract source code (Rust)
│   ├── lib.rs              # Contract entry points
│   ├── group.rs            # Group data structures
│   ├── contribution.rs      # Contribution logic
│   └── payout.rs           # Payout processing logic
├── Cargo.toml              # Rust dependencies
└── examples/               # Integration examples
    ├── create_group.rs     # Example: Create new group
    ├── contribute.rs       # Example: Submit contribution
    └── process_payout.rs   # Example: Process payout
```

## Quick Start

### Prerequisites
- Rust 1.73+
- Soroban CLI
- Stellar Test network funding

### Build
```bash
cd contract
soroban contract build
```

### Deploy to Testnet
```bash
soroban contract deploy \
  --network testnet \
  --source <YOUR_PUBLIC_KEY> \
  --wasm target/wasm32-unknown-unknown/release/ajo_group.wasm
```

### Interact
```bash
# Initialize group
soroban contract invoke \
  --network testnet \
  --id <CONTRACT_ID> \
  --source <ADMIN_KEY> \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --name "My Group" \
  --cycle_frequency 30 \
  --max_members 5 \
  --payout_order Fixed
```

## Contract Integration with Frontend

The frontend communicates with this contract via:

1. **Group Creation**: Deploy new contract instance
2. **Contributions**: Invoke `contribute` function
3. **Payouts**: Call `process_payout` function
4. **Queries**: Read group state with `get_*` functions

See `DEPLOYMENT.md` for full API reference.

## Security Audits

This contract has been designed following Stellar security best practices:
- Input validation on all parameters
- Access control checks
- Reentrancy protection
- Proper error handling

⚠️ **Note**: This is a sample implementation. Before production use, conduct a professional security audit.

## Gas Optimization

- Batch operations to reduce transaction count
- Use efficient data structures
- Optimize state mutations
- Cache frequently accessed values

## Testing

```bash
# Run contract tests
cargo test

# Run with logging
RUST_LOG=debug cargo test
```

## Mainnet Deployment

To deploy to Stellar Mainnet:

1. Use production keypair (hardware wallet recommended)
2. Deploy to public network
3. Update frontend environment variables
4. Perform final integration testing

```bash
soroban config network add --name mainnet \
  --rpc-url https://soroban-mainnet.stellar.org:443

soroban contract deploy \
  --network mainnet \
  --source <PROD_KEY> \
  --wasm target/wasm32-unknown-unknown/release/ajo_group.wasm
```

## Support

- **Stellar Docs**: https://developers.stellar.org/
- **Soroban SDK**: https://github.com/stellar/rs-soroban-sdk
- **Issues**: Create ticket in repository

## License

This smart contract is provided as part of the DecentralisedAjo platform.
