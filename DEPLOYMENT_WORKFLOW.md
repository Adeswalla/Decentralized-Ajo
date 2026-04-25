# AjoFactory Deployment Workflow - Quick Reference

This document provides a quick reference for deploying AjoFactory to Sepolia testnet.

## Prerequisites

```bash
# 1. Install dependencies
pnpm install

# 2. Create .env file
cp .env.example .env

# 3. Fill in required values in .env:
# - SEPOLIA_RPC_URL
# - SEPOLIA_PRIVATE_KEY
# - ETHERSCAN_API_KEY (optional but recommended)

# 4. Get testnet ETH from faucet: https://sepoliafaucet.com/
```

## Quick Start

```bash
# 1. Compile contracts
pnpm contract:compile

# 2. Deploy to Sepolia
pnpm contract:deploy:sepolia

# 3. Done! ✅ Contract is verified and artifacts are saved
```

## Available Commands

```bash
# Compilation
pnpm contract:compile          # Compile all contracts

# Deployment
pnpm contract:deploy:sepolia   # Deploy to Sepolia testnet ⭐
pnpm contract:deploy:local     # Deploy locally for testing

# Testing
pnpm contract:test             # Run all tests
pnpm contract:test:gas         # Run tests with gas reporting

# Verification & Utilities
pnpm contract:verify           # Manually verify on Etherscan
pnpm contract:accounts         # Show available accounts
pnpm contract:clean            # Clean build artifacts
pnpm hardhat:node              # Start local Hardhat node
```

## Deployment Script Features

The deployment script includes:

✅ **Pre-flight checks**
- Validates account balance
- Confirms network configuration
- Checks RPC connectivity

✅ **Enhanced error handling**
- Detects already-deployed contracts
- Prevents wasting gas on retries
- Clear error messages

✅ **Automatic verification**
- Submits contract to Etherscan
- Waits for indexing
- Provides public verification link

✅ **Frontend integration**
- Saves contract ABI to JSON
- Creates ready-to-use deployment config
- No manual copy-pasting needed

✅ **Comprehensive logging**
- Deployment TX hash
- Contract address
- Gas usage
- Network details

## Deployment Output

After successful deployment, you'll see:

```
============================================================
🏭 AjoFactory Deployment Script
Network: SEPOLIA
============================================================

✅ Pre-flight checks passed!

✅ AjoFactory deployed successfully!

============================================================
📍 Contract Address: 0x...
📊 Deployment TX: 0x...
📦 Block Number: 1234567
💰 Gas Used: 1,123,456
============================================================

✓ Saved deployment artifacts to frontend/constants/deployments/sepolia-addresses.json

✅ Contract verified on Etherscan!
🔗 View on Etherscan: https://sepolia.etherscan.io/address/0x...
```

## File Structure

```
project/
├── contracts/
│   └── ethereum/
│       └── AjoFactory.sol          # Main contract
├── scripts/
│   └── deploy.ts                   # Deployment script ⭐
├── test/
│   └── AjoFactory.test.ts          # Contract tests
├── lib/
│   ├── deployment-utils.ts         # Helper functions
│   └── [other libs]
├── frontend/
│   └── constants/
│       └── deployments/
│           └── sepolia-addresses.json  # Generated from deployment
├── hardhat.config.ts               # Hardhat configuration
├── .env.example                    # Environment template
├── DEPLOYMENT_SEPOLIA.md           # Full deployment guide
├── DEPLOYMENT_WORKFLOW.md          # This file
└── package.json                    # Updated with Hardhat deps
```

## Integration with Frontend

After deployment, use the contract in your frontend:

```typescript
// Import deployment config
import deployments from '@/constants/deployments/sepolia-addresses.json'

// Get contract details
const contractAddress = deployments.contracts.AjoFactory.address
const contractABI = deployments.contracts.AjoFactory.abi

// Create ethers contract instance
import { ethers } from 'ethers'
const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_KEY')
const contract = new ethers.Contract(contractAddress, contractABI, provider)

// Use contract
const circles = await contract.getUserCircles(userAddress)
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Insufficient Funds" | Get testnet ETH from [faucet](https://sepoliafaucet.com/) |
| "RPC URL not set" | Add `SEPOLIA_RPC_URL` to `.env` |
| "Invalid Private Key" | Check key format (without `0x` prefix) |
| "Already verified" | Contract was previously verified, can skip |
| "Gas estimation failed" | Check contract syntax with `pnpm contract:compile` |
| "Contract not found" | Wait for Etherscan indexing (usually 30-60s) |

See [DEPLOYMENT_SEPOLIA.md](./DEPLOYMENT_SEPOLIA.md) for detailed troubleshooting.

## Network Details

**Sepolia Testnet:**
- Chain ID: `11155111`
- RPC: `https://sepolia.infura.io/v3/YOUR_KEY`
- Explorer: `https://sepolia.etherscan.io/`
- Faucet: `https://sepoliafaucet.com/`

**Local Hardhat:**
- Chain ID: `31337`
- RPC: `http://127.0.0.1:8545`
- No testnet ETH needed

## Security Checklist

- [ ] Never commit `.env` with real keys
- [ ] Use testnet account with minimal funds
- [ ] Keep private key secure
- [ ] Verify contracts on Etherscan
- [ ] Test on testnet before mainnet
- [ ] Use hardware wallet for mainnet

## Deployment Sequence

```
1. npm install                    # Install dependencies
2. Create .env                    # Add credentials
3. pnpm contract:compile          # Verify contracts compile
4. Get testnet ETH               # Fund account
5. pnpm contract:test             # Run tests (optional)
6. pnpm contract:deploy:sepolia   # Deploy to testnet ⭐
7. Verify on Etherscan           # Check verification
8. Update frontend config         # Use contract address
9. Test integration              # Verify end-to-end
```

## Support

- **Hardhat Docs**: https://hardhat.org/docs
- **Ethers.js Docs**: https://docs.ethers.org/v6/
- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Etherscan API**: https://docs.etherscan.io/

## Next Steps After Deployment

1. ✅ Contract deployed and verified
2. 🔄 Test circle creation through contract
3. 🔄 Test member participation
4. 🔄 Test contribution flow
5. 📱 Integrate with frontend
6. 🧪 End-to-end testing
7. 📚 Update documentation
8. 🚀 Plan mainnet deployment

---

**Last Updated**: March 2024
**Version**: 1.0.0
