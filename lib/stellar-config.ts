import * as StellarSdk from '@stellar/stellar-sdk';

// ---------------------------------------------------------------------------
// Known Stellar networks
// ---------------------------------------------------------------------------
export const KNOWN_NETWORKS = {
  testnet: {
    name: 'testnet',
    label: 'Testnet',
    passphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    color: 'amber',   // used for badge styling
  },
  mainnet: {
    name: 'mainnet',
    label: 'Mainnet',
    passphrase: 'Public Global Stellar Network ; September 2015',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://soroban.stellar.org',
    color: 'emerald', // used for badge styling
  },
} as const;

export type StellarNetworkName = keyof typeof KNOWN_NETWORKS;

export const STELLAR_CONFIG = {
  // Network configuration
  network: (process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet') as StellarNetworkName,
  horizonUrl: process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  
  // Soroban RPC
  sorobanRpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  
  // Contract address
  ajoContractAddress: process.env.NEXT_PUBLIC_AJO_CONTRACT_ADDRESS || '',
  
  // Wallet network details
  walletNetworkDetailsPublicKey: process.env.NEXT_PUBLIC_WALLET_NETWORK_DETAILS_PUBLIC_KEY || 'public',
};

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

/** Returns the configured app network name ("testnet" | "mainnet"). */
export const getAppNetwork = (): StellarNetworkName => {
  const n = STELLAR_CONFIG.network.toLowerCase();
  return n === 'mainnet' ? 'mainnet' : 'testnet';
};

/** True when the app is configured for Stellar Mainnet. */
export const isMainnet = (): boolean => getAppNetwork() === 'mainnet';

/** Human-readable display label for the app's configured network. */
export const getNetworkDisplayLabel = (): string =>
  KNOWN_NETWORKS[getAppNetwork()].label;

/**
 * Derive a network name from a Freighter/Lobstr network passphrase string.
 * Returns null when the passphrase is unrecognised.
 */
export const passphraseToNetworkName = (
  passphrase: string
): StellarNetworkName | null => {
  for (const [key, cfg] of Object.entries(KNOWN_NETWORKS)) {
    if (cfg.passphrase === passphrase) return key as StellarNetworkName;
  }
  return null;
};

// Initialize Stellar SDK
export const getStellarServer = () => {
  return new StellarSdk.Horizon.Server(STELLAR_CONFIG.horizonUrl);
};

// Initialize Soroban RPC client
export const getSorobanClient = () => {
  return new (StellarSdk as any).SorobanRpc.Server(STELLAR_CONFIG.sorobanRpcUrl);
};

// Get network configuration
export const getNetworkConfig = () => {
  return {
    passphrase: STELLAR_CONFIG.networkPassphrase,
    horizonUrl: STELLAR_CONFIG.horizonUrl,
  };
};

// Validate Stellar address
export const isValidStellarAddress = (address: string): boolean => {
  try {
    StellarSdk.StrKey.decodeEd25519PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

// Format XLM amount for display
export const formatXLM = (stroops: string | number): string => {
  const amount = typeof stroops === 'string' ? BigInt(stroops) : BigInt(stroops);
  const xlm = Number(amount) / 10_000_000; // 1 XLM = 10,000,000 stroops
  return xlm.toFixed(7).replace(/\.?0+$/, '');
};

// Convert XLM to stroops
export const xlmToStroops = (xlm: number): string => {
  return (xlm * 10_000_000).toString();
};
