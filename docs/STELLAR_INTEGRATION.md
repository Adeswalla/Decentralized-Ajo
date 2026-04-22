# Stellar SDK Integration

This document covers how the app connects to the Stellar network, how XLM amounts are handled, and how the Freighter wallet is used to sign transactions.

## Configuration (`lib/stellar-config.ts`)

All Stellar network settings are centralised in the `STELLAR_CONFIG` object:

```ts
export const STELLAR_CONFIG = {
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet',
  horizonUrl: process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  sorobanRpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  ajoContractAddress: process.env.NEXT_PUBLIC_AJO_CONTRACT_ADDRESS || '',
  walletNetworkDetailsPublicKey: process.env.NEXT_PUBLIC_WALLET_NETWORK_DETAILS_PUBLIC_KEY || 'public',
};
```

All values are `NEXT_PUBLIC_` prefixed — they are embedded at build time and available in the browser.

## Environment Variables

| Variable | Testnet Value | Mainnet Value |
|---|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` | `mainnet` |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` | `https://soroban.stellar.org` |
| `NEXT_PUBLIC_AJO_CONTRACT_ADDRESS` | Your deployed testnet contract ID | Your deployed mainnet contract ID |

## Exported Functions

### `getStellarServer()`

Returns a `StellarSdk.Horizon.Server` instance connected to `STELLAR_CONFIG.horizonUrl`.

Use this to query account details, transaction history, and submit transactions to the Stellar network.

```ts
const server = getStellarServer();
const account = await server.loadAccount(publicKey);
```

### `getSorobanClient()`

Returns a `SorobanRpc.Server` instance connected to `STELLAR_CONFIG.sorobanRpcUrl`.

Use this to simulate and submit Soroban smart contract invocations.

```ts
const client = getSorobanClient();
const result = await client.simulateTransaction(tx);
```

### `getNetworkConfig()`

Returns `{ passphrase, horizonUrl }` — the two values needed when building Stellar transactions.

```ts
const { passphrase, horizonUrl } = getNetworkConfig();
const tx = new StellarSdk.TransactionBuilder(account, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: passphrase,
});
```

### `isValidStellarAddress(address: string): boolean`

Validates a Stellar public key using `StellarSdk.StrKey.decodeEd25519PublicKey`. Returns `true` for valid `G...` addresses, `false` for anything else.

Used in:
- `lib/wallet-context.tsx` — validates the address returned by Freighter before storing it
- `app/api/auth/wallet/verify/route.ts` — validates the address submitted for signature verification

### `formatXLM(stroops: string | number): string`

Converts a stroops value to a human-readable XLM string.

> 1 XLM = 10,000,000 stroops. Trailing zeros are stripped.

| Input | Output |
|---|---|
| `10000000` | `"1"` |
| `15000000` | `"1.5"` |
| `100000001` | `"10.0000001"` |

### `xlmToStroops(xlm: number): string`

Converts an XLM amount to stroops as a string.

```ts
xlmToStroops(1)   // "10000000"
xlmToStroops(1.5) // "15000000"
```

## Freighter Wallet Integration

The app integrates with the [Freighter](https://www.freighter.app/) browser extension via `window.freighter`.

### Checking for Freighter

```ts
if (!window.freighter) {
  throw new Error('Freighter wallet not found. Please install Freighter extension.');
}
```

### Getting the Public Key

```ts
const pubKey = await window.freighter.getPublicKey();
// Returns a Stellar G... address string
```

### Signing a Transaction

```ts
const signedXdr = await window.freighter.signTransaction(
  transactionXdr, // Base64-encoded XDR of the transaction
  STELLAR_CONFIG.networkPassphrase
);
// Returns signed XDR string
```

### Signing a Message (for wallet verification)

```ts
const signature = await window.freighter.signTransaction(
  nonce,
  STELLAR_CONFIG.networkPassphrase
);
// Returns base64-encoded Ed25519 signature of the nonce
```

## Wallet Context (`lib/wallet-context.tsx`)

`WalletProvider` wraps the app and exposes wallet state via `useWallet()`.

### On Mount Behaviour

Calls `window.freighter.getPublicKey()` to restore a previously connected session. If a valid address is returned, it is set in state and `localStorage`.

### `connectWallet()`

1. Checks `window.freighter` exists
2. Calls `getPublicKey()`
3. Validates with `isValidStellarAddress`
4. Saves to `localStorage.walletAddress`
5. Calls `PATCH /api/users/update-wallet` to persist to the database (non-blocking — errors are logged but not thrown)

### `disconnectWallet()`

Clears `walletAddress`, `publicKey`, and `error` from state, and removes `walletAddress` from `localStorage`.

### `signTransaction(transactionXdr)`

Calls `window.freighter.signTransaction` with the XDR and network passphrase. Throws on failure.

### `signAndSubmit(transactionXdr, options?)`

Signs the transaction, submits it via the Soroban RPC client, then polls for confirmation.

| Option | Default | Description |
|---|---|---|
| `pollingTimeout` | `60000` | Max ms to wait for confirmation |
| `pollingInterval` | `2000` | Ms between polling attempts |

Returns `{ hash, status, response }` on success. Throws on failure or timeout.

## Network Switching

To switch between testnet and mainnet, update these environment variables together:

```env
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban.stellar.org
NEXT_PUBLIC_AJO_CONTRACT_ADDRESS=<mainnet-contract-id>
```

Also switch the Freighter extension to the matching network in its settings.

## Testnet Funding

To fund a testnet account with XLM for development:

```bash
curl "https://friendbot.stellar.org?addr=<YOUR_PUBLIC_KEY>"
```

Or use the [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test).
