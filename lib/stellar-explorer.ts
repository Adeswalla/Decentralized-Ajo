/**
 * Stellar Explorer & Laboratory URL Builders
 *
 * Generates deep-link URLs to external Stellar tools for transaction hashes
 * and contract IDs, scoped to the configured network (testnet / mainnet).
 *
 * Usage:
 *   import { getStellarExplorerUrl, getStellarLabUrl, getStellarNetworkLabel } from '@/lib/stellar-explorer';
 */

import { STELLAR_CONFIG } from './stellar-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StellarNetwork = 'testnet' | 'mainnet';

export interface ExplorerUrlResult {
  /** The generated URL, or null when the network is unsupported. */
  url: string | null;
  /** Human-readable label for the network (e.g. "Testnet"). */
  networkLabel: string;
  /** True when a URL was successfully generated. */
  supported: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveNetwork(): StellarNetwork | null {
  const raw = (STELLAR_CONFIG.network ?? '').toLowerCase().trim();
  if (raw === 'testnet') return 'testnet';
  if (raw === 'mainnet' || raw === 'public') return 'mainnet';
  return null; // unsupported / misconfigured
}

// stellar.expert uses "testnet" and "public" as path segments
const STELLAR_EXPERT_SEGMENT: Record<StellarNetwork, string> = {
  testnet: 'testnet',
  mainnet: 'public',
};

// Stellar Lab uses query-param ?network=testnet|mainnet
const STELLAR_LAB_NETWORK: Record<StellarNetwork, string> = {
  testnet: 'testnet',
  mainnet: 'mainnet',
};

const NETWORK_LABELS: Record<StellarNetwork, string> = {
  testnet: 'Testnet',
  mainnet: 'Mainnet',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the current network label for display (e.g. "Testnet").
 * Returns "Unknown Network" when the config is not recognised.
 */
export function getStellarNetworkLabel(): string {
  const network = resolveNetwork();
  return network ? NETWORK_LABELS[network] : 'Unknown Network';
}

/**
 * Builds a Stellar Expert explorer URL for a **transaction hash**.
 *
 * @example
 * getStellarExplorerTxUrl('abc123...')
 * // => { url: 'https://stellar.expert/explorer/testnet/tx/abc123...', supported: true, ... }
 */
export function getStellarExplorerTxUrl(txHash: string): ExplorerUrlResult {
  const network = resolveNetwork();
  if (!network || !txHash) {
    return { url: null, networkLabel: getStellarNetworkLabel(), supported: false };
  }
  const segment = STELLAR_EXPERT_SEGMENT[network];
  return {
    url: `https://stellar.expert/explorer/${segment}/tx/${txHash}`,
    networkLabel: NETWORK_LABELS[network],
    supported: true,
  };
}

/**
 * Builds a Stellar Expert explorer URL for a **contract / account ID**.
 *
 * @example
 * getStellarExplorerContractUrl('C...')
 * // => { url: 'https://stellar.expert/explorer/testnet/contract/C...', supported: true, ... }
 */
export function getStellarExplorerContractUrl(contractId: string): ExplorerUrlResult {
  const network = resolveNetwork();
  if (!network || !contractId) {
    return { url: null, networkLabel: getStellarNetworkLabel(), supported: false };
  }
  const segment = STELLAR_EXPERT_SEGMENT[network];
  return {
    url: `https://stellar.expert/explorer/${segment}/contract/${contractId}`,
    networkLabel: NETWORK_LABELS[network],
    supported: true,
  };
}

/**
 * Builds a Stellar Expert explorer URL for a **Stellar account (public key)**.
 */
export function getStellarExplorerAccountUrl(publicKey: string): ExplorerUrlResult {
  const network = resolveNetwork();
  if (!network || !publicKey) {
    return { url: null, networkLabel: getStellarNetworkLabel(), supported: false };
  }
  const segment = STELLAR_EXPERT_SEGMENT[network];
  return {
    url: `https://stellar.expert/explorer/${segment}/account/${publicKey}`,
    networkLabel: NETWORK_LABELS[network],
    supported: true,
  };
}

/**
 * Builds a Stellar Laboratory URL pre-loaded to inspect a **transaction XDR or hash**.
 *
 * @param txHash - The transaction hash (64-char hex).
 */
export function getStellarLabTxUrl(txHash: string): ExplorerUrlResult {
  const network = resolveNetwork();
  if (!network || !txHash) {
    return { url: null, networkLabel: getStellarNetworkLabel(), supported: false };
  }
  const netParam = STELLAR_LAB_NETWORK[network];
  // Stellar Lab "transaction hash lookup" endpoint
  const url = new URL('https://laboratory.stellar.org/');
  url.hash = `#explorer?network=${netParam}&resource=transactions&endpoint=single&values={"transaction_hash":"${txHash}"}`;
  return {
    url: url.toString(),
    networkLabel: NETWORK_LABELS[network],
    supported: true,
  };
}

/**
 * Builds a Stellar Laboratory URL for inspecting a **smart contract**.
 *
 * @param contractId - The Soroban contract address (C...).
 */
export function getStellarLabContractUrl(contractId: string): ExplorerUrlResult {
  const network = resolveNetwork();
  if (!network || !contractId) {
    return { url: null, networkLabel: getStellarNetworkLabel(), supported: false };
  }
  const netParam = STELLAR_LAB_NETWORK[network];
  const url = new URL('https://laboratory.stellar.org/');
  url.hash = `#contract-explorer?network=${netParam}&contractId=${contractId}`;
  return {
    url: url.toString(),
    networkLabel: NETWORK_LABELS[network],
    supported: true,
  };
}
