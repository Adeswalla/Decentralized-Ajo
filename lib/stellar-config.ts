import * as StellarSdk from '@stellar/stellar-sdk';

export const STELLAR_CONFIG = {
  // Network configuration
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet',
  horizonUrl: process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  
  // Soroban RPC
  sorobanRpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  
  // Contract address
  ajoContractAddress: process.env.NEXT_PUBLIC_AJO_CONTRACT_ADDRESS || '',
  
  // Wallet network details
  walletNetworkDetailsPublicKey: process.env.NEXT_PUBLIC_WALLET_NETWORK_DETAILS_PUBLIC_KEY || 'public',
};

// Initialize Stellar SDK
export const getStellarServer = () => {
  return new StellarSdk.Horizon.Server(STELLAR_CONFIG.horizonUrl);
};

// Initialize Soroban RPC client
export const getSorobanClient = () => {
  return new StellarSdk.SorobanRpc.Server(STELLAR_CONFIG.sorobanRpcUrl);
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
  } catch (error) {
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
