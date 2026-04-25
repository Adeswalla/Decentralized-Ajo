# AjoFactory Deployment Checklist

Complete this checklist to ensure a successful deployment to Sepolia testnet.

## Pre-Deployment Setup

### Environment & Tools
- [ ] Node.js v18+ installed (`node --version`)
- [ ] npm or pnpm installed (`npm --version` or `pnpm --version`)
- [ ] Git configured locally
- [ ] MetaMask or compatible wallet installed
- [ ] Text editor/IDE ready

### Project Setup
- [ ] Repository cloned to local machine
- [ ] `pnpm install` completed successfully
- [ ] No dependency installation errors
- [ ] TypeScript compiles without errors (`pnpm contract:compile`)

### Credentials & Keys
- [ ] `.env` file created (copied from `.env.example`)
- [ ] Sepolia testnet account created
- [ ] Private key extracted from wallet
- [ ] Private key stored securely in `.env`
- [ ] `.env` file added to `.gitignore` (verify)
- [ ] RPC URL added to `.env` (Infura/Alchemy)
- [ ] Etherscan API key obtained (optional but recommended)
- [ ] Etherscan API key added to `.env`

### Pre-Flight Validation
- [ ] `.env` variables are correctly formatted
- [ ] Private key doesn't include `0x` prefix
- [ ] RPC URL is valid and accessible
- [ ] All required environment variables set
- [ ] Run: `npx hardhat accounts --network sepolia` (should show accounts)

## Testnet Funding

### Get Testnet ETH
- [ ] Visit Sepolia faucet: https://sepoliafaucet.com/
- [ ] Enter your wallet address
- [ ] Request testnet ETH (usually 1-5 ETH per request)
- [ ] Wait for confirmation (usually < 1 minute)
- [ ] Verify ETH received: `npx hardhat accounts --network sepolia`
- [ ] Check balance: Run `scripts/check-deployment.ts`
- [ ] Confirm balance >= 0.1 ETH

## Contract Preparation

### Smart Contract
- [ ] Review `contracts/ethereum/AjoFactory.sol`
- [ ] Understand contract functionality
- [ ] Review access controls
- [ ] Verify gas optimization

### Compilation
- [ ] Run `pnpm contract:compile`
- [ ] No compilation errors
- [ ] Artifacts generated in `/artifacts`
- [ ] TypeChain types generated in `/typechain-types`

### Testing
- [ ] Run `pnpm contract:test`
- [ ] All tests pass
- [ ] No test failures or warnings
- [ ] Review test coverage
- [ ] Optional: Run `pnpm contract:test:gas` for gas report

## Deployment Execution

### Pre-Deployment Checks
- [ ] All requirements above completed
- [ ] Internet connection stable
- [ ] Sufficient testnet ETH in account
- [ ] Hardhat configuration reviewed
- [ ] Script reviewed (`scripts/deploy.ts`)

### Deploy to Sepolia
- [ ] Run: `pnpm contract:deploy:sepolia`
- [ ] Script completes without errors
- [ ] Deployment TX hash visible in output
- [ ] Contract address displayed
- [ ] No "Insufficient Funds" error
- [ ] No "Invalid Private Key" error

### Deployment Confirmation
- [ ] Pre-flight checks passed ✓
- [ ] AjoFactory deployed successfully ✓
- [ ] Deployment artifacts saved ✓
- [ ] Contract verified on Etherscan ✓
- [ ] All output messages show success ✓

## Post-Deployment Verification

### On-Chain Verification
- [ ] Contract address obtained from output
- [ ] Open Etherscan link: `https://sepolia.etherscan.io/address/YOUR_ADDRESS`
- [ ] Contract code visible on Etherscan
- [ ] Contract is verified (green checkmark)
- [ ] All functions visible
- [ ] Can read contract state

### Deployment Records
- [ ] Check `deployments/sepolia-deployments.json`
- [ ] Deployment record contains:
  - [ ] Contract address
  - [ ] Transaction hash
  - [ ] Block number
  - [ ] Deployer address
  - [ ] Timestamp

### Frontend Artifacts
- [ ] Check `frontend/constants/deployments/sepolia-addresses.json`
- [ ] File contains:
  - [ ] Network: "sepolia"
  - [ ] Chain ID: 11155111
  - [ ] Contract address
  - [ ] Complete ABI
  - [ ] Deployment timestamp
  - [ ] Block number

## Frontend Integration

### Setup
- [ ] Review `FRONTEND_INTEGRATION.md`
- [ ] Understand integration approach
- [ ] Create necessary React hooks
- [ ] Set up contract provider

### Environment Variables
- [ ] Add contract address to `.env.local`:
  ```
  NEXT_PUBLIC_SEPOLIA_AJO_FACTORY_ADDRESS=0x...
  ```
- [ ] Environment variable accessible in frontend
- [ ] No hardcoded addresses in code

### Component Integration
- [ ] Create `hooks/useAjoFactory.ts`
- [ ] Create circle creation component
- [ ] Create circle joining component
- [ ] Create contribution component
- [ ] Create data reading functions
- [ ] Test all components

### Testing Contract Interactions
- [ ] Test circle creation
- [ ] Test circle joining
- [ ] Test membership checks
- [ ] Test contribution flow
- [ ] Test read operations
- [ ] Monitor gas usage
- [ ] Check Etherscan for transactions

## Documentation & Knowledge Transfer

### Documentation
- [ ] Read `DEPLOYMENT_SEPOLIA.md`
- [ ] Read `DEPLOYMENT_WORKFLOW.md`
- [ ] Read `FRONTEND_INTEGRATION.md`
- [ ] Read `DEPLOYMENT_COMPLETE.md`
- [ ] Save relevant links and commands
- [ ] Document any local modifications

