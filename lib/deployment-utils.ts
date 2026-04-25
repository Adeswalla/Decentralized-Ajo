/**
 * Deployment Utilities
 * Helper functions for managing deployments and contract interactions
 */
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'lib', module: 'deployment-utils' });

export interface DeploymentConfig {
  network: string;
  rpcUrl: string;
  chainId: number;
  blockExplorer: string;
  faucetUrl?: string;
}

export interface DeploymentRecord {
  address: string;
  txHash: string;
  blockNumber: number;
  deployer: string;
  timestamp: string;
  contract: string;
  network: string;
}

export const NETWORK_CONFIG: Record<string, DeploymentConfig> = {
  sepolia: {
    network: "sepolia",
    rpcUrl: process.env.SEPOLIA_RPC_URL || "",
    chainId: 11155111,
    blockExplorer: "https://sepolia.etherscan.io",
    faucetUrl: "https://sepoliafaucet.com/",
  },
  hardhat: {
    network: "hardhat",
    rpcUrl: "http://127.0.0.1:8545",
    chainId: 31337,
    blockExplorer: "",
  },
  localhost: {
    network: "localhost",
    rpcUrl: "http://127.0.0.1:8545",
    chainId: 31337,
    blockExplorer: "",
  },
};

/**
 * Format an address for display
 */
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format ETH amount with proper decimal places
 */
export function formatEth(amount: bigint, decimals: number = 4): string {
  const divisor = BigInt(10 ** 18);
  const ethAmount = Number(amount) / Number(divisor);
  return ethAmount.toFixed(decimals);
}

/**
 * Generate deployment report
 */
export function generateDeploymentReport(
  deployment: DeploymentRecord,
  config: DeploymentConfig
): string {
  const explorerUrl =
    config.blockExplorer && config.blockExplorer !== ""
      ? `${config.blockExplorer}/address/${deployment.address}`
      : "N/A";

  return `
═══════════════════════════════════════════════════════════════
  DEPLOYMENT REPORT
═══════════════════════════════════════════════════════════════

Contract:       ${deployment.contract}
Network:        ${deployment.network.toUpperCase()}
Chain ID:       ${config.chainId}

Address:        ${deployment.address}
Transaction:    ${deployment.txHash}
Block:          ${deployment.blockNumber}
Deployer:       ${deployment.deployer}
Timestamp:      ${deployment.timestamp}

Explorer Link:  ${explorerUrl}

═══════════════════════════════════════════════════════════════

Frontend Integration:
  import { AjoFactoryAddress } from '@/constants/deployments/${deployment.network}-addresses.json'

═══════════════════════════════════════════════════════════════
`;
}

/**
 * Validate network configuration
 */
export function validateNetworkConfig(networkName: string): boolean {
  const config = NETWORK_CONFIG[networkName];
  if (!config) {
    logger.error('Unknown network', { networkName });
    return false;
  }

  if (networkName === "sepolia" && !process.env.SEPOLIA_RPC_URL) {
    logger.error('SEPOLIA_RPC_URL environment variable not set');
    return false;
  }

  if (networkName === "sepolia" && !process.env.SEPOLIA_PRIVATE_KEY) {
    logger.error('SEPOLIA_PRIVATE_KEY environment variable not set');
    return false;
  }

  return true;
}

/**
 * Get faucet URL for testnet
 */
export function getFaucetUrl(networkName: string): string | null {
  const config = NETWORK_CONFIG[networkName];
  return config?.faucetUrl || null;
}

/**
 * Check if network is testnet
 */
export function isTestnet(networkName: string): boolean {
  return ["sepolia", "goerli", "hardhat", "localhost"].includes(networkName);
}

/**
 * Check if network is mainnet
 */
export function isMainnet(networkName: string): boolean {
  return ["ethereum", "mainnet"].includes(networkName);
}

/**
 * Get gas limit multiplier for network
 */
export function getGasMultiplier(networkName: string): number {
  // Sepolia sometimes has gas price spikes
  if (networkName === "sepolia") return 1.2;
  if (networkName === "ethereum" || networkName === "mainnet") return 1.1;
  return 1.0;
}
