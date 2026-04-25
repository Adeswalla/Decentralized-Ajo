# Contract Verification on Block Explorers

> **Issue #165** — Push ABI definitions to block explorers to enable GUI tracking
> and community transparency on Sepolia (and Ethereum mainnet).

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm run deploy:sepolia` | Deploy AjoCircle + AjoFactory to Sepolia |
| `npm run verify:sepolia` | Verify both contracts on Etherscan |
| `npm run deploy:verify:sepolia` | Deploy and verify in one step |

---

## Prerequisites

1. **Etherscan API key** — create one at <https://etherscan.io/myapikey>  
   Free tier is sufficient; 5 calls/second, unlimited verifications.

2. **Environment variables** — copy `.env.example` → `.env` and fill in:

   ```env
   ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY
   PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
   ```

3. **Deploy first** — the verification script reads
   `contracts/ethereum/deployed-<network>.json` to obtain the exact constructor
   arguments used on-chain. Run deployment before verification.

---

## Step-by-step

### 1 · Deploy

```bash
# From the repo root
npm run deploy:sepolia
```

This runs `contracts/ethereum/scripts/deploy.js`, which:
- Deploys **AjoCircle** (implementation, constructor: none)
- Deploys **AjoFactory** (constructor: `address _implementation`)
- Saves addresses + constructor args to `contracts/ethereum/deployed-sepolia.json`
- Attempts inline Etherscan verification (non-blocking)

### 2 · Verify (if inline verification failed or was skipped)

```bash
npm run verify:sepolia
```

This runs `scripts/verify.ts`, which:
- Reads `contracts/ethereum/deployed-sepolia.json`
- Waits 30 s for Etherscan to index the contracts
- Calls `verify:verify` for **AjoCircle** (0 constructor args)
- Calls `verify:verify` for **AjoFactory** (`_implementation = <AjoCircle address>`)
- Prints direct Etherscan `#code` links on success
- Gracefully skips contracts that are already verified

### 3 · Combined (deploy + verify in one shot)

```bash
npm run deploy:verify:sepolia
```

### 4 · Manual fallback

If the scripts fail for any reason you can verify manually:

```bash
# AjoCircle — no constructor args
npx hardhat verify \
  --network sepolia \
  --contract "contracts/ethereum/contracts/AjoCircle.sol:AjoCircle" \
  <AJOCIRCLE_ADDRESS>

# AjoFactory — takes the AjoCircle address as its single constructor arg
npx hardhat verify \
  --network sepolia \
  --contract "contracts/ethereum/contracts/AjoFactory.sol:AjoFactory" \
  <AJOFACTORY_ADDRESS> \
  <AJOCIRCLE_ADDRESS>
```

---

## How verification works

`@nomicfoundation/hardhat-verify` (already installed) submits the **Solidity
source + compiler settings** from your local build to the Etherscan API. Etherscan
re-compiles the source and checks that the resulting bytecode matches what is
stored on-chain. On success it:

- Displays a **green ✓ checkmark** on the contract page
- Publishes the **ABI** so users can interact via the Etherscan GUI ("Read/Write
  Contract" tabs)
- Enables **event log decoding** — community members see human-readable event
  names instead of raw hex topics

A **Sourcify** fallback is also configured in `hardhat.config.ts` (no API key
required) for decentralised, IPFS-backed verification.

---

## Stellar / Soroban (main contract)

This repo's primary savings contract (`contracts/ajo-circle`) runs on Soroban.
Verification there is WASM-based:

1. Build the WASM artifact:

   ```bash
   cd contracts/ajo-circle
   cargo build --target wasm32-unknown-unknown --release
   ```

2. Upload the WASM + matching constructor parameters to
   [Stellar Expert](https://stellar.expert) (testnet or mainnet).

3. Optionally run the helper:

   ```bash
   ./scripts/verify-stellar-contract.sh
   ```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ETHERSCAN_API_KEY is not set` | Add the key to `.env` |
| `Contract does not have bytecode` | Wait ~1 min for the TX to be indexed, then retry |
| `Already Verified` | Nothing to do — the contract is already public |
| Wrong constructor args | Check `deployed-sepolia.json`; re-run deploy if stale |
| `hardhat verify` flag errors | Ensure `@nomicfoundation/hardhat-verify` is installed: `npm install` |
