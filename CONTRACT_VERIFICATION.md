# Contract verification on block explorers

This repository ships a **Soroban (Stellar)** contract (`contracts/ajo-circle`). If you also deploy an **EVM** build (e.g. Polygon), use **Etherscan** (or the network’s explorer) to verify Solidity sources.

## Stellar / Soroban (this repo)

1. Build the WASM artifact:

   ```bash
   cd contracts/ajo-circle
   cargo build --target wasm32-unknown-unknown --release
   ```

2. Install the [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools) and deploy or reuse your deployed contract address.

3. Publish **verified source** on [Stellar Expert](https://stellar.expert) (or your network’s explorer): upload the matching WASM and, when prompted, the **exact** constructor / install parameters used at deploy time.

4. Optionally run the helper script (prints build info and verification checklist):

   ```bash
   ./scripts/verify-stellar-contract.sh
   ```

## Ethereum / Polygon — Etherscan-style verification

For Solidity contracts (not the Soroban crate in this tree):

1. Create an API key at [Etherscan](https://etherscan.io/apis) (or the target chain’s explorer, e.g. Polygonscan).

2. Use **Hardhat** with `@nomicfoundation/hardhat-verify` (successor to `hardhat-etherscan`) or **Foundry** `forge verify-contract`.

3. Pass **constructor arguments** exactly as used on-chain (often ABI-encoded; Hardhat’s `verify` task can take them via `--constructor-args`).

4. Open the contract page on the explorer and confirm the **green checkmark** / verified badge.

### Hardhat example (EVM projects)

```bash
npx hardhat verify --network <network> <DEPLOYED_ADDRESS> "<constructor_arg_1>" "<constructor_arg_2>"
```

Or use the helper script provided in this repo (reuses deployment metadata and the exact constructor args for AjoCircle):

```bash
cd contracts
npm run verify:sepolia
# or
npm run verify:mainnet
```

Set `ETHERSCAN_API_KEY` (or `POLYGONSCAN_API_KEY`, etc.) in your environment or `hardhat.config`.

## Why both sections?

- **Stellar Ajo** uses Soroban; verification is WASM + explorer metadata.
- Issue trackers sometimes say “Etherscan” generically; the equivalent workflow for this codebase is **Stellar Expert** unless you maintain a separate EVM deployment.
