# AjoFactory Deployment Guide - Sepolia Testnet

This guide covers deploying the AjoFactory smart contract to the Sepolia testnet for testing and frontend integration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup](#setup)
3. [Configuration](#configuration)
4. [Deployment](#deployment)
5. [Verification](#verification)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **npm or pnpm**: Package manager
- **Testnet ETH**: You'll need Sepolia testnet ETH for gas fees
- **Etherscan API Key**: For contract verification (optional but recommended)

### Install Required Tools

```bash
# Install Hardhat globally (optional)
npm install -g hardhat

# Or use npx (provided via npm)
npx hardhat --help
```

### Get Testnet ETH

Get free Sepolia testnet ETH from these faucets:

- [Sepolia Faucet](https://sepoliafaucet.com/) - Recommended
- [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
- [Infura Faucet](https://www.infura.io/faucet/sepolia)

**⚠️ Warning**: Save your private key securely. Never share it or commit it to version control.

---

## Setup

### 1. Install Dependencies

```bash
# Install project dependencies
pnpm install

# Or using npm
npm install
```

This installs:
- `hardhat` - Ethereum development framework
- `@nomicfoundation/hardhat-toolbox` - Useful Hardhat plugins
- `@nomicfoundation/hardhat-verify` - For Etherscan verification
- `dotenv` - Environment variable management
- `ethers.js` v6 - Ethereum JavaScript library

### 2. Verify Installation

```bash
# Check Hardhat installation
npx hardhat --version

# Should output: hardhat 2.x.x
```

---

## Configuration

### 1. Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# Sepolia RPC URL (choose one provider)
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY

# Your private key (from MetaMask or wallet)
SEPOLIA_PRIVATE_KEY=your_private_key_hex_here

# Etherscan API Key for verification
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

#### RPC Provider Options

Choose one of these providers:

**Infura** (Recommended for reliability):
```
https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
```

**Alchemy**:
```
https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

**QuickNode**:
```
https://quiet-bright-seed.ethereum-sepolia.discover.quiknode.pro/YOUR_KEY/
```

**1RPC** (Free):
```
https://1rpc.io/sepolia
```

#### Getting Your Private Key

From **MetaMask**:
1. Open MetaMask
2. Click account menu → Settings
3. Security & Privacy → Show Private Key
4. Copy the key (without `0x` prefix, Hardhat adds it)

**⚠️ CRITICAL**: Never commit `.env` to git. It's already in `.gitignore`.

### 2. Verify Configuration

```bash
# Test your setup
npx hardhat accounts --network sepolia

# Should show accounts available for deployment
```

---

## Deployment

### 1. Compile Contracts

```bash
# Compile all contracts
npx hardhat compile

# Clean rebuild
npx hardhat clean && npx hardhat compile
```

This generates:
- Contract artifacts in `artifacts/`
- TypeScript types in `typechain-types/`

### 2. Run Pre-Deployment Checks

```bash
# Test the deployment script without sending transactions
npx hardhat run scripts/deploy.ts --network hardhat
```

This validates:
- Contract compilation
- Script logic
- No transaction errors

### 3. Deploy to Sepolia

```bash
# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.ts --network sepolia
```

The deployment script will:

1. ✅ **Run pre-flight checks**
   - Verify your account has sufficient balance
   - Confirm network configuration
   - Check RPC connectivity

2. 📊 **Estimate gas costs**
   - Calculate deployment gas

3. 📤 **Deploy AjoFactory**
   - Send deployment transaction
   - Wait for confirmation

4. 📝 **Verify on Etherscan** (if API key provided)
   - Wait 30 seconds for indexing
   - Submit verification request
   - Provide contract source code

5. 💾 **Save artifacts**
   - Export ABI to JSON
   - Save contract address
   - Create frontend integration file

#### Expected Output

```
============================================================
🏭 AjoFactory Deployment Script
Network: SEPOLIA
============================================================

📋 Running pre-flight checks...

✓ Deployer address: 0x1234...5678
✓ Deployer balance: 2.5 ETH
✓ Connected to Sepolia network
  Chain ID: 11155111

✅ Pre-flight checks passed!

🚀 Deploying AjoFactory...

📊 Estimating gas costs...
   Estimated gas: 1,250,000 units

📤 Sending deployment transaction...
   TX Hash: 0xabcd...ef01
   Waiting for confirmation...

✅ AjoFactory deployed successfully!

============================================================
📍 Contract Address: 0x9876...5432
📊 Deployment TX: 0xabcd...ef01
📦 Block Number: 5678900
💰 Gas Used: 1,123,456
============================================================

💾 Saving deployment artifacts for frontend...
✓ Saved deployment artifacts to frontend/constants/deployments/sepolia-addresses.json

🔍 Verifying contract on Etherscan...

⏳ Waiting 30 seconds for Etherscan to index contract...
📝 Submitting verification request...
✅ Contract verified on Etherscan!
🔗 View on Etherscan: https://sepolia.etherscan.io/address/0x9876...5432

============================================================
✅ Deployment Complete!
============================================================

Deployment Summary:
- Address: 0x9876...5432
- TX: 0xabcd...ef01
- Deployer: 0x1234...5678
- Time: 2024-03-29T10:30:45.123Z
```

---

## Verification

### 1. Check Deployment on Etherscan

Visit the contract address link provided in the deployment output:
```
https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS
```

You should see:
- Contract bytecode
- Verified source code
- Transaction history
- Read/Write contract interface

### 2. Manual Verification (if automatic verification failed)

```bash
# Verify specific contract
npx hardhat verify --network sepolia YOUR_CONTRACT_ADDRESS
```

### 3. Test Contract on Etherscan

Use Etherscan's UI to:
- Call read functions
- Execute write functions
- View storage
- Monitor gas usage

---

## Post-Deployment

### 1. Update Frontend Configuration

The deployment script automatically saves to:
```
frontend/constants/deployments/sepolia-addresses.json
```

Frontend usage:
```typescript
import deployments from '@/constants/deployments/sepolia-addresses.json'

const AJO_FACTORY_ADDRESS = deployments.contracts.AjoFactory.address
const AJO_FACTORY_ABI = deployments.contracts.AjoFactory.abi
```

### 2. Update Environment Variables

Add to your `.env` or `.env.local`:
```env
NEXT_PUBLIC_SEPOLIA_AJO_FACTORY_ADDRESS=0x...
```

### 3. Update Contract Address in Backend

If you have backend/API routes that need the contract address:

In `lib/contracts.ts` or similar:
```typescript
export const AJO_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_SEPOLIA_AJO_FACTORY_ADDRESS
```

### 4. Test Frontend Integration

```bash
# Start development server
pnpm dev

# Test contract interactions through frontend
```

---

## Troubleshooting

### Error: "Insufficient Funds"

**Solution**: Get more testnet ETH
```bash
# Visit faucet: https://sepoliafaucet.com/
# Send 1-5 test ETH to your address
```

### Error: "RPC URL not set"

**Solution**: Ensure `.env` file is configured correctly
```bash
# Check .env exists
ls -la .env

# Verify SEPOLIA_RPC_URL is set
echo $SEPOLIA_RPC_URL
```

### Error: "Invalid Private Key"

**Solution**: Ensure private key format is correct
```env
# CORRECT: without 0x prefix (Hardhat adds it)
SEPOLIA_PRIVATE_KEY=abcd1234...

# INCORRECT: don't include 0x
# SEPOLIA_PRIVATE_KEY=0xabcd1234...
```

### Error: "Contract already verified"

**Solution**: This is expected if deploying twice. You can view the existing verification on Etherscan.

### Error: "Etherscan API rate limit"

**Solution**: Wait a few minutes and retry
```bash
# Or skip verification and verify manually later
```

### Transaction Fails with "Out of Gas"

**Solution**: Increase gas settings in `hardhat.config.ts`
```typescript
sepolia: {
  // ... other config
  gas: 'auto',
  gasPrice: 'auto'
}
```

### Cannot Find Contract Artifacts

**Solution**: Recompile contracts
```bash
npx hardhat clean
npx hardhat compile
```

---

## Advanced Usage

### Deploy with Custom Gas Price

```bash
# Set environment variable for gas price
export GAS_PRICE_GWEI=20
npx hardhat run scripts/deploy.ts --network sepolia
```

### Deploy and Skip Verification

Edit `scripts/deploy.ts`:
```typescript
// Comment out or remove:
// await verifyContractOnEtherscan(ajoFactoryAddress, "AjoFactory");
```

Then deploy:
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

### Deploy Multiple Versions

Keep deployment history:
```
deployments/
├── sepolia-deployments.json  # Current
├── sepolia-deployments-v1.json
├── sepolia-deployments-v2.json
└── ...
```

The script automatically maintains this.

### Emergency Recovery

If deployment fails:

```bash
# Check previous deployments
cat deployments/sepolia-deployments.json

# Use existing address instead of redeploying
# Edit scripts/deploy.ts to use existing address

# Or redeploy (costs more gas)
npx hardhat run scripts/deploy.ts --network sepolia
```

---

## Next Steps

1. ✅ Deploy AjoFactory to Sepolia
2. ✅ Verify on Etherscan
3. ✅ Update frontend configuration
4. 🔄 Test contract interactions
5. 🧪 Run integration tests
6. 📤 Deploy frontend
7. 🚀 Test end-to-end

---

## Security Best Practices

✅ **DO:**
- Use environment variables for sensitive data
- Test on testnet before mainnet
- Verify contracts on Etherscan
- Keep private keys secure
- Use hardware wallets for mainnet

❌ **DON'T:**
- Commit `.env` files to git
- Share private keys
- Hardcode addresses in frontend
- Deploy unverified contracts
- Use same key for multiple networks

---

## Support Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Sepolia Etherscan](https://sepolia.etherscan.io/)
- [Ethereum DevHub](https://ethereum.org/en/developers/)

---

## Deployment Checklist

- [ ] Node.js v18+ installed
- [ ] Dependencies installed (`pnpm install`)
- [ ] `.env` file created and configured
- [ ] Sepolia private key added
- [ ] Testnet ETH in account (> 0.1 ETH)
- [ ] Contracts compile successfully (`npx hardhat compile`)
- [ ] Pre-deployment test passes (`npx hardhat run scripts/deploy.ts --network hardhat`)
- [ ] Deploy to Sepolia (`npx hardhat run scripts/deploy.ts --network sepolia`)
- [ ] Contract verified on Etherscan
- [ ] Frontend artifacts updated
- [ ] Environment variables updated
- [ ] Frontend integration tested

---

## Support & Feedback

For issues or questions:
1. Check this guide
2. Review Hardhat docs
3. Check Etherscan for transaction details
4. Open an issue on GitHub

Last updated: March 2024
