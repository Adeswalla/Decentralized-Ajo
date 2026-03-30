import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "hardhat-gas-reporter";
import "solidity-coverage";
import dotenv from "dotenv";

dotenv.config();

// ⚠️  SECURITY WARNING ⚠️
// NEVER hardcode private keys in this file.
// Always use environment variables from a .env file.
// Ensure .env is added to .gitignore
// For production, use hardware wallets or secret management services.

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

if (!SEPOLIA_RPC_URL && process.env.NODE_ENV === "production") {
  console.warn("⚠️  SEPOLIA_RPC_URL is not set in .env");
}

if (!SEPOLIA_PRIVATE_KEY && process.env.NODE_ENV === "production") {
  console.warn(
    "⚠️  SEPOLIA_PRIVATE_KEY is not set in .env - cannot deploy to Sepolia"
  );
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: SEPOLIA_PRIVATE_KEY ? [SEPOLIA_PRIVATE_KEY] : [],
      chainId: 11155111,
      // Gas settings for Sepolia (adjust as needed)
      gasPrice: "auto",
    },

    // Local hardhat network for development
    hardhat: {
      chainId: 31337,
    },

    // Optional: localhost network for running local node
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },

  // Etherscan verification
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY || "",
    },
  },

  // Gas reporter
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
    outputFile: "gas-report.txt",
    noColors: true,
  },

  // Paths
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // Mocha test timeout
  mocha: {
    timeout: 40000,
  },
};

export default config;