### Knowledge Sharing
- [ ] Share deployment details with team
- [ ] Share contract address with frontend team
- [ ] Share deployment artifacts with frontend team
- [ ] Document any custom configurations
- [ ] Update team documentation

## Security Validation

### Key Management
- [ ] `.env` is in `.gitignore`
- [ ] Verify `.env` not committed to git
- [ ] Private key hasn't been exposed
- [ ] No keys in git history
- [ ] Only testnet keys used

### Smart Contract Security
- [ ] No obvious security issues in contract
- [ ] Access controls are correct
- [ ] Emergency functions protected
- [ ] No hardcoded addresses
- [ ] Gas limits reasonable

### Network Security
- [ ] RPC URL is secure (https)
- [ ] Using reputable RPC provider
- [ ] API keys protected in `.env`
- [ ] No sensitive data exposed

## Quality Assurance

### Final Validation
- [ ] Contract deployed and verified ✓
- [ ] All tests pass ✓
- [ ] Frontend integration works ✓
- [ ] Gas costs acceptable ✓
- [ ] Documentation complete ✓
- [ ] Team informed ✓

### Performance Check
- [ ] Deployment transaction completed < 2 minutes
- [ ] Contract creation with reasonable gas
- [ ] No failed transactions
- [ ] No retry attempts needed

### Error Handling
- [ ] Error messages are clear
- [ ] Failed transactions handled properly
- [ ] Recovery procedures documented
- [ ] Troubleshooting guide present

## Post-Deployment Tasks

### Immediate (Today)
- [ ] Celebrate! 🎉
- [ ] Share contract address with team
- [ ] Share Etherscan link
- [ ] Test basic interactions
- [ ] Begin frontend integration

### Short-term (This Week)
- [ ] Complete frontend integration
- [ ] Conduct end-to-end testing
- [ ] Get team feedback
- [ ] Prepare for mainnet (if applicable)
- [ ] Document any issues found

### Medium-term (This Month)
- [ ] Monitor contract on testnet
- [ ] Gather user feedback
- [ ] Consider contract upgrades
- [ ] Plan mainnet deployment
- [ ] Update deployment procedures

## Troubleshooting Reference

### If Deployment Fails

**Error: "Insufficient Funds"**
- [ ] Get more testnet ETH from faucet
- [ ] Check balance before retrying
- [ ] Ensure correct account is funded

**Error: "Invalid Private Key"**
- [ ] Check private key format (no `0x`)
- [ ] Verify in `.env` file
- [ ] Ensure correct wallet
- [ ] Retry deployment

**Error: "RPC URL not set"**
- [ ] Verify `.env` has `SEPOLIA_RPC_URL`
- [ ] Check RPC URL is valid
- [ ] Test connection manually
- [ ] Try alternative RPC provider

**Error: "Contract already deployed"**
- [ ] Check `deployments/sepolia-deployments.json`
- [ ] Compare addresses
- [ ] Use existing address if appropriate
- [ ] Or rename deployment file to redeploy

### If Verification Fails

**Error: "Already Verified"**
- [ ] Expected if redeployed
- [ ] Can view existing verification
- [ ] No action needed

**Error: "Etherscan API not responding"**
- [ ] Wait a few minutes
- [ ] Retry verification
- [ ] Check Etherscan status
- [ ] Manually verify if needed

### If Frontend Integration Fails

**Error: "Contract address not found"**
- [ ] Check `frontend/constants/deployments/sepolia-addresses.json` exists
- [ ] Verify deployment completed
- [ ] Regenerate artifacts if needed

**Error: "Cannot read contract methods"**
- [ ] Verify ABI is correct
- [ ] Check contract address is valid
- [ ] Verify account has provider
- [ ] Test with Etherscan first

## Additional Resources

### Documentation Files
- [ ] DEPLOYMENT_SEPOLIA.md - Complete guide
- [ ] DEPLOYMENT_WORKFLOW.md - Quick reference
- [ ] FRONTEND_INTEGRATION.md - Frontend guide
- [ ] DEPLOYMENT_COMPLETE.md - Setup summary

### External Resources
- [ ] [Hardhat Documentation](https://hardhat.org/docs)
- [ ] [Ethers.js v6 Guide](https://docs.ethers.org/v6/)
- [ ] [Sepolia Faucet](https://sepoliafaucet.com/)
- [ ] [Sepolia Etherscan](https://sepolia.etherscan.io/)
- [ ] [Ethereum Docs](https://ethereum.org/en/developers/)

### Contact & Support
- [ ] Team tech lead for questions
- [ ] Hardhat Discord for technical support
- [ ] Ethers.js documentation
- [ ] Stack Overflow for issues

## Sign-Off

- [ ] All checklist items completed
- [ ] Code reviewed and approved
- [ ] Deployment completed successfully
- [ ] Documentation reviewed
- [ ] Team notified

---

## Deployment Summary

**Date Deployed:** _______________

**Contract Address:** _______________

**Transaction Hash:** _______________

**Block Number:** _______________

**Deployer Address:** _______________

**Etherscan Link:** _______________

**Deployment Cost (ETH):** _______________

**Deployment Duration:** _______________

**Notes:**
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________

---

✅ **Status:** Ready to Deploy!

**Questions?** Refer to:
- DEPLOYMENT_SEPOLIA.md (Complete guide)
- DEPLOYMENT_WORKFLOW.md (Quick reference)
- FRONTEND_INTEGRATION.md (Frontend guide)

**Last Updated:** March 2024
