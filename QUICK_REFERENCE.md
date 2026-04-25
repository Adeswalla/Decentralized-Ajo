# AjoFactory Deployment - Quick Reference Card

## 🚀 3-Step Quick Deploy

```bash
# 1. Setup
pnpm install && cp .env.example .env

# 2. Configure .env with:
#    - SEPOLIA_RPC_URL
#    - SEPOLIA_PRIVATE_KEY
#    - ETHERSCAN_API_KEY (optional)

# 3. Deploy
pnpm contract:deploy:sepolia
```

---

## 📋 Essential Commands

```bash
# Compile
pnpm contract:compile

# Deploy to Sepolia
pnpm contract:deploy:sepolia          # ⭐ MAIN COMMAND

# Test
pnpm contract:test
pnpm contract:test:gas

# Check status
npx hardhat run scripts/check-deployment.ts --network sepolia

# Verify on Etherscan
pnpm contract:verify
```

---

## 🔑 Environment Variables (.env)

```env
# REQUIRED for Sepolia deployment
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
SEPOLIA_PRIVATE_KEY=your_private_key_without_0x

# OPTIONAL but recommended
ETHERSCAN_API_KEY=your_api_key
```

---

## 🌐 Network Details

| Property | Value |
|----------|-------|
| Network | Sepolia Testnet |
| Chain ID | 11155111 |
| Explorer | https://sepolia.etherscan.io/ |
| RPC URL | https://sepolia.infura.io/v3/YOUR_KEY |
| Faucet | https://sepoliafaucet.com/ |

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `hardhat.config.ts` | Network config |
| `scripts/deploy.ts` | Deployment script |
| `contracts/ethereum/AjoFactory.sol` | Smart contract |
| `DEPLOYMENT_WORKFLOW.md` | Quick guide |
| `DEPLOYMENT_SEPOLIA.md` | Full guide |

---

## ✅ Pre-Deployment Checklist

- [ ] Node.js v18+ installed
- [ ] `pnpm install` completed
- [ ] `.env` file configured
- [ ] Testnet ETH obtained (> 0.1 ETH)
- [ ] `pnpm contract:compile` passes
- [ ] Ready to deploy!

---

## 🔗 Key Links

- Sepolia Faucet: https://sepoliafaucet.com/
- Etherscan: https://sepolia.etherscan.io/
- Hardhat Docs: https://hardhat.org/docs
- Ethers.js Docs: https://docs.ethers.org/v6/

---

## 📊 Expected Output

After successful deployment:

```
✅ Pre-flight checks passed!
✅ AjoFactory deployed successfully!

📍 Contract Address: 0x...
📊 Deployment TX: 0x...
📦 Block Number: 1234567
💰 Gas Used: 1,123,456

✅ Contract verified on Etherscan!
🔗 View on Etherscan: https://sepolia.etherscan.io/address/0x...
```

---

## 🆘 Quick Troubleshooting

| Error | Solution |
|-------|----------|
| "Insufficient Funds" | Get testnet ETH from faucet |
| "RPC URL not set" | Add SEPOLIA_RPC_URL to .env |
| "Invalid Private Key" | Remove 0x prefix, check format |
| "Already verified" | Expected, can skip |

---

## 📞 Useful Commands

```bash
# See Sepolia accounts
npx hardhat accounts --network sepolia

# Clean and rebuild
pnpm contract:clean && pnpm contract:compile

# Check deployment status
npx hardhat run scripts/check-deployment.ts --network sepolia

# Run local tests
pnpm contract:test

# Start local Hardhat node
pnpm hardhat:node
```

---

## 🎯 Deployment Flow

```
1. pnpm install              # Install dependencies
2. Configure .env            # Add credentials
3. Get testnet ETH          # Visit faucet
4. pnpm contract:compile    # Verify compilation
5. pnpm contract:test       # Run tests (optional)
6. pnpm contract:deploy:sepolia  # DEPLOY ⭐
7. Verify on Etherscan      # Check verification
8. Integrate frontend       # Use contract
```

---

## 💾 After Deployment

**Contract Address Location:**
- Output console
- `deployments/sepolia-deployments.json`
- Etherscan link

**Frontend Artifacts:**
- `frontend/constants/deployments/sepolia-addresses.json`
- Ready to import in React

---

## 🔐 Security Checklist

- ✅ .env in .gitignore
- ✅ Private key secure
- ✅ Never commit .env
- ✅ Use testnet keys only
- ✅ Verify contracts on Etherscan

---

## 📖 Documentation Files

1. **DEPLOYMENT_START_HERE.md** ← Start here!
2. **DEPLOYMENT_WORKFLOW.md** - Quick reference
3. **DEPLOYMENT_SEPOLIA.md** - Complete guide
4. **FRONTEND_INTEGRATION.md** - Frontend usage
5. **DEPLOYMENT_CHECKLIST.md** - Deployment tracking

---

## 🚀 One-Liner Deploy

```bash
pnpm install && cp .env.example .env && pnpm contract:deploy:sepolia
```

(Remember to configure .env first!)

---

## 📱 Frontend Integration

```typescript
// Import deployment config
import deployments from '@/constants/deployments/sepolia-addresses.json'

// Get contract details
const address = deployments.contracts.AjoFactory.address
const abi = deployments.contracts.AjoFactory.abi

// Use with ethers.js
import { ethers } from 'ethers'
const contract = new ethers.Contract(address, abi, provider)
```

---

## 🎓 Learning Path

1. **First time?**
   → Read DEPLOYMENT_START_HERE.md

2. **Need to deploy?**
   → Follow DEPLOYMENT_WORKFLOW.md

3. **Want all details?**
   → Read DEPLOYMENT_SEPOLIA.md

4. **Frontend developer?**
   → Check FRONTEND_INTEGRATION.md

5. **Managing deployment?**
   → Use DEPLOYMENT_CHECKLIST.md

---

## ⏱️ Timeline

| Time | Activity |
|------|----------|
| 5 min | Setup and configure |
| 2 min | Get testnet ETH |
| 5 min | Deploy and verify |
| 15 min | Etherscan verification |
| **27 min** | **Total time** |

---

## 💡 Pro Tips

✅ Keep this card handy during deployment
✅ Check Etherscan for real-time TX status
✅ Save contract address immediately
✅ Test frontend integration early
✅ Monitor gas usage for optimization

---

## 🆘 Need Help?

**Common Issues:**
- See: DEPLOYMENT_SEPOLIA.md (Troubleshooting)
- See: DEPLOYMENT_CHECKLIST.md (Troubleshooting Reference)

**Resources:**
- Hardhat: https://hardhat.org/docs
- Ethers.js: https://docs.ethers.org/v6/
- Solidity: https://docs.soliditylang.org/

---

## ✅ Deployment Success Criteria

✅ Contract deployed to Sepolia
✅ Address visible in output
✅ Tx confirmed on Etherscan
✅ Contract verified on Etherscan
✅ Artifacts saved to frontend
✅ Frontend can import config
✅ Contract readable on Etherscan

---

**Ready?** Run: `pnpm contract:deploy:sepolia`

**Questions?** Check DEPLOYMENT_SEPOLIA.md

---

*AjoFactory Ethereum Deployment - Quick Reference*
*Version 1.0 | March 2024*
